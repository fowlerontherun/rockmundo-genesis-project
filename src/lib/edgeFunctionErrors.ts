type EdgeFunctionErrorPayload = {
  message?: unknown;
  error?: unknown;
};

const payloadMessage = (payload: EdgeFunctionErrorPayload): string | null => {
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error.trim();
  }
  return null;
};

/**
 * Supabase wraps 4xx/5xx Edge Function responses in a generic FunctionsHttpError.
 * Read the response body so players see the actionable server message instead.
 */
export async function getEdgeFunctionErrorMessage(
  error: unknown,
  fallback = "The request could not be completed. Please try again.",
): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;

  if (context instanceof Response) {
    try {
      const payload = (await context.clone().json()) as EdgeFunctionErrorPayload;
      const message = payloadMessage(payload);
      if (message) return message;
    } catch {
      try {
        const message = (await context.clone().text()).trim();
        if (message) return message;
      } catch {
        // Fall through to the ordinary Error message or supplied fallback.
      }
    }
  }

  if (error instanceof Error) {
    const message = error.message.trim();
    if (message && !/edge function returned a non-2xx status code/i.test(message)) {
      return message;
    }
  }

  return fallback;
}
