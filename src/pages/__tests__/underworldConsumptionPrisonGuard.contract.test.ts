import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(new URL("../../../supabase/production-repairs/20261015_underworld_consumption_persisted_prison_guard.sql", import.meta.url)),
  "utf8",
);

describe("underworld jailed-character consumption guard", () => {
  it("checks authoritative prison sentences in addition to the profile flag", () => {
    expect(sql).toContain("is_imprisoned IS FALSE");
    expect(sql).toContain("FROM public.player_imprisonments i");
    expect(sql).toContain("i.status='imprisoned'");
    expect(sql).toContain("UNDERWORLD_CONSUME_IMPRISONED");
    expect(sql.indexOf("UNDERWORLD_CONSUME_IMPRISONED")).toBeLessThan(
      sql.indexOf("SELECT * INTO v_purchase"),
    );
  });

  it("preserves the canonical single-use and reward-schema barriers", () => {
    expect(sql).toContain("UNDERWORLD_LEGACY_ITEM_REQUIRES_REVIEW");
    expect(sql).toContain("UNDERWORLD_FROZEN_EFFECTS_INVALID");
    expect(sql).toContain("quantity=quantity-1,is_used=(quantity-1=0)");
    expect(sql).toContain("FROM PUBLIC,anon,authenticated");
  });
});
