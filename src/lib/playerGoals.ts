export type PlayerGoalKind =
  | "write_song"
  | "record_song"
  | "release_music"
  | "rehearse_band"
  | "improve_wellness"
  | "gain_fans"
  | "attend_activity";

export interface PlayerGoalInput {
  draftSongs: number;
  recordedSongs: number;
  releasedMusic: number;
  upcomingRehearsals: number;
  recentRehearsals: number;
  upcomingActivities: number;
  health: number;
  energy: number;
  fans: number;
  fame: number;
}

export interface PlayerGoal {
  id: PlayerGoalKind;
  title: string;
  description: string;
  href: string;
  cta: string;
  current: number;
  target: number;
  progressLabel: string;
  priority: number;
  completed: boolean;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const makeGoal = (goal: Omit<PlayerGoal, "completed">): PlayerGoal => ({
  ...goal,
  completed: goal.current >= goal.target,
});

export function getNextFanTarget(fans: number, fame: number): number {
  const baseline = Math.max(25, fans, fame * 10);
  if (baseline < 100) return 100;
  if (baseline < 500) return 500;
  if (baseline < 1_000) return 1_000;
  return Math.ceil((baseline + 1) / 1_000) * 1_000;
}

export function generatePlayerGoals(input: PlayerGoalInput): PlayerGoal[] {
  const wellnessScore = Math.round((clamp(input.health) + clamp(input.energy)) / 2);
  const fanTarget = getNextFanTarget(input.fans, input.fame);

  const goals = [
    makeGoal({
      id: "write_song",
      title: "Write a song",
      description: input.draftSongs > 0 ? "You have written material ready for the studio." : "Start with one original song to unlock recording and release momentum.",
      href: "/songwriting",
      cta: input.draftSongs > 0 ? "View songs" : "Start writing",
      current: Math.min(input.draftSongs, 1),
      target: 1,
      progressLabel: `${input.draftSongs}/1 written`,
      priority: input.draftSongs > 0 ? 70 : 10,
    }),
    makeGoal({
      id: "record_song",
      title: "Record a song",
      description: input.recordedSongs > 0 ? "You have a track recorded and ready for release planning." : "Take a written song into the recording studio.",
      href: "/recording-studio",
      cta: "Open studio",
      current: Math.min(input.recordedSongs, 1),
      target: 1,
      progressLabel: `${input.recordedSongs}/1 recorded`,
      priority: input.draftSongs > 0 ? 20 : 80,
    }),
    makeGoal({
      id: "release_music",
      title: "Release music",
      description: input.releasedMusic > 0 ? "Your catalog is public. Keep building your next release." : "Package a recorded song into a single, EP, or album.",
      href: "/release-manager",
      cta: "Manage releases",
      current: Math.min(input.releasedMusic, 1),
      target: 1,
      progressLabel: `${input.releasedMusic}/1 released`,
      priority: input.recordedSongs > 0 ? 30 : 90,
    }),
    makeGoal({
      id: "rehearse_band",
      title: "Rehearse with band",
      description: input.upcomingRehearsals > 0 ? "A rehearsal is already on your calendar." : "Book a rehearsal to improve live readiness.",
      href: "/rehearsals",
      cta: "Book rehearsal",
      current: Math.min(input.upcomingRehearsals + input.recentRehearsals, 1),
      target: 1,
      progressLabel: input.upcomingRehearsals > 0 ? `${input.upcomingRehearsals} upcoming` : `${input.recentRehearsals}/1 recent`,
      priority: input.upcomingRehearsals > 0 || input.recentRehearsals > 0 ? 75 : 40,
    }),
    makeGoal({
      id: "improve_wellness",
      title: "Improve health/energy",
      description: wellnessScore >= 80 ? "You are in good shape for demanding activities." : "Recover before pushing into gigs, recording, or travel.",
      href: "/wellness",
      cta: "Recover",
      current: wellnessScore,
      target: 80,
      progressLabel: `${wellnessScore}/80 wellness`,
      priority: wellnessScore < 50 ? 5 : wellnessScore < 80 ? 25 : 85,
    }),
    makeGoal({
      id: "gain_fans",
      title: "Gain fans/fame",
      description: "Use gigs, releases, media, and promotion to reach your next audience milestone.",
      href: "/public-relations",
      cta: "Promote",
      current: Math.min(Math.max(input.fans, input.fame * 10), fanTarget),
      target: fanTarget,
      progressLabel: `${Math.max(input.fans, input.fame * 10).toLocaleString()}/${fanTarget.toLocaleString()} audience`,
      priority: 60,
    }),
    makeGoal({
      id: "attend_activity",
      title: "Attend scheduled activity",
      description: input.upcomingActivities > 0 ? "You have something coming up. Show up to keep progress moving." : "Schedule an activity to create a short-term commitment.",
      href: "/schedule",
      cta: "Open schedule",
      current: Math.min(input.upcomingActivities, 1),
      target: 1,
      progressLabel: `${input.upcomingActivities} upcoming`,
      priority: input.upcomingActivities > 0 ? 15 : 50,
    }),
  ];

  return goals.sort((a, b) => Number(a.completed) - Number(b.completed) || a.priority - b.priority).slice(0, 5);
}
