/** Shared, dependency-free guards for activities completed by scheduled workers. */
export function requireWorkerSuccess(
  worker: string,
  result: {
    data?: { success?: boolean; error?: string; errors?: number; xpAwardErrors?: number } | null;
    error?: { message?: string } | null;
  },
): void {
  if (result.error) throw new Error(`${worker} failed: ${result.error.message ?? 'invocation error'}`);
  if (result.data?.success !== true) {
    throw new Error(`${worker} did not confirm completion: ${result.data?.error ?? 'missing success receipt'}`);
  }
  if ((result.data.errors ?? 0) > 0 || (result.data.xpAwardErrors ?? 0) > 0) {
    throw new Error(`${worker} reported downstream settlement failures`);
  }
}

interface CompletionRetryMetadata {
  completionFailureCount?: number;
  completionRetryAt?: string;
  completionNeedsReview?: boolean;
  [key: string]: unknown;
}

export function isCompletionRetryDue(metadata: CompletionRetryMetadata | null, now: Date): boolean {
  if (metadata?.completionNeedsReview) return false;
  if (!metadata?.completionRetryAt) return true;
  const retryAt = Date.parse(metadata.completionRetryAt);
  return !Number.isFinite(retryAt) || retryAt <= now.getTime();
}

/** Five bounded attempts, exponential backoff, then an explicit review marker. */
export function failedCompletionMetadata(
  metadata: CompletionRetryMetadata | null,
  message: string,
  now: Date,
): CompletionRetryMetadata {
  const failures = Math.max(0, Number(metadata?.completionFailureCount) || 0) + 1;
  const needsReview = failures >= 5;
  return {
    ...(metadata ?? {}),
    completionFailureCount: failures,
    completionError: message.slice(0, 400),
    completionRetryAt: needsReview ? undefined : new Date(now.getTime() + Math.min(60, 2 ** failures) * 60_000).toISOString(),
    completionNeedsReview: needsReview,
    ...(needsReview ? { completionDeadLetterAt: now.toISOString() } : {}),
  };
}
