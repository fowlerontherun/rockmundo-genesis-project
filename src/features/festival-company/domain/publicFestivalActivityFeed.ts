import type { FestivalPublicConfirmedAct, FestivalPublicStage } from "./festivalLaunch";

export type PublicFestivalStageEventStatus =
  | "ready" | "changeover" | "soundcheck" | "starting" | "live"
  | "delayed" | "completed" | "cancelled";

export interface PublicFestivalActivityEvent {
  id: string;
  stageId: string;
  stageName: string;
  scheduleItemId: string;
  observedAt: string;
  status: PublicFestivalStageEventStatus;
  artistName: string | null;
}

const eventStatuses = new Set<PublicFestivalStageEventStatus>([
  "ready", "changeover", "soundcheck", "starting", "live", "delayed", "completed", "cancelled",
]);

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * A public feed is a canonical snapshot, not an appended client-side event log.
 * Stable source IDs make retries/reconnect/replayed observations deterministic.
 * Even a trusted RPC payload must be verified against the published stage list.
 */
export function readPublicFestivalActivityFeed(
  messages: unknown,
  stages: FestivalPublicStage[],
  lineup: FestivalPublicConfirmedAct[],
  currentDay: string | null,
  timezone: string,
  now: number,
): PublicFestivalActivityEvent[] {
  if (!currentDay || !Array.isArray(messages)) return [];
  const verifiedStages = new Map(stages.map((stage) => [stage.id, stage.name]));
  const publishedActs = new Map(lineup.map((act) => [act.id, act]));
  const seen = new Set<string>();
  const events: PublicFestivalActivityEvent[] = [];
  for (const message of messages) {
    if (!message || typeof message !== "object" || Array.isArray(message)) continue;
    const value = message as Record<string, unknown>;
    if (value.kind !== "stage" || typeof value.status !== "string" ||
      !eventStatuses.has(value.status as PublicFestivalStageEventStatus) ||
      typeof value.id !== "string" || !uuid.test(value.id) || seen.has(value.id) ||
      typeof value.stageId !== "string" || !uuid.test(value.stageId) ||
      typeof value.scheduleItemId !== "string" || !uuid.test(value.scheduleItemId) ||
      typeof value.stageName !== "string" || verifiedStages.get(value.stageId) !== value.stageName ||
      typeof value.observedAt !== "string") continue;
    const timestamp = Date.parse(value.observedAt);
    if (!Number.isFinite(timestamp) || timestamp > now + 60_000 || timestamp < now - 26 * 60 * 60_000) continue;
    try {
      // Locale-independent identity; the visitor may be in a different zone.
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
        .formatToParts(new Date(timestamp));
      const part = (type: string) => parts.find((entry) => entry.type === type)?.value;
      if (`${part("year")}-${part("month")}-${part("day")}` !== currentDay) continue;
    } catch { continue; }
    const act = publishedActs.get(value.scheduleItemId);
    seen.add(value.id);
    events.push({
      id: value.id, stageId: value.stageId, stageName: value.stageName,
      scheduleItemId: value.scheduleItemId, observedAt: value.observedAt,
      status: value.status as PublicFestivalStageEventStatus,
      artistName: act?.stageName === value.stageName ? act.artistName : null,
    });
  }
  return events.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt) || b.id.localeCompare(a.id)).slice(0, 20);
}

export const publicFestivalStageEventLabels: Record<PublicFestivalStageEventStatus, string> = {
  ready: "Stage ready for the next set",
  changeover: "Stage changeover in progress",
  soundcheck: "Soundcheck in progress",
  starting: "Performance starting",
  live: "Performance live",
  delayed: "Performance delayed",
  completed: "Performance completed",
  cancelled: "Performance cancelled",
};
