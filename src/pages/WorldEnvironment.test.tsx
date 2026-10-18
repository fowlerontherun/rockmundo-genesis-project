import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorldEnvironment from "./WorldEnvironment";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  profile: { id: "character-1", current_city_id: "london", is_traveling: false } as
    | { id: string; current_city_id: string | null; is_traveling: boolean }
    | null,
  profileLoading: false,
  profileError: null as Error | null,
  userId: "account-1" as string | null,
  from: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/hooks/useActiveProfile", () => ({
  useActiveProfile: () => ({
    profile: mocks.profile,
    profileId: mocks.profile?.id ?? null,
    userId: mocks.userId,
    isLoading: mocks.profileLoading,
    error: mocks.profileError,
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));
vi.mock("@/components/fm/FMPageScaffold", () => ({
  FMPageScaffold: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const cities = [
  { id: "london", name: "London", country: "UK", music_scene: 90, population: 9000000, cost_of_living: 75, dominant_genre: "Rock", venues: 20 },
  { id: "paris", name: "Paris", country: "France", music_scene: 80, population: 2200000, cost_of_living: 70, dominant_genre: "Pop", venues: 16 },
  { id: "berlin", name: "Berlin", country: "Germany", music_scene: 85, population: 3700000, cost_of_living: 65, dominant_genre: "Electronic", venues: 18 },
];

function setCityResult(data: typeof cities | null, error: Error | null = null) {
  mocks.order.mockResolvedValue({ data, error });
  mocks.select.mockReturnValue({ order: mocks.order });
  mocks.from.mockReturnValue({ select: mocks.select });
}

function currentCityTitle(): string {
  const badge = screen.getByText("Current");
  return badge.parentElement?.textContent ?? "";
}

describe("Global Cities selected-character travel safety (#4231)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profile = { id: "character-1", current_city_id: "london", is_traveling: false };
    mocks.userId = "account-1";
    mocks.profileLoading = false;
    mocks.profileError = null;
    setCityResult(cities);
  });

  it("shows only the selected character's current city and links other cities to travel booking", async () => {
    render(<WorldEnvironment />);
    expect(await screen.findByText("London")).toBeInTheDocument();
    expect(currentCityTitle()).toContain("London");
    const travel = screen.getAllByRole("button", { name: "Book Travel" });
    expect(travel).toHaveLength(2);
    await userEvent.click(travel[0]);
    expect(mocks.navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/travel\?destination=/));
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("cities");
    expect(mocks.from).not.toHaveBeenCalledWith("profiles");
    expect(screen.queryByRole("button", { name: "Set as Home" })).not.toBeInTheDocument();
  });

  it("updates the Current marker on character switches without account-wide profile queries", async () => {
    const view = render(<WorldEnvironment />);
    await screen.findByText("London");
    expect(currentCityTitle()).toContain("London");

    mocks.profile = { id: "character-2", current_city_id: "paris", is_traveling: false };
    view.rerender(<WorldEnvironment />);
    expect(currentCityTitle()).toContain("Paris");

    mocks.profile = { id: "character-3", current_city_id: "berlin", is_traveling: false };
    view.rerender(<WorldEnvironment />);
    expect(currentCityTitle()).toContain("Berlin");

    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("never lets a missing character location become a free city selection", async () => {
    mocks.profile = { id: "character-1", current_city_id: null, is_traveling: false };
    render(<WorldEnvironment />);
    expect(await screen.findByText("London")).toBeInTheDocument();
    expect(screen.getByText(/no verified current city/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Book Travel|Set as Home/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Explore" })).toHaveLength(3);
    expect(mocks.from).not.toHaveBeenCalledWith("profiles");
  });

  it("disables new bookings while this character is travelling", async () => {
    mocks.profile = { id: "character-1", current_city_id: "london", is_traveling: true };
    render(<WorldEnvironment />);
    expect(await screen.findByText("London")).toBeInTheDocument();
    const travel = screen.getAllByRole("button", { name: "In Transit" });
    expect(travel).toHaveLength(2);
    for (const button of travel) expect(button).toBeDisabled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("fails closed if the active profile cannot be verified", async () => {
    mocks.profileError = new Error("Active profile unavailable");
    render(<WorldEnvironment />);
    expect(await screen.findByText("London")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/active character could not be verified/i);
    expect(screen.queryByRole("button", { name: "Book Travel" })).not.toBeInTheDocument();
  });

  it("shows city-loading errors instead of a misleading empty result", async () => {
    setCityResult(null, new Error("Network timeout"));
    render(<WorldEnvironment />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network timeout");
    });
    expect(screen.queryByText("No cities found")).not.toBeInTheDocument();
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("cities");
  });

  it("allows city browsing but never travel mutations when logged out", async () => {
    mocks.profile = null;
    mocks.userId = null;
    render(<WorldEnvironment />);
    expect(await screen.findByText("London")).toBeInTheDocument();
    expect(screen.getByText(/Sign in and select a character/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Book Travel|Set as Home/i })).not.toBeInTheDocument();
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});
