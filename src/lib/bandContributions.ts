import { CalendarCheck, Disc3, HelpCircle, Mic2 } from "lucide-react";

export const BAND_CONTRIBUTION_LIMIT = 50;

export const bandContributionTypes = [
  "rehearsal_attendance",
  "recording_participation",
  "gig_performance",
] as const;

export type BandContributionType = (typeof bandContributionTypes)[number] | (string & {});

export type BandContributionEvent = {
  id: string;
  band_id: string;
  profile_id: string;
  contribution_type: BandContributionType;
  source_entity_type: string;
  source_entity_id: string;
  occurred_at: string;
  metadata: { label?: string; [key: string]: unknown } | null;
  created_at: string;
  profiles: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export const contributionTypeDisplay = {
  rehearsal_attendance: { label: "Rehearsal attendance", shortLabel: "Rehearsals", icon: CalendarCheck },
  recording_participation: { label: "Recording participation", shortLabel: "Recordings", icon: Disc3 },
  gig_performance: { label: "Gig performance", shortLabel: "Gigs", icon: Mic2 },
} as const;

export function getContributionDisplay(type: BandContributionType) {
  return contributionTypeDisplay[type as keyof typeof contributionTypeDisplay] ?? {
    label: "Band activity",
    shortLabel: "Other activity",
    icon: HelpCircle,
  };
}

export function getContributionSourceLabel(event: Pick<BandContributionEvent, "metadata" | "source_entity_type">) {
  if (typeof event.metadata?.label === "string" && event.metadata.label.trim().length > 0) {
    return event.metadata.label;
  }

  return event.source_entity_type
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function summarizeContributions(events: BandContributionEvent[]) {
  const byMember = new Map<string, { profile: BandContributionEvent["profiles"]; count: number }>();
  const byType = new Map<string, number>();

  events.forEach((event) => {
    const member = byMember.get(event.profile_id) ?? { profile: event.profiles, count: 0 };
    member.count += 1;
    byMember.set(event.profile_id, member);
    byType.set(event.contribution_type, (byType.get(event.contribution_type) ?? 0) + 1);
  });

  return {
    total: events.length,
    byMember: Array.from(byMember.entries()).map(([profileId, value]) => ({ profileId, ...value })),
    byType: Array.from(byType.entries()).map(([type, count]) => ({ type: type as BandContributionType, count })),
  };
}
