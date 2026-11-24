import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import City, { CityContent } from "./City";

const mocks = vi.hoisted(() => ({ snapshot: vi.fn() }));

vi.mock("@/utils/worldEnvironment", () => ({
  fetchWorldEnvironmentSnapshot: mocks.snapshot,
  fetchCityEnvironmentDetails: vi.fn(),
  normalizeNightClubRecord: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn() } }));
vi.mock("@/components/fm/FMPageScaffold", () => ({
  FMPageScaffold: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const emptyProps = {
  city: null,
  details: null,
  detailsLoading: false,
  loading: false,
  error: null,
  detailsError: null,
  districts: [],
  studios: [],
  playerCount: 0,
  nightClubs: [],
  transportRoutes: [],
  venueCount: 0,
};

function openCity() {
  return render(
    <MemoryRouter initialEntries={["/cities/5c8b81fd-519b-4f7b-99e5-0a7d0f7b482f"]}>
      <Routes><Route path="/cities/:cityId" element={<City />} /></Routes>
    </MemoryRouter>,
  );
}

describe("city header destination recovery", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("does not dereference a missing city and allows retry before data exists", async () => {
    const retry = vi.fn();
    expect(() => render(
      <MemoryRouter><CityContent {...emptyProps} onRetry={retry} /></MemoryRouter>,
    )).not.toThrow();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("starts the city request on initial navigation without crashing", async () => {
    mocks.snapshot.mockImplementation(() => new Promise(() => {}));
    expect(openCity).not.toThrow();
    await waitFor(() => expect(mocks.snapshot).toHaveBeenCalledOnce());
  });

  it("lets a failed city lookup be retried without a null-city crash", async () => {
    mocks.snapshot.mockResolvedValue({ cities: [] });
    openCity();
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(mocks.snapshot).toHaveBeenCalledTimes(2));
  });
});