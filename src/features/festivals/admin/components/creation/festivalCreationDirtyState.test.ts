import { describe, expect, it } from "vitest";
import { defaultFestivalCreationDraft } from "../../creationValidation";
import { isFestivalCreationDraftDirty } from "./festivalCreationDirtyState";

describe("isFestivalCreationDraftDirty", () => {
  it("ignores technical idempotency keys", () => {
    const initial = defaultFestivalCreationDraft("create_festival");
    const current = { ...initial, idempotencyKey: crypto.randomUUID() };
    expect(isFestivalCreationDraftDirty(initial, current)).toBe(false);
  });

  it("detects material edits", () => {
    const initial = defaultFestivalCreationDraft("create_festival");
    const current = {
      ...initial,
      identity: { ...initial.identity, name: "New Festival" },
    };
    expect(isFestivalCreationDraftDirty(initial, current)).toBe(true);
  });

  it("treats a discarded or successful snapshot as clean", () => {
    const initial = defaultFestivalCreationDraft("add_edition", "festival-1");
    const edited = {
      ...initial,
      edition: { ...initial.edition, title: "Autumn Edition" },
    };
    expect(isFestivalCreationDraftDirty(edited, edited)).toBe(false);
  });
});
