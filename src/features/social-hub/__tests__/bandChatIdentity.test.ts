import { describe, expect, it } from "vitest";
import { bandChatPayload, isOwnBandMessage } from "../services/bandChatIdentity";

describe("band chat author identity", () => {
  it("keeps account and character IDs in their separate columns", () => {
    expect(bandChatPayload("band", { userId: "account", profileId: "character" }, " hello ")).toEqual({
      band_id: "band", user_id: "account", profile_id: "character", message: "hello",
    });
  });
  it("does not attribute sibling or unscoped messages to the active character", () => {
    expect(isOwnBandMessage({ profile_id: "sibling" }, "character")).toBe(false);
    expect(isOwnBandMessage({ profile_id: null }, "character")).toBe(false);
    expect(isOwnBandMessage({ profile_id: "character" }, "character")).toBe(true);
  });
  it("rejects signed-out or characterless sends", () => {
    expect(() => bandChatPayload("band", { userId: null, profileId: "character" }, "hello")).toThrow();
    expect(() => bandChatPayload("band", { userId: "account", profileId: null }, "hello")).toThrow();
  });
});