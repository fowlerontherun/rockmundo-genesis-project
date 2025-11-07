export interface FriendshipTierDefinition {
  id: string;
  label: string;
  minAffinity: number;
  maxAffinity: number | null;
  perks: string[];
  collabBoosts: string[];
}

export const FRIENDSHIP_TIERS: FriendshipTierDefinition[] = [
  {
    id: "acquaintance",
    label: "Acquaintance",
    minAffinity: 0,
    maxAffinity: 249,
    perks: ["Basic profile access", "Quick chat unlocked"],
    collabBoosts: ["Invite to casual jams", "Track attendance streaks"],
  },
  {
    id: "bandmate",
    label: "Bandmate",
    minAffinity: 250,
    maxAffinity: 599,
    perks: ["5% merch discount", "+5% shared XP from jams"],
    collabBoosts: ["Co-op practice goals", "Instant trade approvals"],
  },
  {
    id: "inner-circle",
    label: "Inner Circle",
    minAffinity: 600,
    maxAffinity: 999,
    perks: ["+10% gig XP together", "Priority gig matchmaking"],
    collabBoosts: ["Tour planning tools", "Shared rehearsal spaces"],
  },
  {
    id: "legendary-duo",
    label: "Legendary Duo",
    minAffinity: 1000,
    maxAffinity: null,
    perks: ["Exclusive emotes", "Shared fast travel", "+15% fame growth"],
    collabBoosts: ["Duo albums", "Co-manage band assets"],
  },
];

export const RELATIONSHIP_EVENT_WEIGHTS: Record<string, number> = {
  "relationship_chat": 8,
  "relationship_group_chat": 5,
  "relationship_gift": 18,
  "relationship_trade": 22,
  "relationship_collab": 30,
  "relationship_gig": 35,
  "relationship_jam": 20,
  "relationship_tour": 40,
  "relationship_reaction": 4,
  "relationship_permission_update": 6,
};

export const RELATIONSHIP_MILESTONES: Array<{
  id: string;
  label: string;
  threshold: number;
  reward: string;
}> = [
  { id: "streak-7", label: "7-day streak", threshold: 80, reward: "Affinity burst & chat badge" },
  { id: "month", label: "30 days as friends", threshold: 240, reward: "Profile wall collage" },
  { id: "gigs-100", label: "100 shared gigs", threshold: 3500, reward: "Legendary duo anthem" },
  { id: "anniversary", label: "Band anniversary", threshold: 4200, reward: "Band documentary highlight" },
];

export const RELATIONSHIP_STATUSES = [
  {
    id: "best-friends",
    label: "Best Friends",
    emoji: "🌟",
    unlocks: ["Exclusive co-op quests", "+20% affinity gain from shared wins", "Unique dialogue arcs"],
    reputation: "Boosts friendly reputation and unlocks duo interviews.",
  },
  {
    id: "rivals",
    label: "Rivals",
    emoji: "⚡",
    unlocks: ["Weekly battle gigs", "Competitive stat tracking", "Rivalry-only cosmetics"],
    reputation: "Generates buzz but can reduce fan loyalty if unmanaged.",
  },
  {
    id: "romance",
    label: "Romance",
    emoji: "💖",
    unlocks: ["Shared home base", "Joint storylines", "Relationship-exclusive poses"],
    reputation: "Improves media interest but requires trust upkeep.",
  },
  {
    id: "mentor",
    label: "Mentor",
    emoji: "🎓",
    unlocks: ["Skill boost sessions", "Shared XP bank", "Mentor showcases"],
    reputation: "Raises mentee city standing and unlocks mentor accolades.",
  },
];

export const TRUST_PERMISSION_LEVELS = [
  { id: "public", label: "Public", description: "Showcase highlight reel to everyone." },
  { id: "friends", label: "Friends", description: "Detailed stats for accepted friends." },
  { id: "trusted", label: "Trusted", description: "Backstage access for collaborators." },
];
