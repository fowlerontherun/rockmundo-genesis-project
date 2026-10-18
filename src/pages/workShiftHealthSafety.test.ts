import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const edgeFile = (name: string) =>
  readFileSync(new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url), "utf8");
const page = readFileSync(new URL("./Employment.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../supabase/migrations/20261018184048_work_shift_authoritative_minimum_vitals_20261018.sql", import.meta.url),
  "utf8",
);

describe("work-shift health and readiness regression (#4218)", () => {
  const adjustedHealth = (stored: number | null, impact: number) =>
    Math.max(0, Math.min(100, (stored ?? 100) + impact));
  const canWork = (health: number | null, energy: number | null) =>
    (health ?? 100) >= 20 && (energy ?? 100) >= 10;

  it.each([
    [0, -2, 0],
    [null, -2, 98],
    [1, -2, 0],
    [100, -2, 98],
    [100, 5, 100],
  ])("preserves real health %s with impact %s => %s", (health, impact, expected) => {
    expect(adjustedHealth(health, impact)).toBe(expected);
  });

  it.each([
    [0, 100, false],
    [19, 100, false],
    [20, 9, false],
    [20, 10, true],
    [100, 100, true],
    [null, null, true],
  ])("enforces shift minimum for health=%s energy=%s", (health, energy, expected) => {
    expect(canWork(health, energy)).toBe(expected);
  });

  it("shift-clock-out cannot substitute 100 when health really is zero", () => {
    const source = edgeFile("shift-clock-out");
    expect(source).toContain("(profile?.health ?? 100)");
    expect(source).not.toContain("(profile?.health || 100)");
  });

  it("service-role auto attendance checks minimums before creating any shift", () => {
    const source = edgeFile("shift-clock-in");
    const cutoff = source.indexOf("(profile.health ?? 100) < 20 || (profile.energy ?? 100) < 10");
    const insert = source.indexOf(".from('shift_history')\n          .insert(");
    expect(cutoff).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(cutoff);
    expect(source).toContain("recordOutcome(row.id, 'unfit_for_work'");
  });

  it("employment UI never treats health/energy 0 as missing", () => {
    expect(page).not.toContain("(profile.health || 100)");
    expect(page).not.toContain("(profile.energy || 100)");
    expect(page).toContain("(profile.health ?? 100) < 20");
    expect(page).toContain("(profile.energy ?? 100) < 10");
    expect(page).toContain("unfit_for_work:");
  });

  it("manual shift RPC checks active character and minimums before generating shift", () => {
    expect(migration).toContain("p.is_active IS DISTINCT FROM true");
    expect(migration).toContain("coalesce(p.health,100) < 20");
    expect(migration).toContain("coalesce(p.energy,100) < 10");
    expect(migration).toContain("work_character_not_fit");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.clock_in_work_shift_atomic(uuid,uuid) TO authenticated");
  });
});
