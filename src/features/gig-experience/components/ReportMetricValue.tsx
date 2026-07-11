import type { ReportMetric } from "../types";
import { renderMetricValue } from "../reportMetric";

export function ReportMetricValue<T>({ metric, format = String }: { metric: ReportMetric<T>; format?: (value: T) => string }) {
  return <>{renderMetricValue(metric, format)}</>;
}
