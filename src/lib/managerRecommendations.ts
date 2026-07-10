export type ManagerRecommendationPriority = "high" | "medium" | "low";

export interface ManagerRecommendation {
  id: string;
  title: string;
  reason: string;
  suggestedAction: string;
  href?: string;
  priority: ManagerRecommendationPriority;
}

export interface ManagerRecommendationInput {
  profile?: {
    health?: number | null;
    energy?: number | null;
  } | null;
  songsReadyToRecord?: number;
  recordingsReadyToRelease?: number;
  totalSongs?: number;
  upcomingActivitiesCount?: number;
  needsBandRehearsal?: boolean;
  unreadImportantMessages?: number;
  upcomingActivities?: Array<{
    id: string;
    title?: string | null;
    activity_type?: string | null;
    scheduled_start?: string | null;
  }>;
}

const priorityWeight: Record<ManagerRecommendationPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const clampPercent = (value: number | null | undefined) => Math.max(0, Math.min(100, value ?? 100));

const pluralize = (count: number, singular: string, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

export function buildManagerRecommendations(input: ManagerRecommendationInput): ManagerRecommendation[] {
  const recommendations: ManagerRecommendation[] = [];
  const health = clampPercent(input.profile?.health);
  const energy = clampPercent(input.profile?.energy);
  const songsReadyToRecord = input.songsReadyToRecord ?? 0;
  const recordingsReadyToRelease = input.recordingsReadyToRelease ?? 0;
  const unreadImportantMessages = input.unreadImportantMessages ?? 0;
  const upcomingActivities = input.upcomingActivities ?? [];
  const totalSongs = input.totalSongs ?? songsReadyToRecord + recordingsReadyToRelease;
  const upcomingActivitiesCount = input.upcomingActivitiesCount ?? upcomingActivities.length;

  if (totalSongs === 0) {
    recommendations.push({
      id: "first-song",
      title: "Write your first song",
      reason: "You need original material before recording, releases, setlists, and many gig opportunities become useful.",
      suggestedAction: "Start a songwriting booking and create your first draft.",
      href: "/booking/songwriting",
      priority: "high",
    });
  }

  if (totalSongs > 0 && upcomingActivitiesCount === 0) {
    recommendations.push({
      id: "first-activity",
      title: "Book your next activity",
      reason: "Your schedule has no upcoming activity, so there is no clear next time-based action.",
      suggestedAction: "Open the schedule and book practice, education, work, rehearsal, or recording when eligible.",
      href: "/schedule",
      priority: "medium",
    });
  }

  if (health <= 35 || energy <= 35) {
    const isCritical = health <= 20 || energy <= 20;
    recommendations.push({
      id: "vitals-low",
      title: isCritical ? "Recover before taking risks" : "Top up your health and energy",
      reason: `Health is ${health}% and energy is ${energy}%, which can hurt gig, rehearsal, and recording outcomes.`,
      suggestedAction: "Visit Wellness and choose a recovery activity before booking more work.",
      href: "/wellness",
      priority: isCritical ? "high" : "medium",
    });
  }

  if (unreadImportantMessages > 0) {
    recommendations.push({
      id: "important-messages",
      title: "Review important messages",
      reason: `${pluralize(unreadImportantMessages, "high-priority message")} may need a response or decision.`,
      suggestedAction: "Open your inbox and handle urgent opportunities first.",
      href: "/inbox",
      priority: "high",
    });
  }

  if (recordingsReadyToRelease > 0) {
    recommendations.push({
      id: "recordings-ready-release",
      title: "Release finished recordings",
      reason: `${pluralize(recordingsReadyToRelease, "recorded song")} ${recordingsReadyToRelease === 1 ? "is" : "are"} ready to turn into momentum.`,
      suggestedAction: "Create a single, EP, or album release while the material is fresh.",
      href: "/release-manager",
      priority: "high",
    });
  }

  if (songsReadyToRecord > 0) {
    recommendations.push({
      id: "songs-ready-record",
      title: "Record completed songs",
      reason: `${pluralize(songsReadyToRecord, "completed song")} ${songsReadyToRecord === 1 ? "is" : "are"} written but not recorded yet.`,
      suggestedAction: "Book studio time and capture your strongest unreleased ideas.",
      href: "/recording-studio",
      priority: "medium",
    });
  }

  if (input.needsBandRehearsal) {
    recommendations.push({
      id: "band-rehearsal-needed",
      title: "Schedule band rehearsal",
      reason: "No upcoming rehearsal is on the calendar, so chemistry and set familiarity may stall.",
      suggestedAction: "Book a rehearsal before your next performance window.",
      href: "/rehearsals",
      priority: "medium",
    });
  }

  if (upcomingActivities.length > 0) {
    const nextActivity = upcomingActivities[0];
    recommendations.push({
      id: "upcoming-activity",
      title: "Prepare for your next booking",
      reason: `${nextActivity.title || nextActivity.activity_type || "An activity"} is coming up soon.`,
      suggestedAction: "Check your schedule, confirm timing, and make sure your vitals are ready.",
      href: "/schedule",
      priority: "low",
    });
  }

  return recommendations
    .sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority])
    .slice(0, 5);
}
