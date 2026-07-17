import { describe, expect, it } from "vitest";
import { defaultFestivalCreationDraft, hasCreationErrors, stagePreset, validateFestivalCreationDraft } from "../creationValidation";

describe("festival creation validation", () => {
  it("requires festival identity fields", () => {
    const draft = defaultFestivalCreationDraft("create_festival");
    expect(validateFestivalCreationDraft(draft).identity).toContain("Festival name is required.");
  });

  it("accepts a complete future draft and keeps stable idempotency", () => {
    const draft = defaultFestivalCreationDraft("create_festival");
    draft.identity.name = "Test Fest";
    draft.identity.shortDescription = "Short";
    draft.identity.fullDescription = "Full";
    draft.identity.primaryGenres = ["Rock"];
    draft.edition.title = "Test Fest 2027";
    draft.location.cityId = "city-1";
    const key = draft.idempotencyKey;
    expect(hasCreationErrors(validateFestivalCreationDraft(draft))).toBe(false);
    expect(draft.idempotencyKey).toBe(key);
  });

  it("rejects invalid dates, ticket ranges and duplicate stages", () => {
    const draft = defaultFestivalCreationDraft("create_festival");
    draft.identity.name = "Bad Fest";
    draft.identity.shortDescription = "Short";
    draft.identity.fullDescription = "Full";
    draft.identity.primaryGenres = ["Rock"];
    draft.edition.title = "Bad Fest";
    draft.edition.endAt = draft.edition.startAt;
    draft.location.cityId = "city-1";
    draft.location.minTicketPriceCents = 9000;
    draft.location.maxTicketPriceCents = 1000;
    draft.stages = [stagePreset("small", 1000)[0], stagePreset("small", 1000)[0]];
    const errors = validateFestivalCreationDraft(draft);
    expect(errors.edition).toContain("End must be after start.");
    expect(errors.location).toContain("Minimum ticket price cannot exceed maximum ticket price.");
    expect(errors.stages).toContain("Stage names must be unique within the event.");
  });

  it("populates stage presets", () => {
    expect(stagePreset("small", 1000)).toHaveLength(1);
    expect(stagePreset("medium", 1000).map((stage) => stage.name)).toEqual(["Main Stage", "Second Stage"]);
    expect(stagePreset("large", 1000).map((stage) => stage.name)).toEqual(["Main Stage", "Second Stage", "New Music Stage"]);
  });
});
