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

export function attendanceForPresentation(attendance: unknown, capacity: unknown): number | undefined {
  const resolvedAttendance = resolveNumericMetric(attendance);
  if (resolvedAttendance.state === "available") return resolvedAttendance.value;
  if (resolvedAttendance.state === "invalid") return undefined;
  const resolvedCapacity = resolveNumericMetric(capacity);
  return resolvedCapacity.state === "available" ? resolvedCapacity.value : undefined;
}
