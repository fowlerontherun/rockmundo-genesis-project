/**
 * Browser delivery for an already-authorised, server-verified DJ mixer action.
 *
 * The caller creates ONE event UUID per real user action. All ambiguous retry
 * attempts use the same request payload; the database's (booking,event_id)
 * uniqueness owns deduplication. Neither this helper nor a cache refresh grants
 * cash, fans, fame, XP or final scores.
 */
export type DjMixActionResponse = {
  data?: unknown;
  error?: unknown;
};

export type DjMixDelivery = "acknowledged" | "inactive";

type RequestError = {
  message?: string;
  context?: {
    status?: number;
    clone?: () => { json: () => Promise<unknown> };
  };
};

function serverErrorDetails(error: unknown): { status: number; message: string } {
  const candidate: RequestError = (error && typeof error === "object") ? error as RequestError : {};
  const status = candidate.context?.status;
  return {
    status: typeof status === "number" && Number.isFinite(status) ? status : 0,
    message: typeof candidate.message === "string" ? candidate.message : "DJ mixer request failed",
  };
}

async function serviceMessage(error: unknown): Promise<string> {
  const candidate: RequestError = (error && typeof error === "object") ? error as RequestError : {};
  try {
    const payload: unknown = await candidate.context?.clone?.().json();
    if (payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string") {
      return (payload as { error: string }).error;
    }
  } catch {
    // Response bodies may be consumed or non-JSON. Preserve the SDK message.
  }
  return serverErrorDetails(error).message;
}

export async function deliverDjMixEvent({
  invoke, isActive, onAcknowledged, delay,
}: {
  invoke: () => Promise<DjMixActionResponse>;
  isActive: () => boolean;
  onAcknowledged: () => Promise<unknown> | unknown;
  delay: (ms: number) => Promise<void>;
}): Promise<DjMixDelivery> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // A queued event from a now-closed or switched DJ booth must not start a
    // new network request. In-flight requests may still be server-accepted.
    if (!isActive()) return "inactive";

    const { data, error } = await (async () => {
      try { return await invoke(); }
      catch (reason) { return { data: null, error: reason }; }
    })();

    let failure: Error | null = null;
    let retryable = true;
    if (error) {
      const details = serverErrorDetails(error);
      failure = new Error(await serviceMessage(error));
      // Authorization/validation errors are definite rejections, not flaky
      // transport. Never re-issue them, even when their message says "fetch".
      retryable = details.status < 400 || details.status >= 500;
    } else if (data && typeof data === "object" &&
      typeof (data as { error?: unknown }).error === "string") {
      failure = new Error((data as { error: string }).error);
      retryable = false;
    } else if (!data || typeof data !== "object" ||
      typeof (data as { id?: unknown }).id !== "string") {
      // A lost/malformed response is ambiguous. Retry with the same event ID,
      // never synthesize a second mixer action or claim success.
      failure = new Error("DJ mixer event was not acknowledged by the server");
    } else {
      if (isActive()) {
        try { await onAcknowledged(); }
        catch { /* The server receipt succeeded. Cache sync is best-effort. */ }
      }
      return "acknowledged";
    }

    if (!retryable || attempt === 2) throw failure;
    await delay(1000 * (attempt + 1));
  }
  throw new Error("DJ mixer event was not acknowledged by the server");
}
