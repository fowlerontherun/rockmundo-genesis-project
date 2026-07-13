import { describe, expect, it } from "vitest";
import { buildVacancyPayload, sanitizeRecruitmentText, validateVacancyDraft } from "../services/recruitment";

describe("band recruitment service helpers", () => {
  it("sanitises executable html from vacancy copy", () => {
    expect(sanitizeRecruitmentText(" <script>alert(1)</script> Drummer ")).toBe("alert(1) Drummer");
  });

  it("validates required vacancy fields and question limits", () => {
    const errors = validateVacancyDraft({ title: "DJ", application_questions: new Array(9).fill({ type: "short_text" }) });
    expect(errors.title).toBeTruthy();
    expect(errors.application_questions).toBeTruthy();
  });

  it("builds stable safe payloads for draft or publish RPCs", () => {
    expect(buildVacancyPayload({ title: " <b>Lead Guitar</b> ", description: "No drama", genres: ["rock"] })).toMatchObject({ title: "Lead Guitar", genres: ["rock"] });
  });
});
