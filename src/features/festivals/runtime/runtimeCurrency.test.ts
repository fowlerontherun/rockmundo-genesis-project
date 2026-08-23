import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("Festival runtime currency contract", () => {
  it("projects the exact edition ticket currency from the database", () => {
    const migration = read("supabase/migrations/20291218252300_festival_runtime_currency_code.sql");
    const reconciliation = read("supabase/reconciliation/festival/20260823_festival_runtime_currency_code.sql");

    for (const sql of [migration, reconciliation]) {
      expect(sql).toContain("public.festival_ticket_plans");
      expect(sql).toContain("tp.festival_edition_id = r.edition_id");
      expect(sql).toContain("coalesce(tp.currency_code, 'GBP')");
      expect(sql).toContain("'currencyCode', v_currency");
    }
  });

  it("requires currencyCode in the typed runtime projection", () => {
    const model = read("src/features/festivals/runtime/model.ts");
    expect(model).toContain("currencyCode: z.string().trim().length(3)");
  });

  it("formats live Festival sales using the server-provided runtime currency", () => {
    const controlRoom = read("src/features/festivals/runtime/FestivalLiveControlRoom.tsx");
    expect(controlRoom).toContain("const money = (minor: number, currencyCode: string)");
    expect(controlRoom).toContain("currency: currencyCode");
    expect(controlRoom).toContain("runtime.currencyCode");
    expect(controlRoom).not.toContain('currency: "GBP"');
  });
});
