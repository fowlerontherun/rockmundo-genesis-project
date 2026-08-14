export type NumericMetricResolution =
  | { state: "available"; value: number }
  | { state: "missing" }
  | { state: "invalid" };

/** Preserve an explicitly available zero while keeping missing and malformed facts distinct. */
export function resolveNumericMetric(metric: unknown): NumericMetricResolution {
  if (metric == null) return { state: "missing" };
  const candidate = metric as { status?: unknown; value?: unknown };
  if (candidate.status !== "available") return { state: "missing" };
  return typeof candidate.value === "number" && Number.isFinite(candidate.value) && candidate.value >= 0
    ? { state: "available", value: candidate.value }
    : { state: "invalid" };
}

export type PresentationAttendanceResolution =
  | { state: "valid"; source: "headline" | "replay" | "capacity"; value: number }
  | { state: "missing" | "invalid"; source: "none"; value: 0 };

/** Resolve one shared, non-sensitive presentation fact. Invalid authoritative data fails closed. */
export function resolvePresentationAttendance(attendance: unknown, replayAttendance: unknown, capacity: unknown): PresentationAttendanceResolution {
  const resolvedAttendance = resolveNumericMetric(attendance);
  if (resolvedAttendance.state === "available") return { state: "valid", source: "headline", value: resolvedAttendance.value };
  const replay = resolveRawNumber(replayAttendance);
  if (replay.state === "available") return { state: "valid", source: "replay", value: replay.value };
  if (resolvedAttendance.state === "invalid" || replay.state === "invalid") return { state: "invalid", source: "none", value: 0 };
  const resolvedCapacity = resolveNumericMetric(capacity);
  if (resolvedCapacity.state === "available") return { state: "valid", source: "capacity", value: resolvedCapacity.value };
  return { state: resolvedCapacity.state === "invalid" ? "invalid" : "missing", source: "none", value: 0 };
}

function resolveRawNumber(value: unknown): NumericMetricResolution {
  if (value == null) return { state: "missing" };
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? { state: "available", value }
    : { state: "invalid" };
}

export function replayResultAttendance(replay: { events?: Array<{ visualPayload?: unknown }> }): unknown {
  const result = replay.events?.find((event) => (event.visualPayload as { type?: unknown })?.type === "result_reveal")?.visualPayload;
  return (result as { attendance?: unknown } | undefined)?.attendance;
}
