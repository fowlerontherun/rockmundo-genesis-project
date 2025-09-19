import { beforeAll, describe, expect, it } from "bun:test";

type EvaluateProfileCompletion = typeof import("../profileCompletion") extends infer Module
  ? Module extends { evaluateProfileCompletion: infer Fn }
    ? Fn
    : never
  : never;

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
  key: (index: number) => string | null;
  length: number;
};

let evaluateProfileCompletion: EvaluateProfileCompletion;

beforeAll(async () => {
  (globalThis as unknown as { localStorage: StorageLike }).localStorage ??= {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } satisfies StorageLike;

  ({ evaluateProfileCompletion } = await import("../profileCompletion"));
});

describe("evaluateProfileCompletion", () => {
  const baseProfile = {
    id: "profile-123",
    username: "rocker123",
    display_name: "Rock Legend",
    avatar_url: "https://example.com/avatar.png",
    bio: "Ready to take the stage.",
  };

  const zeroedSkills = {
    id: "skills-123",
    guitar: 0,
    vocals: 0,
    drums: 0,
    bass: 0,
    performance: 0,
    songwriting: 0,
    composition: 0,
  };

  it("treats zero-valued skills as complete when identity fields are filled", () => {
    const result = evaluateProfileCompletion("user-123", baseProfile, zeroedSkills);

    expect(result.isComplete).toBe(true);
  });

  it("requires a profile row before considering the account complete", () => {
    const result = evaluateProfileCompletion("user-123", null, zeroedSkills);

    expect(result.isComplete).toBe(false);
  });

  it("requires an avatar and bio to mark a profile complete", () => {
    const result = evaluateProfileCompletion("user-123", {
      ...baseProfile,
      avatar_url: "",
    }, zeroedSkills);

    expect(result.isComplete).toBe(false);
  });
});
