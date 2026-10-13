import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../../", import.meta.url);
const source = (path: string) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");

describe("previously fixed gameplay integrity regressions", () => {
  it("#2911 scopes solo demo songs and submissions to the active character", () => {
    const code = source("src/components/labels/SubmitDemoDialog.tsx");
    expect(code).toContain('const { profileId } = useActiveProfile()');
    expect(code).toContain('query = query.eq("profile_id", profileId)');
    expect(code).toContain('query = query.eq("artist_profile_id", profileId)');
    expect(code).toContain("artist_profile_id: effectiveBandId ? null : profileId");
  });

  it("#2813 sells properties through an atomic server operation", () => {
    const code = source("src/hooks/useHousing.ts");
    const start = code.indexOf("export function useSellProperty()");
    const end = code.indexOf("export function useToggleRentOut()", start);
    expect(start).toBeGreaterThanOrEqual(0);
    const sale = code.slice(start, end);
    expect(sale).toContain('rpc("sell_player_property_atomic"');
    expect(sale).not.toContain('.from("player_properties").delete()');
    expect(sale).not.toContain('.update({ cash:');
  });

  it("#2723 shows a retryable error on failed primary-band lookup", () => {
    const code = source("src/features/player-model/BandMerchWardrobe.tsx");
    expect(code).toContain("if (merch.band.isError)");
    expect(code).toContain("merch.band.refetch()");
    expect(code.indexOf("if (merch.band.isError)")).toBeLessThan(code.indexOf("if (!merch.band.data)"));
  });

  it("#2699 does not promise a client-calculated gear sell-back price", () => {
    const code = source("src/pages/InventoryManager.tsx");
    expect(code).toContain("The final refund is calculated by the server");
    expect(code).toContain("result.refund");
    expect(code).not.toMatch(/Math\.floor\(\s*\(g\.purchase_cost\s*\?\?\s*0\)\s*\/\s*2\s*\)/);
  });

  it("#2683 filters tours before calculating counts and page slices", () => {
    const code = source("src/pages/TourManager.tsx");
    expect(code).toContain("const totalCount = tours.length;");
    expect(code).toContain("return { tours: tours.slice(from, from + OTHER_TOURS_PER_PAGE), totalCount }");
    const countIndex = code.indexOf("const totalCount = tours.length;");
    expect(code.lastIndexOf('if (genreFilter !== "all")', countIndex)).toBeGreaterThanOrEqual(0);
    expect(code.lastIndexOf('if (fameFilter !== "all")', countIndex)).toBeGreaterThanOrEqual(0);
  });
});
