// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FestivalOwnerSalesPreview } from "./FestivalOwnerSalesPreview";

const mocks = vi.hoisted(() => ({
  launch: vi.fn(), publicFestival: vi.fn(), sales: vi.fn(), players: vi.fn(),
}));
vi.mock("../application/useFestivalLaunch", () => ({
  useFestivalLaunchPlan: mocks.launch,
  usePublicFestival: mocks.publicFestival,
  useFestivalSalesSummaryForLaunch: mocks.sales,
  useFestivalPlayerTicketSalesBreakdownForLaunch: mocks.players,
}));
const base = { isLoading: false, isError: false, refetch: vi.fn() };
const current = {
  id: "edition-2026", startsAt: "2026-08-01T12:00:00Z",
  lineup: [{ id: "band-a" }, { id: "band-b" }],
  ticketSales: { admissionTicketsSold: 42, admissionTicketsAvailable: 58, admissionTicketAllocation: 100 },
};
const display = (dates = ["2026-08-01"]) => render(
  <MemoryRouter><FestivalOwnerSalesPreview festivalCompanyId="company-1" festivalDates={dates}/></MemoryRouter>
);
describe("Festival owner sales preview behaviour", () => {
  beforeEach(() => {
    mocks.launch.mockReturnValue({ ...base, data: { launch: { launchStatus: "launched", publicSlug: "summer-fest" } } });
    mocks.publicFestival.mockReturnValue({ ...base, data: current });
    mocks.sales.mockReturnValue({ ...base, data: { grossMinor: 12345, orders: 8, currency: "GBP" } });
    mocks.players.mockReturnValue({ ...base, data: { ticketsSold: 7, orders: 4, uniqueBuyers: 3, byProduct: [] } });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("renders actual admission, gross and player figures with a lineup link", () => {
    display();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("58")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("£123.45")).toBeTruthy();
    expect(screen.getByText("Real player purchases")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Preview the complete public line-up" }).getAttribute("href")).toBeTruthy();
  });
  it("prevents a prior edition's sales from appearing", () => {
    const { container } = display(["2027-08-01"]);
    expect(container.textContent).not.toContain("Paid admissions sold");
    expect(mocks.sales).toHaveBeenCalledWith(undefined, undefined);
  });
  it("offers retry when launch data fails", () => {
    const refetch = vi.fn();
    mocks.launch.mockReturnValue({ ...base, isError: true, refetch });
    display();
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
  it("shows loading status while sales load", () => {
    mocks.sales.mockReturnValue({ ...base, isLoading: true });
    display();
    expect(screen.getByRole("status").textContent).toContain("Loading Festival ticket sales");
  });
});
