import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function migration(name: string) {
  return readFileSync(resolve(process.cwd(), 'supabase/migrations', name), 'utf8');
}

const board = migration('20261027080000_city_scene_board_and_cycle_reconciliation.sql');
const social = migration('20261027081500_scene_social_activity_adapter.sql');
const entrypoints = migration('20261027082000_scene_service_role_entrypoints.sql');
const jam = migration('20261027083000_scene_verified_jam_ingest.sql');
const mine = migration('20261027084000_scene_owner_progress_read.sql');

describe('City Scene Challenges rollout contract', () => {
  it('does not activate templates, schedule a cron or make client-scoring RPCs', () => {
    expect(board).toContain("'scene:verified_community', 1, false");
    expect(board).toContain("and t.enabled");
    expect(board).not.toContain('cron.schedule(');
    expect(social).not.toContain('cron.schedule(');
    expect(jam).not.toContain('cron.schedule(');
    expect(entrypoints).toContain('security invoker');
    expect(entrypoints).toContain('to service_role');
    expect(entrypoints).toContain('from public, anon, authenticated');
  });

  it('rejects social-host claims as attendance proof', () => {
    expect(social).toContain('host-owned completion RPC');
    expect(social).toContain('NEVER score this source');
    expect(social).toContain('return 0;');
  });

  it('requires actual resolved jam slots and authoritative finalisation', () => {
    expect(jam).toContain('public.jam_session_finalizations');
    expect(jam).toContain('public.jam_session_slot_participants');
    expect(jam).toContain('sl.resolved_at <= v_session.completed_at');
    expect(jam).toContain('count(distinct p.user_id)');
    expect(jam).toContain('v_session.completed_at < v_session.scheduled_end');
    expect(jam).toContain("'scoring_enabled', 'false'");
    expect(jam).toContain('scene_daily_affiliations');
    expect(jam).toContain('on conflict (objective_id, source_type, source_event_id, account_id)');
  });

  it('uses a full-cycle account lock, not a per-day cap for weekly and monthly', () => {
    for (const sql of [social, jam]) {
      expect(sql).toContain("'rockmundo:scene:cycle:'");
      expect(sql).toContain('so.cycle_id = v_obj.cycle_id');
      expect(sql).toContain('sc.account_id = v_actor.account_id');
      expect(sql).not.toMatch(/sc\.source_completed_at at time zone 'UTC'\)\s*::date\s*=/);
    }
  });

  it('reads personal progress only from the authenticated account', () => {
    expect(mine).toContain('security invoker');
    expect(mine).toContain('sc.account_id = (select auth.uid())');
    expect(mine).toContain('grant execute on function public.get_my_city_scene_progress(uuid) to authenticated');
    expect(mine).not.toContain('security definer');
  });

  it('does not leak private contribution source IDs through the public board', () => {
    expect(board).toContain('create or replace function public.get_city_scene_board');
    const readFunction = board.split('create or replace function public.get_city_scene_board')[1]?.split('revoke all')[0] ?? '';
    expect(readFunction).not.toContain("'source_event_id'");
    expect(readFunction).not.toContain("'account_id'");
    expect(readFunction).not.toContain("'profile_id'");
    expect(readFunction).toContain("(select auth.uid()) is not null");
  });
});
