import { beforeEach, describe, expect, it } from "vitest";
import { consumePersonalSceneRecap, personalSceneRecap, storePersonalSceneRecap } from "./sceneRecap";

beforeEach(() => sessionStorage.clear());
describe("private-safe scene recap handoff", () => {
  it("only offers recaps for ended scenes", () => {
    expect(personalSceneRecap("open")).toBeNull();
    expect(() => storePersonalSceneRecap("host", "open")).toThrow();
    expect(personalSceneRecap("ended")).toBe("Another chapter in my music career. #Rockmundo #Roleplay");
  });
  it("does not hand one character's recap to a sibling", () => {
    storePersonalSceneRecap("host", "ended");
    expect(consumePersonalSceneRecap("sibling")).toBeNull();
  });
  it("consumes a valid draft exactly once", () => {
    storePersonalSceneRecap("host", "ended");
    expect(consumePersonalSceneRecap("host")).toBe(personalSceneRecap("ended"));
    expect(consumePersonalSceneRecap("host")).toBeNull();
  });
  it("ignores malformed saved drafts", () => {
    sessionStorage.setItem("rockmundo-personal-scene-recap", "invalid");
    expect(consumePersonalSceneRecap("host")).toBeNull();
  });
});