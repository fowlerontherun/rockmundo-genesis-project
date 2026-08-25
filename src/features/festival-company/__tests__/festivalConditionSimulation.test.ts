import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFestivalConditions } from "../attendance/festivalConditions";

const migration = readFileSync(
  "supabase/migrations/20260825123000_festival_c6_condition_simulation.sql",
  "utf8",
);
const panelSource = readFileSync(
  "src/features/festival-company/attendance/FestivalConditionPanel.tsx",
  "utf8",
);

const conditions = {
  attendanceId: "11111111-1111-4111-8111-111111111111",
  festivalEditionId: "22222222-2222-4222-8222-222222222222",
  energy: 72,
  hunger: 35,
  hydration: 68,
  mood: 76,
  intoxication: 0,
  social: 51,
  comfort: 64,
  inspiration: 82,
  lastEvolvedAt: "2030-07-01T12:00:00Z",
  lastActivityAt: "2030-07-01T11:30:00Z",
  serverNow: "2030-07-01T12:05:00Z",
};

describe("Festival C6 condition simulation", () => {
  it("extends the existing temporary Festival condition row", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS comfort");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS inspiration");
    expect(migration).not.toContain("CREATE TABLE public.festival_attendee_conditions");
  });

  it("uses a separate server clock for bounded contextual decay", () => {
    expect(migration).toContain("last_context_evolved_at");
    expect(migration).toContain("v_ticks := floor(v_elapsed_minutes / 30.0)::integer");
    expect(migration).toContain("comfort = greatest(0, comfort - v_comfort_decay)");
    expect(migration).toContain("inspiration = greatest(0, inspiration - v_inspiration_decay)");
  });

  it("uses authoritative festival environment data only when it exists", () => {
    expect(migration).toContain("SELECT to_jsonb(edition)");
    expect(migration).toContain("weather_condition");
    expect(migration).toContain("site_type");
    expect(migration).toContain("missing weather data remains neutral");
  });

  it("applies completed plan context exactly once", () => {
    expect(migration).toContain("plan_item_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("item.status = 'completed'");
    expect(migration).toContain("NOT EXISTS (");
    expect(migration).toContain("ON CONFLICT (plan_item_id) DO NOTHING");
    expect(migration).toContain("WHEN 'watch_act' THEN");
    expect(migration).toContain("WHEN 'camping' THEN");
    expect(migration).toContain("WHEN 'vip' THEN");
    expect(migration).toContain("WHEN 'free_time' THEN");
  });

  it("keeps permanent Wellness feedback bounded on Festival exit", () => {
    expect(migration).toContain("festival_reconcile_wellness_on_exit");
    expect(migration).toContain("round((coalesce(v_profile.energy, 75) + v_conditions.energy) / 2.0)");
    expect(migration).toContain("100 - v_conditions.hunger");
    expect(migration).not.toContain("experience_points");
    expect(migration).not.toContain("action_points");
  });

  it("parses and displays Comfort and Inspiration", () => {
    expect(parseFestivalConditions(conditions)).toMatchObject({
      comfort: 64,
      inspiration: 82,
    });
    expect(() => parseFestivalConditions({ ...conditions, comfort: 101 }))
      .toThrow("malformed_festival_conditions");
    expect(panelSource).toContain('["comfort", "Comfort"]');
    expect(panelSource).toContain('["inspiration", "Inspiration"]');
  });
});
