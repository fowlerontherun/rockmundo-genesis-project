// Central reward config — mirror of edge function's ACTIONS map.
// Used to render reward chips and toasts before calling the edge function.

export interface ActionRewardConfig {
  id: string;
  label: string;
  xp: number;
  skillXp: number;
  skillSlug?: string;
  skillLabel?: string;
  dailyCap: number;
}

export const RELATIONSHIP_ACTION_REWARDS: Record<string, ActionRewardConfig> = {
  chat:        { id: "chat",        label: "Quick ping",         xp: 2,  skillXp: 0,  dailyCap: 5 },
  gift:        { id: "gift",        label: "Send gift",          xp: 5,  skillXp: 3,  skillSlug: "charisma",    skillLabel: "Charisma",    dailyCap: 3 },
  hangout:     { id: "hangout",     label: "Plan hangout",       xp: 8,  skillXp: 5,  skillSlug: "charisma",    skillLabel: "Charisma",    dailyCap: 2 },
  trade:       { id: "trade",       label: "Trade gear",         xp: 10, skillXp: 5,  skillSlug: "business",    skillLabel: "Business",    dailyCap: 3 },
  jam:         { id: "jam",         label: "Jam session",        xp: 15, skillXp: 10, skillSlug: "performance", skillLabel: "Performance", dailyCap: 2 },
  gig:         { id: "gig",         label: "Gig collab",         xp: 20, skillXp: 15, skillSlug: "performance", skillLabel: "Performance", dailyCap: 1 },
  songwriting: { id: "songwriting", label: "Songwriting collab", xp: 20, skillXp: 15, skillSlug: "songwriting", skillLabel: "Songwriting", dailyCap: 1 },
  teach:       { id: "teach",       label: "Teach a skill",      xp: 20, skillXp: 5,  skillLabel: "Mentoring",   dailyCap: 4 },
};

export const STREAK_TIERS = [
  { day: 1,  xp: 10,  skillXp: 0,  label: "Day 1 streak" },
  { day: 3,  xp: 25,  skillXp: 10, label: "Day 3 streak" },
  { day: 7,  xp: 50,  skillXp: 25, label: "Day 7 streak" },
  { day: 14, xp: 100, skillXp: 50, label: "Day 14+ streak" },
];
