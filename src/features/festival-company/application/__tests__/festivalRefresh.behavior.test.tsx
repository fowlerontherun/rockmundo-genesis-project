import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFestivalArtistOpportunities } from "../useFestivalArtistWorkflows";
import { useSaveFestivalArtistProgramme } from "../useFestivalArtistProgramme";
import { usePublicFestivalTimetable } from "../useFestivalLaunch";

const mocks = vi.hoisted(() => ({ profileId: "a" as string | null, opportunities: vi.fn(), save: vi.fn(), timetable: vi.fn() }));
vi.mock("@/hooks/useActiveProfile", () => ({ useActiveProfile: () => ({ profileId: mocks.profileId }) }));
vi.mock("../../data/festivalCompanyRepository", () => ({
  getMyFestivalArtistOpportunities: mocks.opportunities, saveFestivalArtistProgramme: mocks.save,
  getFestivalArtistProgramme: vi.fn(), getPublicFestivalTimetable: mocks.timetable,
  ...Object.fromEntries([
    "submitFestivalArtistApplication", "withdrawFestivalArtistApplication", "reviewFestivalArtistApplication",
    "sendFestivalArtistInvitation", "respondToFestivalArtistInvitation", "withdrawFestivalArtistInvitation",
    "createFestivalArtistOffer", "sendFestivalArtistOffer", "counterFestivalArtistOffer", "respondToFestivalArtistOffer",
    "withdrawFestivalArtistOffer", "cancelFestivalArtistBooking", "saveFestivalPublicProfile", "beginFestivalLaunchReview",
    "launchFestival", "openFestivalTicketSales", "pauseFestivalTicketSales", "resumeFestivalTicketSales",
    "closeFestivalTicketSales", "issueFestivalComplimentaryTickets", "cancelLaunchedFestival",
  ].map(name => [name, vi.fn()])),
}));
vi.mock("@/features/festivals/projections/repository", () => ({
  saveFestivalEditionArtistProgramme: mocks.save,
  ...Object.fromEntries(["getFestivalEditionArtistProgramme", "createFestivalEditionArtistOffer", "searchFestivalEditionArtistCandidates",
    "sendFestivalEditionArtistInvitation", "sendFestivalEditionArtistOffer", "withdrawFestivalEditionArtistInvitation",
    "withdrawFestivalEditionArtistOffer"].map(name => [name, vi.fn()])),
}));
let client: QueryClient;
const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mocks.profileId = "a";
  mocks.opportunities.mockResolvedValue({ invitations: [] });
  mocks.timetable.mockResolvedValue([]);
  mocks.save.mockResolvedValue({ festivalCompanyId: "company" });
  focusManager.setFocused(true); onlineManager.setOnline(true);
});
afterEach(() => { cleanup(); client.clear(); vi.useRealTimers(); vi.clearAllMocks(); focusManager.setFocused(undefined); });
describe("festival query recovery", () => {
  it("waits for the actual artist opportunities query after a programme save", async () => {
    const { result } = renderHook(() => ({ query: useFestivalArtistOpportunities(), save: useSaveFestivalArtistProgramme() }), { wrapper });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    let resolve!: (value: unknown) => void;
    mocks.opportunities.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    let done!: Promise<unknown>;
    act(() => { done = result.current.save.mutateAsync({ festivalCompanyId: "company", festivalEditionId: "edition" } as Parameters<typeof result.current.save.mutateAsync>[0]); });
    await waitFor(() => expect(mocks.opportunities).toHaveBeenCalledTimes(2));
    expect(result.current.save.isPending).toBe(true);
    await act(async () => { resolve({ invitations: ["new"] }); await done; });
    await waitFor(() => expect(result.current.save.isSuccess).toBe(true));
    expect(result.current.query.data).toEqual({ invitations: ["new"] });
  });
  it("does not invalidate data after a rejected save", async () => {
    const { result } = renderHook(() => ({ query: useFestivalArtistOpportunities(), save: useSaveFestivalArtistProgramme() }), { wrapper });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    mocks.save.mockRejectedValueOnce(new Error("permission denied"));
    await act(async () => { await expect(result.current.save.mutateAsync({ festivalCompanyId: "company" } as Parameters<typeof result.current.save.mutateAsync>[0])).rejects.toThrow("permission denied"); });
    expect(mocks.opportunities).toHaveBeenCalledTimes(1);
  });
  it("polls mounted timetable data but stops in the background", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePublicFestivalTimetable("festival"), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    mocks.timetable.mockResolvedValue(["confirmed act"]);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_001); });
    expect(result.current.data).toEqual(["confirmed act"]);
    focusManager.setFocused(false);
    const count = mocks.timetable.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(mocks.timetable).toHaveBeenCalledTimes(count);
    await act(async () => { focusManager.setFocused(true); await vi.advanceTimersByTimeAsync(1); });
    expect(mocks.timetable.mock.calls.length).toBeGreaterThan(count);
  });
  it("recovers failed timetable data on reconnection", async () => {
    mocks.timetable.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => usePublicFestivalTimetable("festival"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    act(() => onlineManager.setOnline(false));
    mocks.timetable.mockResolvedValue(["recovered"]);
    act(() => onlineManager.setOnline(true));
    await waitFor(() => expect(result.current.data).toEqual(["recovered"]));
  });
  it("isolates characters and disables requests without a selected character", async () => {
    const { result, rerender } = renderHook(() => useFestivalArtistOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    mocks.profileId = "b";
    mocks.opportunities.mockImplementationOnce(() => new Promise(() => {}));
    rerender();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
    mocks.profileId = null; rerender();
    const count = mocks.opportunities.mock.calls.length;
    await act(async () => { await client.invalidateQueries({ queryKey: ["festival-artist-opportunities"] }); });
    expect(mocks.opportunities).toHaveBeenCalledTimes(count);
  });
});
