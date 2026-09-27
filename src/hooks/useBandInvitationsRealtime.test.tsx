import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const on = vi.fn();
  const subscribe = vi.fn();
  const removeChannel = vi.fn();
  const channel = vi.fn();
  return { on, subscribe, removeChannel, channel };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

import { useBandInvitationsRealtime } from "./useBandInvitationsRealtime";

let handler: (payload: { eventType: string; new: { status?: string } }) => void;
const channel = { on: mocks.on, subscribe: mocks.subscribe };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.channel.mockReturnValue(channel);
  mocks.on.mockImplementation((_type, _filter, callback) => {
    handler = callback;
    return channel;
  });
  mocks.subscribe.mockReturnValue(channel);
  mocks.removeChannel.mockResolvedValue("ok");
});

describe("scoped band invitation realtime", () => {
  it("does not subscribe without a selected account or band", () => {
    const onChange = vi.fn();
    renderHook(() => useBandInvitationsRealtime({
      filterColumn: "invited_user_id",
      filterValue: null,
      onChange,
    }));
    expect(mocks.channel).not.toHaveBeenCalled();
  });

  it("subscribes to account-scoped invitation changes and unsubscribes on unmount", () => {
    const onChange = vi.fn();
    const { unmount } = renderHook(() => useBandInvitationsRealtime({
      filterColumn: "invited_user_id",
      filterValue: "user-1",
      onChange,
    }));

    expect(mocks.channel).toHaveBeenCalledWith("band-invitations:invited_user_id:user-1");
    expect(mocks.on).toHaveBeenCalledWith("postgres_changes", {
      event: "*", schema: "public", table: "band_invitations",
      filter: "invited_user_id=eq.user-1",
    }, expect.any(Function));
    expect(mocks.subscribe).toHaveBeenCalledTimes(1);

    act(() => handler({ eventType: "INSERT", new: { status: "pending" } }));
    expect(onChange).toHaveBeenCalledWith({ eventType: "INSERT", status: "pending" });

    unmount();
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("updates callbacks without a new subscription, and replaces the band filter on change", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ bandId, onChange }) => useBandInvitationsRealtime({
        filterColumn: "band_id",
        filterValue: bandId,
        onChange,
      }),
      { initialProps: { bandId: "band-a", onChange: first } },
    );
    rerender({ bandId: "band-a", onChange: latest });
    expect(mocks.channel).toHaveBeenCalledTimes(1);

    act(() => handler({ eventType: "UPDATE", new: { status: "accepted" } }));
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith({ eventType: "UPDATE", status: "accepted" });

    rerender({ bandId: "band-b", onChange: latest });
    expect(mocks.removeChannel).toHaveBeenCalledTimes(1);
    expect(mocks.channel).toHaveBeenCalledWith("band-invitations:band_id:band-b");
    expect(mocks.on).toHaveBeenLastCalledWith("postgres_changes", {
      event: "*", schema: "public", table: "band_invitations",
      filter: "band_id=eq.band-b",
    }, expect.any(Function));
    unmount();
    expect(mocks.removeChannel).toHaveBeenCalledTimes(2);
  });
});
