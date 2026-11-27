import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EducationLearningActions } from "./EducationLearningActions";

const renderActions = (isMobile: boolean, canTeach: boolean, certificatesEarned = 0) =>
  render(<MemoryRouter><EducationLearningActions
    isMobile={isMobile}
    canTeach={canTeach}
    certificatesEarned={certificatesEarned}
  /></MemoryRouter>);

describe("simple learning actions", () => {
  it("links desktop players directly to practice, rehearsal and mastery", () => {
    renderActions(false, true, 2);
    expect(screen.getByRole("link", { name: /start practice/i }).getAttribute("href")).toBe("/stage-practice");
    expect(screen.getByRole("link", { name: /manage rehearsals/i }).getAttribute("href")).toBe("/rehearsals");
    expect(screen.getByRole("link", { name: /view specialisations/i }).getAttribute("href")).toBe("/skills?tab=mastery");
    expect(screen.getByRole("link", { name: /teach or find a mentor/i }).getAttribute("href")).toBe("/education?tab=find&method=players");
    expect(screen.getByText(/2 completed university courses/i)).toBeTruthy();
  });

  it("keeps mobile players within supported mobile routes", () => {
    renderActions(true, false);
    expect(screen.queryByRole("link", { name: /start practice/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /manage rehearsals/i })).toBeNull();
    expect(screen.getByRole("link", { name: /find a mentor/i }).getAttribute("href")).toBe("/mobile/education?tab=find&method=players");
    expect(screen.getByRole("link", { name: /explore courses/i }).getAttribute("href")).toBe("/mobile/education?tab=find&method=university");
    expect(screen.getByText(/at skill level 5/i)).toBeTruthy();
  });
});
