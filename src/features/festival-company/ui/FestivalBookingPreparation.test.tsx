import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FestivalBookingPreparation } from "./FestivalBookingPreparation";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("booking preparation persistence", () => {
  it("saves the selected booking version and reads the saved preparation back", async () => {
    const data = { bookingId: "booking-1", version: 2, setMinutes: 30, preparation: { songIds: ["song-1"], backstageChoice: "focus_on_show" }, songs: [{ id: "song-1", title: "First song", durationSeconds: 180 }] };
    mocks.rpc.mockResolvedValueOnce({ data, error: null }).mockResolvedValueOnce({ data: { ...data, version: 3 }, error: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><FestivalBookingPreparation bookingId="booking-1" /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Setlist & backstage" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save preparation" }));
    await waitFor(() => expect(mocks.rpc).toHaveBeenLastCalledWith("festival_booking_preparation", { p_booking_id: "booking-1", p_expected_version: 2, p_song_ids: ["song-1"], p_backstage_choice: "focus_on_show" }));
    await waitFor(() => expect(client.getQueryData(["festival-booking-preparation", "booking-1"])).toMatchObject({ version: 3 }));
    client.clear();
  });
});