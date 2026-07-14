export type AnalyticsRangeKey = "7d" | "30d" | "90d" | "6m" | "1y" | "career";

export type TrendConfidence = "not_enough_data" | "low" | "early" | "normal";
export type TrendDirection = "improving" | "declining" | "stable" | "volatile" | "unknown";

export interface AnalyticsObservation {
  id: string;
  occurredAt: string;
  value: number;
  calculationVersion?: string | null;
}

export interface TrendSummary {
  sampleSize: number;
  direction: TrendDirection;
  confidence: TrendConfidence;
  label: "Not enough data" | "Low confidence" | "Early indication" | "Stable trend" | "Strong trend";
  delta: number | null;
  versionWarning: boolean;
  explanation: string;
}

export interface SafeComparison<T = unknown> {
  compatible: boolean;
  warning?: string;
  before: T;
  after: T;
}

export interface AnalyticsTimelineEvent {
  id: string;
  occurredAt: string;
  category:
    | "skill"
    | "attribute"
    | "mastery"
    | "maintenance"
    | "songwriting"
    | "recording"
    | "gig"
    | "teaching"
    | "band"
    | "achievement";
  title: string;
  summary: string;
  significance: "minor" | "meaningful" | "milestone";
  calculationVersion?: string | null;
}

export interface RecommendationSignal {
  id: string;
  actionKey: string;
  evidenceCount: number;
  isAccessible: boolean;
  isDismissed: boolean;
  versionStable: boolean;
  consistency: number;
  recencyDays: number;
  explanation: string;
}

export interface AnalyticsRecommendation {
  actionKey: string;
  confidence: "Low confidence" | "Moderate confidence" | "High confidence";
  explanation: string;
}

export interface PeerBenchmarkRequest {
  cohortSize: number;
  minimumCohortSize?: number;
  optedOut?: boolean;
  containsHiddenSkill?: boolean;
}

export const SUPPORTED_ANALYTICS_RANGES: ReadonlyArray<AnalyticsRangeKey> = ["7d", "30d", "90d", "6m", "1y", "career"];

const DAY_MS = 24 * 60 * 60 * 1000;

export function resolveAnalyticsRange(range: AnalyticsRangeKey, now = new Date()): { start: string | null; end: string; useAggregates: boolean } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  if (range === "career") return { start: null, end: end.toISOString(), useAggregates: true };
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : range === "6m" ? 183 : 365;
  const start = new Date(end.getTime() - days * DAY_MS);
  return { start: start.toISOString(), end: end.toISOString(), useAggregates: days > 90 };
}

export function summarizeTrend(observations: AnalyticsObservation[], metricLabel = "result"): TrendSummary {
  const ordered = observations
    .filter((point) => Number.isFinite(point.value) && !Number.isNaN(Date.parse(point.occurredAt)))
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
  const sampleSize = ordered.length;
  const versions = new Set(ordered.map((point) => point.calculationVersion ?? "unknown"));
  const versionWarning = versions.size > 1 || versions.has("unknown");

  if (sampleSize === 0) {
    return { sampleSize, direction: "unknown", confidence: "not_enough_data", label: "Not enough data", delta: null, versionWarning, explanation: `No ${metricLabel} history is available for this range.` };
  }
  if (sampleSize === 1) {
    return { sampleSize, direction: "unknown", confidence: "not_enough_data", label: "Not enough data", delta: null, versionWarning, explanation: `One ${metricLabel} result is available, so this is a result rather than a trend.` };
  }

  const first = ordered[0].value;
  const last = ordered[ordered.length - 1].value;
  const delta = Number((last - first).toFixed(2));
  const values = ordered.map((point) => point.value);
  const averageStep = values.slice(1).reduce((sum, value, index) => sum + Math.abs(value - values[index]), 0) / (sampleSize - 1);
  const direction: TrendDirection = averageStep > Math.max(8, Math.abs(delta) * 2.5)
    ? "volatile"
    : Math.abs(delta) < 2
      ? "stable"
      : delta > 0
        ? "improving"
        : "declining";
  const confidence: TrendConfidence = sampleSize === 2 ? "low" : sampleSize <= 5 ? "early" : "normal";
  const label = sampleSize === 2 ? "Low confidence" : sampleSize <= 5 ? "Early indication" : direction === "stable" ? "Stable trend" : "Strong trend";
  const caution = versionWarning ? " Scoring changed or is unknown during this period, so interpret the trend cautiously." : "";
  return { sampleSize, direction, confidence, label, delta, versionWarning, explanation: `${sampleSize} ${metricLabel} observations show a ${direction} pattern (${delta >= 0 ? "+" : ""}${delta}).${caution}` };
}

export function buildSafeComparison<T extends { calculationVersion?: string | null; systemKey?: string | null }>(before: T, after: T): SafeComparison<T> {
  if (before.systemKey && after.systemKey && before.systemKey !== after.systemKey) {
    return { compatible: false, warning: "These outcomes use different systems and should not be compared directly.", before, after };
  }
  if ((before.calculationVersion ?? "unknown") !== (after.calculationVersion ?? "unknown")) {
    return { compatible: true, warning: "Scoring changed during this comparison. Trends should be interpreted cautiously.", before, after };
  }
  return { compatible: true, before, after };
}

export function filterMeaningfulTimelineEvents(events: AnalyticsTimelineEvent[], limit = 50): AnalyticsTimelineEvent[] {
  return events
    .filter((event) => event.significance !== "minor")
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, Math.max(1, Math.min(limit, 100)));
}

export function createRecommendations(signals: RecommendationSignal[]): AnalyticsRecommendation[] {
  return signals
    .filter((signal) => signal.isAccessible && !signal.isDismissed && signal.evidenceCount >= 3 && signal.consistency >= 0.5)
    .map((signal) => {
      const score = signal.evidenceCount + signal.consistency * 4 - (signal.versionStable ? 0 : 2) - (signal.recencyDays > 60 ? 1 : 0);
      const confidence = score >= 8 ? "High confidence" : score >= 5 ? "Moderate confidence" : "Low confidence";
      return { actionKey: signal.actionKey, confidence, explanation: signal.explanation };
    });
}

export function isPeerBenchmarkAvailable(request: PeerBenchmarkRequest): boolean {
  const minimum = request.minimumCohortSize ?? 25;
  return !request.optedOut && !request.containsHiddenSkill && request.cohortSize >= minimum;
}
