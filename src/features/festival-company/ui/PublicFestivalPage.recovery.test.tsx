import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PublicFestivalPage from "./PublicFestivalPage";

const mocks = vi.hoisted(() => ({ profileId: "a" as string | null, festival: vi.fn(), wallet: vi.fn(), purchase: vi.fn() }));
vi.mock("@/hooks/useActiveProfile", () => ({ useActiveProfile: () => ({ profileId: mocks.profileId }) }));
vi.mock("@/hooks/use-auth-context", () => ({ useAuth: () => ({ user: { id: "account" } }) }));
vi.mock("../data/festivalCompanyRepository", () => ({
  getPublicFestival: mocks.festival, getMyFestivalTickets: mocks.wallet, purchaseFestivalTickets: mocks.purchase,
  ...Object.fromEntries(["saveFestivalPublicProfile", "beginFestivalLaunchReview", "launchFestival", "openFestivalTicketSales",
    "pauseFestivalTicketSales", "resumeFestivalTicketSales", "closeFestivalTicketSales", "issueFestivalComplimentaryTickets",
    "cancelLaunchedFestival"].map(name => [name, vi.fn()])),
}));
vi.mock("../attendance/useFestivalAttendance", () => ({
  useMyFestivalAttendance: () => ({ data: [], isPending: false }),
  useMyFestivalCheckInEligibility: () => ({ data: [], isPending: false }),
  useMyFestivalMemorabilia: () => ({ data: [], isPending: false }),
  useCheckInToFestival: () => ({ isPending: false }), useLeaveFestivalEarly: () => ({ isPending: false }),
}));
vi.mock("./FestivalGrounds", () => ({
  FestivalGrounds: ({ onViewTimetable }: { onViewTimetable: () => void }) =>
    <button type="button" onClick={onViewTimetable}>Grounds timetable shortcut</button>,
}));
vi.mock("@/features/shareable-moments/ShareMomentSheet", () => ({ ShareMomentSheet: () => null }));
vi.mock("@/features/shareable-moments/referralDestination", () => ({ referralAwareDestination: vi.fn() }));
const festival = {
  id: "launch", editionId: "edition", slug: "festival", name: "Recovery Festival", description: "Published festival",
  city: "London", country: "UK", timezone: "Europe/London", startsAt: "2099-06-01T12:00:00Z",
  endsAt: "2099-06-03T23:00:00Z", countdownTarget: "2099-06-01T12:00:00Z", launchStatus: "tickets_on_sale",
  stages: [], lineup: [], sponsors: [], information: {},
  ticketProducts: [{ id: "product", name: "Weekend admission", productClass: "admission", totalMinor: 2000,
    currency: "GBP", accessStartDate: "2099-06-01", accessEndDate: "2099-06-03", availableQuantity: 10,
    purchaseLimit: 4, saleStatus: "tickets_on_sale" }],
};
const ticket = { id: "ticket", festivalSlug: "festival", ticketReference: "CHARACTER-A-TICKET", ticketType: "weekend", productClass: "admission", status: "valid" };
let client: QueryClient;
const page = (entry = "/world/festivals/festival") => <MemoryRouter initialEntries={[entry]}><QueryClientProvider client={client}><PublicFestivalPage publicSlug="festival" /></QueryClientProvider></MemoryRouter>;
const openWallet = async () => { fireEvent.click(await screen.findByRole("button", { name: /My tickets/ })); return screen.findByRole("tabpanel", { name: "Tickets" }); };
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.profileId = "a"; mocks.festival.mockResolvedValue(festival); mocks.wallet.mockResolvedValue([]); mocks.purchase.mockResolvedValue({ tickets: [ticket] });
});
afterEach(() => { cleanup(); client.clear(); vi.clearAllMocks(); });
describe("public festival recovery with real query hooks", () => {
  it("offers a verified ticket shortcut and moves keyboard focus to the selected section", async () => {
    render(page());
    fireEvent.click(await screen.findByRole("button", { name: "See tickets and prices" }));
    expect(await screen.findByRole("tabpanel", { name: "Tickets" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Tickets" })).toHaveFocus();
  });
  it("opens a directly linked festival section without requiring desktop-sized navigation", async () => {
    render(page("/world/festivals/festival?tab=information&ref=friend"));
    expect(await screen.findByRole("tabpanel", { name: "Information" })).toBeVisible();
    expect(screen.getByRole("tablist", { name: "Festival sections" })).toBeInTheDocument();
  });
  it("moves keyboard focus from Grounds into Timetable instead of losing it when the panel unmounts", async () => {
    render(page("/world/festivals/festival?tab=grounds"));
    fireEvent.click(await screen.findByRole("button", { name: "Grounds timetable shortcut" }));
    expect(await screen.findByRole("tabpanel", { name: "Timetable" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Timetable" })).toHaveFocus();
  });
  it("moves keyboard focus from the visitor guide's ticket shortcut", async () => {
    render(page("/world/festivals/festival?tab=information"));
    const information = await screen.findByRole("tabpanel", { name: "Information" });
    fireEvent.click(within(information).getByText("Tickets & refunds", { selector: "span" }));
    fireEvent.click(within(information).getByRole("button", { name: "Review tickets" }));
    expect(await screen.findByRole("tabpanel", { name: "Tickets" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Tickets" })).toHaveFocus();
  });
  it("moves keyboard focus from the visitor guide's timetable shortcut", async () => {
    render(page("/world/festivals/festival?tab=information"));
    const guide = await screen.findByRole("tabpanel", { name: "Information" });
    fireEvent.click(within(guide).getByText("Opening times", { selector: "span" }));
    fireEvent.click(within(guide).getByRole("button", { name: "View the published timetable" }));
    expect(await screen.findByRole("tabpanel", { name: "Timetable" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Timetable" })).toHaveFocus();
  });
  it("does not advertise available tickets after the edition is cancelled", async () => {
    mocks.festival.mockResolvedValue({ ...festival, launchStatus: "cancelled_before_event" });
    render(page());
    expect(await screen.findByRole("button", { name: "Explore the line-up" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "See tickets and prices" })).not.toBeInTheDocument();
  });
  it("retries failed detail reads instead of presenting not-found", async () => {
    mocks.festival.mockRejectedValueOnce(new Error("network")); render(page());
    expect(await screen.findByText("Festival details could not be loaded.")).toBeVisible();
    expect(screen.queryByText("Festival not found.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse other festivals" })).toHaveAttribute("href", "/world/festivals");
    fireEvent.click(screen.getByRole("button", { name: "Retry festival details" }));
    expect(await screen.findByRole("heading", { name: "Recovery Festival" })).toBeVisible();
  });
  it("offers the canonical directory without suggesting that a missing festival can be purchased", async () => {
    mocks.festival.mockResolvedValue(null);
    render(page());
    expect(await screen.findByText("Festival not found.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Browse other festivals" })).toHaveAttribute("href", "/world/festivals");
    expect(screen.queryByRole("button", { name: "Confirm purchase" })).not.toBeInTheDocument();
  });
  it("hides cached tickets on failed verification, then recovers on retry", async () => {
    mocks.wallet.mockResolvedValue([ticket]); render(page()); const wallet = await openWallet();
    expect(await within(wallet).findByText(ticket.ticketReference)).toBeVisible();
    mocks.wallet.mockRejectedValueOnce(new Error("network"));
    await act(async () => { await client.invalidateQueries({ queryKey: ["festival-ticket-wallet"] }); });
    expect(await within(wallet).findByText(/this does not mean you have no tickets/)).toBeVisible();
    expect(within(wallet).queryByText(ticket.ticketReference)).not.toBeInTheDocument();
    expect(within(wallet).queryByText(/You do not have tickets/)).not.toBeInTheDocument();
    fireEvent.click(within(wallet).getByRole("button", { name: "Retry ticket wallet" }));
    expect(await within(wallet).findByText(ticket.ticketReference)).toBeVisible();
  });
  it("distinguishes a switched character's pending wallet from an empty wallet", async () => {
    mocks.wallet.mockResolvedValueOnce([ticket]); const { rerender } = render(page()); const wallet = await openWallet();
    expect(await within(wallet).findByText(ticket.ticketReference)).toBeVisible();
    let resolve!: (tickets: unknown[]) => void;
    mocks.wallet.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    mocks.profileId = "b"; rerender(page());
    expect(within(wallet).queryByText(ticket.ticketReference)).not.toBeInTheDocument();
    expect(within(wallet).getByText("Verifying your tickets for this character…")).toBeVisible();
    expect(within(wallet).queryByText(/You do not have tickets/)).not.toBeInTheDocument();
    await act(async () => resolve([]));
    expect(await within(wallet).findByText(/You do not have tickets for this festival yet/)).toBeVisible();
  });
  it("clears purchase confirmation and quantity on character change", async () => {
    const { rerender } = render(page()); const wallet = await openWallet();
    fireEvent.change(within(wallet).getByRole("spinbutton"), { target: { value: "3" } });
    fireEvent.click(within(wallet).getByRole("button", { name: "Confirm purchase" }));
    expect(await within(wallet).findByText(/Purchase complete/)).toBeVisible();
    mocks.profileId = "b"; rerender(page());
    await waitFor(() => expect(within(wallet).queryByText(/Purchase complete/)).not.toBeInTheDocument());
    expect(within(wallet).getByRole("spinbutton")).toHaveValue(1);
  });
  it("does not claim zero tickets without a selected character", async () => {
    mocks.profileId = null; render(page());
    const shortcut = await screen.findByRole("button", { name: /My tickets/ });
    expect(shortcut).toHaveTextContent("—"); expect(shortcut).toHaveTextContent("Select a character");
    const wallet = await openWallet();
    expect(within(wallet).getByText("Select an active character to view their festival tickets.")).toBeVisible();
    expect(mocks.wallet).not.toHaveBeenCalled();
    expect(within(wallet).getByRole("button", { name: "Select a character" })).toBeDisabled();
  });
});
