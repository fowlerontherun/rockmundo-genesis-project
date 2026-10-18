import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import MobileEducation from "./MobileEducation";

vi.mock("@/features/education/components/EducationOverviewTab", () => ({
  EducationOverviewTab: () => <div>Shared education overview</div>,
}));
vi.mock("@/features/education/components/EducationMySkillsTab", () => ({
  EducationMySkillsTab: () => <div>Shared skills catalogue</div>,
}));
vi.mock("@/features/education/components/EducationExploreTab", () => ({
  EducationExploreTab: () => <div>Shared books, university, videos and mentors</div>,
}));

const PathAndQuery = () => {
  const { pathname, search } = useLocation();
  return <output data-testid="education-path">{pathname + search}</output>;
};

describe("mobile education companion", () => {
  it("shows the shared learning overview and switches between skill and learning tabs", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={["/mobile/education"]}><MobileEducation /><PathAndQuery /></MemoryRouter>);
    expect(screen.getByText("Shared education overview")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /My Skills/i }));
    expect(screen.getByText("Shared skills catalogue")).toBeInTheDocument();
    expect(screen.getByTestId("education-path")).toHaveTextContent("/mobile/education?tab=skills");
    await user.click(screen.getByRole("tab", { name: /Find Learning/i }));
    expect(screen.getByText("Shared books, university, videos and mentors")).toBeInTheDocument();
    expect(screen.getByTestId("education-path")).toHaveTextContent("/mobile/education?tab=find");
  });

  it("preserves existing book/video/mentor deep links in the mobile find-learning screen", () => {
    render(<MemoryRouter initialEntries={["/mobile/education?tab=videos&skill=guitar_basics"]}><MobileEducation /><PathAndQuery /></MemoryRouter>);
    expect(screen.getByText("Shared books, university, videos and mentors")).toBeInTheDocument();
    expect(screen.getByTestId("education-path")).toHaveTextContent("tab=videos&skill=guitar_basics");
  });
});
