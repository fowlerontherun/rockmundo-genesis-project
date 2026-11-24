import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MobileFestivals, { MobileFestivalPublishedGuide } from "./MobileFestivals";

const mocks = vi.hoisted(() => ({ directory: vi.fn(), detail: vi.fn(), retry: vi.fn() }));
vi.mock("@/features/festival-company/application/useFestivalLaunch", () => ({
  usePublicFestivalDirectory: () => mocks.directory(),
  usePublicFestival: () => mocks.detail(),
}));
vi.mock("@/features/festival-company/ui/FestivalBrandArtwork", () => ({ FestivalBrandArtwork: () => null }));
vi.mock("../components/MobilePrimitives", () => ({
  MobileSectionHeader: ({ title, description }: { title: string; description: string }) => <header><h1>{title}</h1><p>{description}</p></header>,
}));

const edition = {
  id: "edition-1", slug: "london-summer", name: "London Summer", city: "London", country: "UK", timezone: "Europe/London",
  startsAt: "2099-07-01T12:00:00Z", endsAt: "2099-07-02T23:00:00Z", launchStatus: "tickets_on_sale",
  description: "A published festival", tagline: "Summer music", lineup: [
    { id: "confirmed", artistName: "The Verified", stageName: "Main stage", startsAt: "2099-07-01T20:00:00Z", endsAt: "2099-07-01T21:00:00Z" },
    { id: "unpublished", artistName: "Private slot", stageName: null, startsAt: null, endsAt: null },
  ],
  information: { accessibility: "Step-free viewing available", travel: "Take the train" },
};
const view = (entry = "/mobile/festivals") => render(
  <MemoryRouter initialEntries={[entry]}><Routes>
    <Route path="/mobile/festivals" element={<MobileFestivals />} />
    <Route path="/mobile/festivals/:festivalCompanyIdentifier" element={<MobileFestivalPublishedGuide />} />
  </Routes></MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.directory.mockReturnValue({ data: [edition], isPending: false, isError: false, refetch: mocks.retry });
  mocks.detail.mockReturnValue({ data: edition, isPending: false, isError: false, refetch: mocks.retry });
});

describe("festival mobile companion read-only experience", () => {
  it("navigates from the public directory to the same edition-scoped festival view", () => {
    view();
    expect(screen.getByRole("heading", { name: "Festivals" })).toBeVisible();
    fireEvent.click(screen.getByRole("link", { name: /London Summer/ }));
    expect(screen.getByRole("article", { name: "London Summer festival details" })).toBeVisible();
    expect(screen.getByText("Step-free viewing available")).toBeVisible();
  });
  it("shows only actually published stage performances and makes no payment claim", () => {
    view("/mobile/festivals/london-summer");
    expect(screen.getByText("The Verified")).toBeVisible();
    expect(screen.queryByText("Private slot")).not.toBeInTheDocument();
    expect(screen.getByText(/Purchases are not available in the mobile companion/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /purchase|check in/i })).not.toBeInTheDocument();
  });
  it("labels sold-out tickets honestly even when the sales lifecycle says on sale", () => {
    mocks.detail.mockReturnValue({ data: { ...edition, soldOut: true }, isPending: false, isError: false, refetch: mocks.retry });
    view("/mobile/festivals/london-summer");
    expect(screen.getByText("Sold out")).toBeVisible();
    expect(screen.queryByText("On sale")).not.toBeInTheDocument();
  });
  it("distinguishes errors and empty states, with a retry action", () => {
    mocks.directory.mockReturnValue({ data: [], isPending: false, isError: true, refetch: mocks.retry });
    const mounted = view();
    expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry festivals" }));
    expect(mocks.retry).toHaveBeenCalledTimes(1);
    mocks.directory.mockReturnValue({ data: [], isPending: false, isError: false, refetch: mocks.retry });
    mounted.rerender(<MemoryRouter initialEntries={["/mobile/festivals"]}><Routes><Route path="/mobile/festivals" element={<MobileFestivals />} /></Routes></MemoryRouter>);
    expect(screen.getByText("No public festival editions are currently announced.")).toBeVisible();
  });
  it("never presents an unverified edition as not found", () => {
    mocks.detail.mockReturnValue({ data: undefined, isPending: false, isError: true, refetch: mocks.retry });
    view("/mobile/festivals/london-summer");
    expect(screen.getByRole("alert")).toHaveTextContent("could not be verified");
    expect(screen.queryByText("Festival not found.")).not.toBeInTheDocument();
  });
});
