import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// These three public HTTP routes used to mutate global gameplay/economy state.
// They are now deliberately retired; only locked, internal PostgreSQL jobs
// may settle radio spins, lottery winnings and music-video production rewards.
const read = (path: string) => readFileSync(path, "utf8");
const config = read("supabase/config.toml");
const endpoints = [
  {
    name: "simulate-radio-plays",
    issue: 4242,
    cronProcedure: "process_hourly_radio_plays",
  },
  {
    name: "lottery-draw",
    issue: 4224,
    cronProcedure: "process_weekly_lottery_draw",
  },
  {
    name: "complete-video-production",
    issue: 4253,
    cronProcedure: "run_music_video_production_completion_scheduled",
  },
] as const;

describe("retired public economy endpoints never execute privileged jobs", () => {
  for (const { name, issue, cronProcedure } of endpoints) {
    it(`#${issue}: ${name} requires gateway JWT and always refuses job execution`, () => {
      const source = read(`supabase/functions/${name}/index.ts`);
      const section = config.match(new RegExp(
        `\\[functions\\.${name}\\]\\s*verify_jwt\\s*=\\s*(true|false)`,
      ));
      expect(section?.[1]).toBe("true");
      expect(source).toMatch(/status:\\s*410/);
      // A legacy URL must not regain a service-role client, remote fetch,
      // DB transaction, RPC, or mutable table access during future refactors.
      expect(source).not.toMatch(/createClient|SUPABASE_SERVICE_ROLE_KEY|\\.rpc\\s*\\(|\\.from\\s*\\(|fetch\\s*\\(/);
      expect(source).not.toContain("pg_cron.run");
      expect(source).toContain(cronProcedure);
    });
  }
});

describe("Postgres scheduler authority remains atomic and private", () => {
  it("radio receipts are unique per playlist/hour and job replaces HTTP cron", () => {
    const sql = read("supabase/migrations/20261019110500_atomic_hourly_radio_rotation.sql");
    expect(sql).toContain("radio_plays_playlist_hour_unique");
    expect(sql).toContain("ON CONFLICT (playlist_id,simulation_hour)");
    expect(sql).toContain("FOR UPDATE OF pl SKIP LOCKED");
    expect(sql).toContain("command=>'SELECT public.process_hourly_radio_plays();'");
    expect(sql).not.toContain("net.http_post");
  });

  it("lottery refuses early runs, locks due draws and settles tickets atomically", () => {
    const sql = read("supabase/migrations/20261019064627_lottery_internal_due_time_draw_guard_20261019.sql");
    expect(sql).toContain("week_start::timestamp + interval '7 days 5 minutes'");
    expect(sql).toContain("order by week_start asc limit 1 for update");
    expect(sql).toContain("public.settle_lottery_ticket_atomic");
    expect(sql).toContain("no_due_draw");
    expect(sql).toMatch(/revoke all on function public\\.process_weekly_lottery_draw\\(\\) from public,anon,authenticated/i);
  });

  it("video release, unique award and associated rewards commit in one transaction", () => {
    const sql = read("supabase/migrations/20261019125734_atomic_music_video_release_awards_and_internal_cron.sql");
    expect(sql).toContain("video_id uuid PRIMARY KEY");
    expect(sql).toContain("FOR UPDATE OF v SKIP LOCKED");
    expect(sql).toContain("WHERE id=v_video.id AND status='production'");
    expect(sql).toContain("INSERT INTO public.music_video_production_awards");
    expect(sql).toContain("pg_catalog.pg_try_advisory_xact_lock(4253,48)");
    expect(sql).toContain("SELECT public.run_music_video_production_completion_scheduled();");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.complete_due_music_video_productions_atomic(integer)");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.run_music_video_production_completion_scheduled()");
    expect(sql).toContain("WHERE edge_function_name='complete-video-production'");
    const harness = read("supabase/tests/music_video_atomic_completion_4253.sql");
    for (const check of ["BEGIN;", "ROLLBACK;", "video_reward_replayed", "not_due_video_released", "video_completion_acl_incorrect"]) {
      expect(harness).toContain(check);
    }
  });
});
