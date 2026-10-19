import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const shiftWorker = readFileSync(
  new URL("../../supabase/functions/shift-clock-out/index.ts", import.meta.url), "utf8",
);
const backfill = readFileSync(
  new URL("../../supabase/migrations/20261018194340_work_shift_xp_ledger_account_identity_backfill_20261018.sql", import.meta.url), "utf8",
);

describe("work shift XP account identity (#4217)", () => {
  it("resolves the true account owner from the locked profile before any reward writes", () => {
    const workerSql = readFileSync(
      new URL("../../supabase/migrations/20261018200133_atomic_work_shift_settlement_20261018.sql", import.meta.url), "utf8",
    );
    const profileLock = workerSql.indexOf("SELECT * INTO p FROM public.profiles WHERE id=s.profile_id FOR UPDATE");
    const ledger = workerSql.indexOf("INSERT INTO public.experience_ledger(user_id,profile_id", profileLock);
    expect(profileLock).toBeGreaterThan(-1);
    expect(ledger).toBeGreaterThan(profileLock);
    expect(workerSql).toContain("VALUES(p.user_id,p.id,'work_shift'");
    expect(workerSql).toContain("a.profile_id IS DISTINCT FROM s.profile_id");
    expect(shiftWorker).toContain("'settle_work_shift_atomic'");
  });

  it("settles XP for the precise profile, with single-transaction recipient integrity", () => {
    const workerSql = readFileSync(
      new URL("../../supabase/migrations/20261018200133_atomic_work_shift_settlement_20261018.sql", import.meta.url), "utf8",
    );
    expect(workerSql).toContain("WHERE bm.profile_id=s.profile_id");
    expect(workerSql).toContain("INSERT INTO public.experience_ledger(user_id,profile_id");
    expect(workerSql).toContain("VALUES(p.user_id,p.id,'work_shift'");
    expect(workerSql).toContain("WHERE id=p.id");
    expect(workerSql).not.toContain("VALUES(a.profile_id,a.profile_id,'work_shift'");
  });

  it("historical correction updates only recipient identity, with no new XP awards", () => {
    expect(backfill).toContain("SET user_id=p.user_id");
    expect(backfill).toContain("e.activity_type='work_shift'");
    expect(backfill).toContain("JOIN public.profiles p");
    expect(backfill).not.toContain("INSERT INTO public.experience_ledger");
    expect(backfill).not.toContain("UPDATE public.profiles SET experience");
  });
});
