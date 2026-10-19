import { describe, expect, it, vi } from "vitest";
import { deliverDjMixEvent } from "./mixerEventDelivery";

const noopDelay = async (_ms: number) => {};

describe("server-verified DJ mixer delivery", () => {
  it("accepts the immutable receipt once even when React Query refresh fails", async () => {
    const invoke = vi.fn(async () => ({ data: { id: "event-receipt" }, error: null }));
    const refresh = vi.fn(async () => { throw new Error("cache temporarily offline"); });
    const result = await deliverDjMixEvent({
      invoke, isActive: () => true, onAcknowledged: refresh, delay: noopDelay,
    });
    expect(result).toBe("acknowledged");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("retries an ambiguous network response with the SAME action key", async () => {
    const request = { bookingId: "book-1", eventId: "stable-event-uuid", kind: "crossfade", value: 75 };
    const sent: typeof request[] = [];
    let calls = 0;
    const invoke = async () => {
      sent.push({ ...request });
      calls += 1;
      if (calls === 1) throw new Error("network timeout after server commit");
      return { data: { id: "original-event-receipt" }, error: null };
    };
    const refresh = vi.fn();
    const result = await deliverDjMixEvent({
      invoke, isActive: () => true, onAcknowledged: refresh, delay: noopDelay,
    });
    expect(result).toBe("acknowledged");
    expect(sent).toEqual([request, request]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not retry a definite 400/403 validation rejection even if the message says fetch", async () => {
    const invoke = vi.fn(async () => ({
      data: null,
      error: {
        message: "fetch was not authorised",
        context: { status: 403, clone: () => ({ json: async () => ({ error: "Wrong DJ account" }) }) },
      },
    }));
    await expect(deliverDjMixEvent({
      invoke, isActive: () => true, onAcknowledged: vi.fn(), delay: noopDelay,
    })).rejects.toThrow("Wrong DJ account");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx with bounded backoff, but refuses to fake confirmation", async () => {
    const invoke = vi.fn(async () => ({
      data: null,
      error: { message: "server error", context: { status: 503 } },
    }));
    const delays: number[] = [];
    await expect(deliverDjMixEvent({
      invoke, isActive: () => true, onAcknowledged: vi.fn(),
      delay: async (ms) => { delays.push(ms); },
    })).rejects.toThrow("server error");
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([1000, 2000]);
  });

  it("treats an unacknowledged response as ambiguous and does not invent a receipt", async () => {
    const invoke = vi.fn(async () => ({ data: { ok: true }, error: null }));
    await expect(deliverDjMixEvent({
      invoke, isActive: () => true, onAcknowledged: vi.fn(), delay: noopDelay,
    })).rejects.toThrow("not acknowledged");
    expect(invoke).toHaveBeenCalledTimes(3);
  });

  it("abandons queued work after a booking changes or the booth closes", async () => {
    let active = true;
    const invoke = vi.fn(async () => ({
      data: null, error: { message: "connection reset" },
    }));
    const refresh = vi.fn();
    const result = await deliverDjMixEvent({
      invoke, isActive: () => active, onAcknowledged: refresh,
      delay: async () => { active = false; },
    });
    expect(result).toBe("inactive");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(await deliverDjMixEvent({
      invoke, isActive: () => false, onAcknowledged: refresh, delay: noopDelay,
    })).toBe("inactive");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("does not refresh a closed booth after an in-flight acknowledgement", async () => {
    let active = true;
    const refresh = vi.fn();
    const outcome = await deliverDjMixEvent({
      invoke: async () => { active = false; return { data: { id: "server-accepted" }, error: null }; },
      isActive: () => active, onAcknowledged: refresh, delay: noopDelay,
    });
    expect(outcome).toBe("acknowledged");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects server-owned validation errors without retrying or crediting evidence", async () => {
    const invoke = vi.fn(async () => ({ data: { error: "Set is no longer live" }, error: null }));
    const refresh = vi.fn();
    await expect(deliverDjMixEvent({
      invoke, isActive: () => true, onAcknowledged: refresh, delay: noopDelay,
    })).rejects.toThrow("Set is no longer live");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });
});
