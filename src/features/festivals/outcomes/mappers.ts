import { crowdStateForScore, type FestivalPerformanceOutcome, type FestivalStageCrowdSnapshot } from "./model";

export function mapPublicOutcome(row: Record<string, unknown>) {
  return {
    sessionId: String(row.session_id),
    audienceSize: Number(row.audience_size ?? 0),
    capacityPercentage: Number(row.capacity_percentage ?? 0),
    crowdState: String(row.crowd_state ?? "attentive"),
    performanceScore: row.performance_score == null ? null : Number(row.performance_score),
    safeHighlights: Array.isArray(row.safe_highlights) ? row.safe_highlights : [],
  };
}

export function outcomeSummary(outcome: Pick<FestivalPerformanceOutcome, "overall_score" | "readiness_score" | "crowd_connection_score" | "professionalism_score">) {
  return { rating: crowdStateForScore(outcome.overall_score), strengths: [outcome.readiness_score >= 80 ? "ready" : null, outcome.crowd_connection_score >= 75 ? "crowd connection" : null, outcome.professionalism_score >= 80 ? "professional" : null].filter(Boolean) };
}

export function crowdDisplay(snapshot: FestivalStageCrowdSnapshot) {
  return `${snapshot.audience_total.toLocaleString()} attending · ${Math.round(snapshot.density * 100)}% capacity · ${snapshot.crowd_state}`;
}
