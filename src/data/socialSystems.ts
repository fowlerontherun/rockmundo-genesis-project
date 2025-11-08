import {
  type LucideIcon,
  Handshake,
  MessageSquareHeart,
  Gift,
  UsersRound,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export interface FriendshipTier {
  level: string;
  range: string;
  perks: string[];
  collaboration: string[];
  notes?: string;
}

export const friendshipTiers: FriendshipTier[] = [
  {
    level: "Acquaintance",
    range: "0 – 249 affinity",
    perks: ["Basic profile access", "Can exchange quick chats"],
    collaboration: ["Can invite to hangouts", "Unlocks low-stakes jam invites"],
    notes: "New friends start here with a shared introduction quest.",
  },
  {
    level: "Bandmate",
    range: "250 – 599 affinity",
    perks: ["5% merch discount", "+5% shared XP from jams"],
    collaboration: ["Unlocks co-op practice goals", "Trade common gear instantly"],
  },
  {
    level: "Inner Circle",
    range: "600 – 999 affinity",
    perks: ["+10% gig XP together", "Priority matchmaking for gigs"],
    collaboration: ["Plan tours together", "Share rehearsal spaces"],
  },
  {
    level: "Legendary Duo",
    range: "1,000+ affinity",
    perks: ["Exclusive emotes", "Shared fast travel", "+15% fame growth together"],
    collaboration: ["Unlock duo albums", "Co-manage band assets"],
    notes: "Requires maintaining affinity with weekly interactions.",
  },
];

export interface RelationshipStatus {
  name: string;
  icon: string;
  unlocks: string[];
  reputation: string;
}

export const relationshipStatuses: RelationshipStatus[] = [
  {
    name: "Best Friends",
    icon: "🌟",
    unlocks: ["Exclusive co-op quests", "+20% affinity gain from shared wins", "Unique dialogue arcs"],
    reputation: "Boosts friendly reputation and unlocks duo interviews.",
  },
  {
    name: "Rivals",
    icon: "⚡",
    unlocks: ["Weekly battle gigs", "Competitive stat tracking", "Rivalry-only cosmetics"],
    reputation: "Generates buzz but can reduce fan loyalty if not managed.",
  },
  {
    name: "Romance",
    icon: "💖",
    unlocks: ["Shared home base", "Joint storylines", "Relationship-exclusive poses"],
    reputation: "Improves media interest but requires trust upkeep.",
  },
  {
    name: "Mentor",
    icon: "🎓",
    unlocks: ["Skill boost sessions", "Shared XP bank", "Mentor showcases"],
    reputation: "Raises mentee's city standing and unlocks mentor accolades.",
  },
];

export interface Milestone {
  label: string;
  reward: string;
}

export const friendshipMilestones: Milestone[] = [
  { label: "7-day streak", reward: "Affinity burst and chat badge" },
  { label: "30 days as friends", reward: "Wall photo collage" },
  { label: "100 shared gigs", reward: "Legendary Duo anthem" },
  { label: "Band anniversary", reward: "Band documentary highlight" },
];

export interface ProfileSection {
  title: string;
  description: string;
  fields: string[];
}

export const playerProfileSections: ProfileSection[] = [
  {
    title: "Artist Overview",
    description: "Give friends the full snapshot once they accept your request.",
    fields: [
      "Fame tier, fanbase stats, and current contract",
      "Skill ratings with growth progress bars",
      "Lifestyle choices, home city, favorite genres, hobbies",
      "Profile banner, avatar, biography, and collectible badges",
    ],
  },
  {
    title: "Band Membership",
    description: "Track every band you've joined, left, or are building.",
    fields: [
      "Active bands with your role and status",
      "Historical bands with highlights",
      "Quick links to band dashboards, lineups, and release history",
    ],
  },
  {
    title: "Career Timeline",
    description: "A social feed for your musical journey that friends can react to.",
    fields: [
      "Gig, festival, and tour milestones",
      "Awards, certifications, and viral moments",
      "Skill level-ups and academic achievements",
      "Friend reactions, stickers, and comments",
    ],
  },
];

export interface CommunicationChannel {
  name: string;
  icon: string;
  features: string[];
}

export const communicationChannels: CommunicationChannel[] = [
  {
    name: "Direct Messages",
    icon: "💬",
    features: ["Persistent chat history", "Emoji and reaction support", "Media and attachment sharing"],
  },
  {
    name: "Group & Band Chats",
    icon: "🎙️",
    features: ["Role-based permissions", "Topic threads", "Pinned rehearsal notes"],
  },
  {
    name: "Player Walls",
    icon: "📣",
    features: ["Public shoutouts", "Event invitations", "Collaborative playlists"],
  },
  {
    name: "Activity Feed",
    icon: "🛰️",
    features: ["Friend twaats", "Gig RSVPs", "Achievement reactions"],
  },
];

export interface TradingOption {
  title: string;
  details: string[];
}

export const tradingOptions: TradingOption[] = [
  {
    title: "Money Transfers",
    details: ["Peer-to-peer credits with daily caps", "Automatic tax ledger", "Request or send flow"],
  },
  {
    title: "Item Trading",
    details: ["Secure two-step confirmation window", "Gifting instruments, outfits, collectibles", "Trade history ledger"],
  },
  {
    title: "Shared Ownership",
    details: ["Lend stage gear with timers", "Share studio bookings", "Joint purchases for venues or festival licenses"],
  },
];

export interface CollaborationOpportunity {
  name: string;
  summary: string;
  benefits: string[];
}

export const collaborationOpportunities: CollaborationOpportunity[] = [
  {
    name: "Jam & Gig Invites",
    summary: "Start rehearsals directly from a friend's profile.",
    benefits: ["Fast action buttons", "Auto-create shared setlists", "Affinity XP rewards"],
  },
  {
    name: "Songwriting Sessions",
    summary: "Co-write tracks with shared fame and royalties.",
    benefits: ["Split ownership controls", "Shared draft notebooks", "Publishing contract tracking"],
  },
  {
    name: "Band Management",
    summary: "Run bands with friends using collaborative dashboards.",
    benefits: ["Role-based permissions", "Shared finances", "Tour planning tools"],
  },
  {
    name: "Festival & Studio Projects",
    summary: "Expand into world events with trusted allies.",
    benefits: ["Instant invite panels", "XP multipliers for duos", "Integrated calendar sync"],
  },
];

export interface SocialSpace {
  name: string;
  tagline: string;
  activities: string[];
}

export const socialSpaces: SocialSpace[] = [
  {
    name: "Artist Lofts",
    tagline: "Personal hangouts and customizable apartments.",
    activities: ["Invite-only meetups", "Record scratch tracks", "Display trophy shelves"],
  },
  {
    name: "Night Bars",
    tagline: "Public social hubs for networking and mini-games.",
    activities: ["Music trivia", "Freestyle battles", "Drop-in jam nights"],
  },
  {
    name: "Community Events",
    tagline: "Player-led parties, anniversaries, and celebrations.",
    activities: ["Birthday gigs", "Friendship anniversaries", "Spotlight showcases"],
  },
];

export interface SocialReward {
  name: string;
  criteria: string;
  reward: string;
}

export const socialRewards: SocialReward[] = [
  {
    name: "Most Connected",
    criteria: "Maintain the widest active friend network",
    reward: "+5% global social XP and unique profile badge",
  },
  {
    name: "Generous Soul",
    criteria: "Send gifts or resources weekly without missing a cycle",
    reward: "Exclusive gifting emote and tax rebate vouchers",
  },
  {
    name: "Legendary Bandmate",
    criteria: "Keep duo affinity maxed for 30 consecutive days",
    reward: "Unlocks legendary duo cosmetic set",
  },
];

export interface PrivacyControl {
  name: string;
  description: string;
  options: string[];
}

export const privacyControls: PrivacyControl[] = [
  {
    name: "Profile Visibility",
    description: "Decide who sees different layers of your profile.",
    options: ["Public highlight reel", "Friends-only stats", "Trusted-only backstage access"],
  },
  {
    name: "Safety Tools",
    description: "Manage boundaries instantly.",
    options: ["Block or report", "Pause DMs", "Hide online status"],
  },
  {
    name: "Trusted Friends",
    description: "Grant higher permissions to collaborators you rely on.",
    options: ["Co-own assets", "Share storage", "Auto-accept joint purchases"],
  },
];

export interface FutureHook {
  name: string;
  description: string;
  dependencies: string[];
}

export const futureHooks: FutureHook[] = [
  {
    name: "Twaater Messaging Bridge",
    description: "Share posts to DMs or respond to twaats without leaving chat.",
    dependencies: ["Existing Twaater API", "DM reaction system"],
  },
  {
    name: "Festival Economy Ties",
    description: "Allow gifting and money transfers inside festival UIs.",
    dependencies: ["Trading ledger", "Festival management"],
  },
  {
    name: "Narrative Storylines",
    description: "Trigger arcs when friendships hit legendary status or rivalries peak.",
    dependencies: ["Affinity tracking", "Story engine hooks"],
  },
];

export const exampleFlowSteps = [
  "Visit a friend's profile to review their bands and releases.",
  "Send a DM with a collaboration invite.",
  "Create a co-writing project request that appears in both dashboards.",
  "Earn friendship XP for the accepted collaboration.",
  "Unlock duo gig bonuses after three successful shows.",
];

export interface RelationshipAction {
  label: string;
  description: string;
  icon: LucideIcon;
}

export const relationshipQuickActions: RelationshipAction[] = [
  {
    label: "Check Affinity",
    description: "Open the friendship meter to view current perks and weekly progress.",
    icon: Handshake,
  },
  {
    label: "Send Message",
    description: "Jump straight into DMs or group chats from any profile entry point.",
    icon: MessageSquareHeart,
  },
  {
    label: "Gift & Trade",
    description: "Share resources, lend gear, or initiate a joint purchase.",
    icon: Gift,
  },
  {
    label: "Launch Collab",
    description: "Start a songwriting session, jam, or gig invitation in one tap.",
    icon: Sparkles,
  },
  {
    label: "Manage Permissions",
    description: "Assign trusted friend status or adjust privacy levels per collaborator.",
    icon: ShieldCheck,
  },
  {
    label: "Form Group",
    description: "Create fan clubs, band chats, or event-specific channels instantly.",
    icon: UsersRound,
  },
];

