import { describe, expect, it } from "vitest";
import { buildInstrument } from "./instruments";

describe("Top of the Pops performer props", () => {
  it("exposes a handheld microphone for pure vocalists", () => {
    const rig = buildInstrument("vocal_performance");
    expect(rig.root.getObjectByName("playing-handheld-microphone")).toBeTruthy();
  });

  it("gives a drum kit two visible drumsticks", () => {
    const rig = buildInstrument("rock_drums");
    const sticks = rig.tools.filter((tool) => tool.name === "playing-stick");
    expect(sticks).toHaveLength(2);
    expect(sticks.every((stick) => stick.children.length > 0)).toBe(true);
  });
});
