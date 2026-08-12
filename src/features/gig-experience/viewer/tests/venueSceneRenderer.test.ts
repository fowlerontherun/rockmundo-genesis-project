import { describe, expect, it } from "vitest";
import { SCENE_LAYER_ORDER } from "../engine/VenueSceneRenderer";

describe("player-facing scene layers", () => {
  it("keeps environments, architecture, entities, effects and UI in the intended order", () => {
    expect(SCENE_LAYER_ORDER).toEqual(["environment", "architecture", "background-decorations", "stage-band", "crowd", "venue-activity", "foreground-effects", "viewer-interface"]);
  });
});
