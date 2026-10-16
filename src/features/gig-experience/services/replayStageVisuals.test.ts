import { describe, expect, it } from "vitest";
import { defaultAppearance } from "@/features/player-model/appearance";
import { resolveStoredGigStageVisuals } from "./replayStageVisuals";

const guitarist = "ab000000-0000-4000-8000-000000000001";
const drummer = "ab000000-0000-4000-8000-000000000002";
const pumpkinId = "ab000000-0000-4000-8000-000000000003";
const costume = {
  item: {
    id: pumpkinId,
    category: "hat",
    name: "Haunted Pumpkin Hat 2026",
    wearable_slot: "headwear",
    curated_asset_key: "clothing.halloween.2026.pumpkin-hat",
    render_config: { headwearStyle: "pumpkin" },
    material_config: { primaryColor: "#ef811f" },
  },
  selectedVariantKey: null,
  customizationConfig: {},
};
const appearance = defaultAppearance();

describe("authoritative archived stage visuals", () => {
  it("recreates exactly the saved hat and avatar rather than fetching wardrobe again", () => {
    const immutable = {
      version: 1,
      performers: [
        { profile_id: guitarist, visual_snapshot: { version: 1, appearance, legacy: null, clothing: [costume] } },
        { profile_id: drummer, visual_snapshot: { version: 1, appearance: { ...appearance, body: { ...appearance.body, frame: "feminine" } }, clothing: [] } },
      ],
    };
    const saved = resolveStoredGigStageVisuals(immutable);
    expect(saved?.appearances[guitarist].body.frame).toBe("masculine");
    expect(saved?.appearances[drummer].body.frame).toBe("feminine");
    expect(saved?.richClothing[guitarist]).toHaveLength(1);
    expect(saved?.richClothing[guitarist][0].item.curated_asset_key).toBe("clothing.halloween.2026.pumpkin-hat");
    expect(saved?.richClothing[drummer]).toHaveLength(0);
    // Changing the current costume fixture does not modify the frozen data.
    const currentWardrobe = [];
    expect(currentWardrobe).toHaveLength(0);
    expect(saved?.richClothing[guitarist]).toHaveLength(1);
  });

  it("gracefully supports legacy avatar configurations without a saved V1 appearance", () => {
    const saved = resolveStoredGigStageVisuals({ version: 1, performers: [{
      profile_id: drummer, visual_snapshot: {
        version: 1, appearance: null, legacy: { profile_id: drummer, gender: "female", hair_color: "#220011" }, clothing: [],
      },
    }] });
    expect(saved?.appearances[drummer]).toBeDefined();
    expect(saved?.richClothing[drummer]).toEqual([]);
  });

  it.each([
    null, [], {}, { version: 2, performers: [] }, { version: 1, performers: [] },
    { version: 1, performers: [{ profile_id: "not-a-uuid", visual_snapshot: { version: 1, clothing: [] } }] },
    { version: 1, performers: [{ profile_id: guitarist, visual_snapshot: { version: 1, clothing: "oops" } }] },
    { version: 1, performers: [{ profile_id: guitarist, visual_snapshot: { version: 1, clothing: [{ item: { id: "bad" } }] } }] },
    { version: 1, performers: Array.from({length: 51}, (_,i) => ({profile_id: String(i), visual_snapshot: {version:1,clothing:[]}})) },
    { version: 1, performers: [
      { profile_id: guitarist, visual_snapshot: { version:1,clothing:[] } },
      { profile_id: guitarist, visual_snapshot: { version:1,clothing:[] } },
    ] },
  ])("rejects malformed or cross-player replay costume evidence", (value) => {
    expect(resolveStoredGigStageVisuals(value)).toBeNull();
  });
});
