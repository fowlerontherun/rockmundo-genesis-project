import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invalidate: vi.fn(), remove: vi.fn(), channel: vi.fn(), on: vi.fn(), subscribe: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { channel: mocks.channel, removeChannel: mocks.remove } }));
import { useSocialUpdates } from "../useSocialUpdates";
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  const channel = { on: mocks.on, subscribe: mocks.subscribe };
  mocks.channel.mockReturnValue(channel); mocks.on.mockReturnValue(channel); mocks.subscribe.mockReturnValue(channel);
});
afterEach(() => vi.useRealTimers());
describe("social live updates", () => {
  it("refreshes the character's friend list and counts on incoming events", () => {
    const { unmount } = renderHook(() => useSocialUpdates("character", "friendships"));
    act(() => mocks.on.mock.calls[0][2]());
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["friendships", "character"] });
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["friend-request-counts", "character"] });
    unmount();
  });
  it("polls invites and stops subscriptions and timers on unmount", () => {
    const { unmount } = renderHook(() => useSocialUpdates("character", "social_invites"));
    act(() => vi.advanceTimersByTime(15000));
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["social-invites-in", "character"] });
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ["social-invites-out", "character"] });
    unmount(); mocks.invalidate.mockClear();
    act(() => vi.advanceTimersByTime(30000));
    expect(mocks.invalidate).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });
  it("does not subscribe without a character", () => {
    renderHook(() => useSocialUpdates(null, "friendships"));
    expect(mocks.channel).not.toHaveBeenCalled();
  });
});