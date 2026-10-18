import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const shiftWorker = readFileSync(
  new URL("../../supabase/functions/shift-clock-out/index.ts", import.meta.url), "utf8",
);
const backfill = readFileSync(
  new URL("../../supabase/migrations/20261018194340_work_shift_xp_ledger_account_identity_backfill_20261018.sql", import.meta.url), "utf8",
);

describe("work shift XP account identity (#4217)", () => {
  it("resolves shift owner's auth id before any payable side effects", () => {
    const ownerLookup = shiftWorker.indexOf(".select('user_id')");
    const cityTax = shiftWorker.indexOf("credit_city_treasury");
    const payout = shiftWorker.indexOf(".from('shift_history')\n          .update(");
    expect(ownerLookup).toBeGreaterThan(-1);
    expect(cityTax).toBeGreaterThan(ownerLookup);
    expect(payout).toBeGreaterThan(ownerLookup);
    expect(shiftWorker).toContain("shift.profile_id !== activity.profile_id");
  });

  it("writes work XP to account id and queries the correct character's band", () => {
    expect(shiftWorker).toContain("user_id: shiftOwner.user_id");
    expect(shiftWorker).not.toContain("user_id: activity.profile_id");
    expect(shiftWorker).toContain(".eq('user_id', shiftOwner.user_id).eq('profile_id', shift.profile_id)");
  });

  it("historical correction updates only recipient identity, with no new XP awards", () => {
    expect(backfill).toContain("SET user_id=p.user_id");
    expect(backfill).toContain("e.activity_type='work_shift'");
    expect(backfill).toContain("JOIN public.profiles p");
    expect(backfill).not.toContain("INSERT INTO public.experience_ledger");
    expect(backfill).not.toContain("UPDATE public.profiles SET experience");
  });
});
