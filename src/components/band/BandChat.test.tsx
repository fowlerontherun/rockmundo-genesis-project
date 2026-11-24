import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn(), remove: vi.fn(), toast: vi.fn() }));
vi.mock("@/hooks/useActiveProfile", () => ({ useActiveProfile: () => ({ userId: "account-id", profileId: "character-id" }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => ({
    insert: mocks.insert,
    select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: mocks.remove,
} }));
import { BandChat } from "./BandChat";
beforeEach(() => { vi.clearAllMocks(); mocks.insert.mockResolvedValue({ error: null }); });
describe("band chat send flow", () => {
  it("submits both identities and clears the draft only after a successful send", async () => {
    render(<BandChat bandId="band-id" />);
    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "  Ready for rehearsal?  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send band message" }));
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith({ band_id: "band-id", user_id: "account-id", profile_id: "character-id", message: "Ready for rehearsal?" }));
    await waitFor(() => expect(input).toHaveValue(""));
  });
  it("preserves a failed message for retry", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "Network unavailable" } });
    render(<BandChat bandId="band-id" />);
    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "Meet backstage" } });
    fireEvent.click(screen.getByRole("button", { name: "Send band message" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(input).toHaveValue("Meet backstage");
  });
});