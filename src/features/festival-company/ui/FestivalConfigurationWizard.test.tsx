import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FestivalConfigurationWizard } from "./FestivalConfigurationWizard";

const mocks = vi.hoisted(() => ({ query: vi.fn(), mutate: vi.fn(), branding: vi.fn() }));
vi.mock("../application/useFestivalConfiguration", () => ({
  useFestivalConfiguration: () => mocks.query(),
  useSaveFestivalConfiguration: () => ({ mutate: mocks.mutate, isPending: false, isError: false }),
}));
vi.mock("../data/festivalBrandingRepository", () => ({ saveFestivalBranding: mocks.branding }));

const company = "22222222-2222-4222-8222-222222222222";
const edition = "33333333-3333-4333-8333-333333333333";
const city = "44444444-4444-4444-8444-444444444444";
const config = {
  publicName: "Shock Festival", legalCompanyName: "Shock Ltd", shortName: "Shock", tagline: "", description: "",
  homeCity: { id: city, name: "London", country: "UK" }, festivalScale: "local", plannedStartDate: "2030-06-10",
  configurationVersion: 3, canWrite: true, vibe: "community", siteType: "outdoor", environmentalPolicy: "standard",
  cities: [{ id: city, name: "London", country: "UK" }],
  scales: [{ key: "local", displayName: "Local", minimumCapacity: 100, maximumCapacity: 1000, maximumDurationDays: 3 }],
  vibes: [{ key: "community", displayName: "Community", description: "" }],
  siteTypes: [{ key: "outdoor", displayName: "Outdoor", description: "" }],
  environmentalPolicies: [{ key: "standard", displayName: "Standard", description: "" }],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.query.mockReturnValue({ data: config, isLoading: false, isError: false });
  mocks.branding.mockResolvedValue({ theme: "indie", motif: "stripes", version: 1 });
});

describe("guided festival founding", () => {
  it("creates the edition once, then saves chosen colours against that edition", async () => {
    render(<MemoryRouter><FestivalConfigurationWizard festivalCompanyId={company} /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText("Tagline"), { target: { value: "Loud in London" } });
    fireEvent.click(screen.getByRole("button", { name: /British Indie/ }));
    fireEvent.click(screen.getByRole("button", { name: "Stripes" }));
    for (let i=0; i<4; i++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Festival & start planning" }));
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(mocks.mutate.mock.calls[0][0]).toEqual(expect.objectContaining({
      expectedVersion: 3,
      configuration: expect.objectContaining({ publicName: "Shock Festival", tagline: "Loud in London", plannedStartDate: "2030-06-10", complete: true }),
    }));
    await act(async () => { await mocks.mutate.mock.calls[0][1].onSuccess({ festivalEditionId: edition }); });
    await waitFor(() => expect(mocks.branding).toHaveBeenCalledWith(company, edition, { theme: "indie", motif: "stripes", version: 0 }));
  });
  it("does not allow a read-only character to create an edition", () => {
    mocks.query.mockReturnValue({ data: { ...config, canWrite: false }, isLoading: false, isError: false });
    render(<MemoryRouter><FestivalConfigurationWizard festivalCompanyId={company} /></MemoryRouter>);
    for (let i=0; i<4; i++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Festival & start planning" }));
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});