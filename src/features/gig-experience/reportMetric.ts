import type { ReportMetric } from "./types";

export const metricAvailable = <T>(value: T, source: "authoritative" | "legacy" | "derived" = "authoritative"): ReportMetric<T> => ({ status: "available", value, source });
export const metricProcessing = <T>(reason: string): ReportMetric<T> => ({ status: "processing", reason });
export const metricLegacyMissing = <T>(reason: string): ReportMetric<T> => ({ status: "legacy_missing", reason });
export const metricNotApplicable = <T>(reason: string): ReportMetric<T> => ({ status: "not_applicable", reason });

export function nullableNumberMetric(value: unknown, missingReason: string, source: "authoritative" | "legacy" | "derived" = "authoritative"): ReportMetric<number> {
  if (typeof value === "number" && Number.isFinite(value)) return metricAvailable(value, source);
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return metricAvailable(Number(value), source);
  return metricLegacyMissing(missingReason);
}

export function metricValue<T>(metric: ReportMetric<T>, fallback: T): T {
  return metric.status === "available" ? metric.value : fallback;
}

export function renderMetricValue<T>(metric: ReportMetric<T>, format: (value: T) => string = String): string {
  switch (metric.status) {
    case "available": return format(metric.value);
    case "processing": return "Processing";
    case "legacy_missing": return "Legacy data unavailable";
    case "not_applicable": return "Not applicable";
  }
}
