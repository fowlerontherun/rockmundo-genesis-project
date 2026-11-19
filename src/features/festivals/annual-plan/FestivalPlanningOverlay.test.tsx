import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { FestivalAnnualPlan } from "./model";
import { FestivalPlanningOverlay } from "./FestivalPlanningOverlay";

const plan = {
  festivalCompanyId: "22222222-2222-4222-8222-222222222222",
  festivalScale: "medium",
  marketingEmphasis: "community",
  city: { name: "Southampton" },
  planningEffects: { potentialCapacity: 4000, licensedCapacity: 1200, capacityRestrictedByLicence: true },
  expectedCapacity: 4000,
  blockers: [{ code: "festival_licence_capacity_exceeded", message: "The chosen scale exceeds licence capacity." }],
  editable: true,
  canWrite: true,
} as FestivalAnnualPlan;

const show = (values: Partial<FestivalAnnualPlan> = {}, unsavedChanges = false, onOpenSection = vi.fn()) => {
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <FestivalPlanningOverlay plan={{ ...plan, ...values }} unsavedChanges={unsavedChanges} onOpenSection={onOpenSection} />
    </MemoryRouter>,
  );
  return onOpenSection;
};

describe("SVG owner planning overview", () => {
  it("uses server-calculated licensed and potential capacities, with a real upgrade route", () => {
    show();
    expect(screen.getAllByText(/1,200 usable/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Potential capacity: 4,000/)).toBeInTheDocument();
    expect(screen.getByText("The chosen scale exceeds licence capacity.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review Festival licence" })).toHaveAttribute("href", `/festival-company/${plan.festivalCompanyId}/upgrades`);
    expect(screen.getByText(/not an approved site map/)).toBeInTheDocument();
  });

  it("supports keyboard hotspot selection and navigates to the appropriate planning choice", () => {
    const onOpenSection = show();
    const map = screen.getByTestId("festival-owner-svg-plan");
    fireEvent.keyDown(within(map).getByRole("button", { name: "Inspect Stage production planning zone" }), { key: "Enter" });
    expect(screen.getByText(/Individual stage positions are not supplied/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review stage production" }));
    expect(onOpenSection).toHaveBeenCalledWith("festival");
    fireEvent.click(screen.getByRole("button", { name: "Arrival & travel" }));
    fireEvent.click(screen.getByRole("button", { name: "Review arrival & travel" }));
    expect(onOpenSection).toHaveBeenCalledWith("when");
  });

  it("marks saved-data projections stale while there are unsaved choices", () => {
    show({}, true);
    expect(screen.getByText(/You have unsaved Festival choices/)).toBeInTheDocument();
  });

  it("does not invent facility or stage counts and prevents editing a locked edition", () => {
    show({ editable: false, canWrite: false, expectedCapacity: null, planningEffects: {}, blockers: [] });
    expect(screen.getAllByText(/Not calculated/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Facilities & safety" }));
    expect(screen.getByText(/does not provide verified facility counts or positions/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stage production" }));
    expect(screen.getByRole("button", { name: "Review stage production" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Review Festival licence" })).toBeNull();
  });
});
