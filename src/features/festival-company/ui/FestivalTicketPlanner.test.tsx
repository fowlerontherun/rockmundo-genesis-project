import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useFestivalSitePlan } from "../application/useFestivalSitePlan";
import { useFestivalTicketPlan, useSaveFestivalTicketPlan } from "../application/useFestivalTicketPlan";
import { FestivalTicketPlanner } from "./FestivalTicketPlanner";

vi.mock("../application/useFestivalSitePlan", () => ({ useFestivalSitePlan: vi.fn() }));
vi.mock("../application/useFestivalTicketPlan", () => ({
  useFestivalTicketPlan: vi.fn(),
  useSaveFestivalTicketPlan: vi.fn(),
}));

describe("festival owner ticket load recovery", () => {
  const refetch = vi.fn();
  beforeEach(() => {
    refetch.mockReset();
    vi.mocked(useFestivalSitePlan).mockReturnValue({
      isLoading: false, isError: false, data: { ready: true },
    } as ReturnType<typeof useFestivalSitePlan>);
    vi.mocked(useFestivalTicketPlan).mockReturnValue({
      isLoading: false, isError: true, data: undefined, refetch,
    } as unknown as ReturnType<typeof useFestivalTicketPlan>);
    vi.mocked(useSaveFestivalTicketPlan).mockReturnValue({
      isPending: false,
    } as ReturnType<typeof useSaveFestivalTicketPlan>);
  });

  it("shows a retry action instead of a misleading empty ticket plan", () => {
    render(<FestivalTicketPlanner festivalCompanyId="company-one" festivalEditionId="edition-one" />);
    expect(screen.getByRole("alert").textContent).toContain("Ticket choices could not be loaded");
    fireEvent.click(screen.getByRole("button", { name: "Retry ticket choices" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
