export type MediaType = "tv" | "podcast" | "radio";

export interface MediaFacility {
  id: string;
  name: string;
  type: MediaType;
  city: string;
  reputation: number;
  technicalLevel: number;
  staff: string[];
  upgrades: string[];
  reachScore: number;
  specialization: string;
  sponsorTier: "bronze" | "silver" | "gold" | "platinum";
  activeCampaigns: string[];
}

export interface ShowFormatModule {
  id: string;
  label: string;
  description: string;
  unlocksAt: number;
  mediaTypes: MediaType[];
}

export interface MediaShow {
  id: string;
  name: string;
  mediaType: MediaType;
  host: string;
  genre: string;
  targetDemographic: string;
  monetizationModel: string;
  rating: number;
  novelty: number;
  sponsorshipHealth: number;
  distribution: string[];
  formatModules: string[];
}

export interface MediaScheduleItem {
  id: string;
  mediaType: MediaType;
  facilityId: string;
  showId: string;
  slot: string;
  exclusivity: "none" | "regional" | "global";
  rehearsalRequirement: number;
  marketingFocus: "buzz" | "sales" | "reach";
  predictedReach: number;
}

export interface MediaAnalyticsSnapshot {
  week: string;
  mediaBuzz: number;
  fanConversion: number;
  reach: number;
  sponsorSatisfaction: number;
}

export interface MediaCampaign {
  id: string;
  label: string;
  type: "label" | "manager" | "facility";
  durationWeeks: number;
  unlockRequires: string;
  bonuses: string[];
  costPerWeek: number;
}

export interface MediaBuzzEvent {
  id: string;
  title: string;
  description: string;
  impact: "positive" | "negative";
  magnitude: number;
  mitigation: string;
}

export const mediaFacilities: MediaFacility[] = [
  {
    id: "facility-aurora",
    name: "Aurora Broadcast Center",
    type: "tv",
    city: "Neo-Stockholm",
    reputation: 88,
    technicalLevel: 92,
    staff: ["Executive Producer", "Camera Director", "Lighting Designer", "Live Audience Coach"],
    upgrades: ["Holographic Stage", "Real-time Audience Sentiment Grid", "AI Script Assistants"],
    reachScore: 94,
    specialization: "Live music documentaries",
    sponsorTier: "platinum",
    activeCampaigns: ["Global Talk Show Tour", "Tourism Board Cultural Spotlight"],
  },
  {
    id: "facility-underground",
    name: "Underground Frequencies",
    type: "podcast",
    city: "Nightwave",
    reputation: 76,
    technicalLevel: 81,
    staff: ["Showrunner", "Audio Engineer", "Narrative Editor", "Localization Lead"],
    upgrades: ["Spatial Audio Suite", "Remote Collaboration Pods"],
    reachScore: 83,
    specialization: "Long-form storytelling",
    sponsorTier: "gold",
    activeCampaigns: ["Podcast Blitz", "Fan Club Exclusives"],
  },
  {
    id: "facility-skyline",
    name: "Skyline Resonance Radio",
    type: "radio",
    city: "Harmonia",
    reputation: 71,
    technicalLevel: 74,
    staff: ["Program Director", "Promotions Lead", "Call-in Moderator"],
    upgrades: ["Interactive Call-in Switchboard", "Regional Syndication Relays"],
    reachScore: 79,
    specialization: "Regional live performance showcases",
    sponsorTier: "silver",
    activeCampaigns: ["Regional Syndication", "Merchandise Tie-ins"],
  },
  {
    id: "facility-vanguard",
    name: "Vanguard Immersive Studios",
    type: "tv",
    city: "New L.A.",
    reputation: 82,
    technicalLevel: 89,
    staff: ["Creative Director", "XR Stage Crew", "Audience Warm-up Host"],
    upgrades: ["XR Volume", "Realtime Fan Holograms", "AI Translation Booths"],
    reachScore: 91,
    specialization: "Interactive fan call-ins",
    sponsorTier: "platinum",
    activeCampaigns: ["VR Stage Tour", "Sponsorship Elite"],
  },
  {
    id: "facility-signal",
    name: "Signal Flow Studios",
    type: "podcast",
    city: "Port Echo",
    reputation: 68,
    technicalLevel: 72,
    staff: ["Season Planner", "Producer", "Community Manager"],
    upgrades: ["Fan Narrative Lab", "Automated Highlight Reels"],
    reachScore: 74,
    specialization: "Fan community crossovers",
    sponsorTier: "bronze",
    activeCampaigns: ["Localization Sprint"],
  },
  {
    id: "facility-pulse",
    name: "Pulsewave Radio Network",
    type: "radio",
    city: "Volt City",
    reputation: 79,
    technicalLevel: 77,
    staff: ["Syndication Broker", "Live Mix Engineer", "Community Liaison"],
    upgrades: ["Dynamic Playlist AI", "Emergency PR Response Team"],
    reachScore: 86,
    specialization: "National chart countdowns",
    sponsorTier: "gold",
    activeCampaigns: ["Ad Network Expansion", "Crisis Shield"],
  },
];

export const showFormatModules: ShowFormatModule[] = [
  {
    id: "module-live-jam",
    label: "Live Jam Session",
    description: "Improvised collaboration segment that boosts buzz when chemistry is high.",
    unlocksAt: 20,
    mediaTypes: ["tv", "radio"],
  },
  {
    id: "module-fan-call",
    label: "Interactive Fan Call-ins",
    description: "Real-time audience engagement that increases loyalty.",
    unlocksAt: 30,
    mediaTypes: ["tv", "radio"],
  },
  {
    id: "module-vr-tour",
    label: "VR Stage Tour",
    description: "Immersive walkthrough of iconic venues boosting global reach.",
    unlocksAt: 45,
    mediaTypes: ["tv", "podcast"],
  },
  {
    id: "module-behind-scenes",
    label: "Behind-the-Scenes Exclusive",
    description: "Fan club premium content improving conversion.",
    unlocksAt: 25,
    mediaTypes: ["tv", "podcast"],
  },
  {
    id: "module-sponsor-spot",
    label: "Sponsor Showcase",
    description: "Dynamic brand placement with branching dialogue.",
    unlocksAt: 15,
    mediaTypes: ["tv", "podcast", "radio"],
  },
  {
    id: "module-clip-lab",
    label: "Clip Virality Lab",
    description: "Mini-game for optimizing highlight reels and Twaater posts.",
    unlocksAt: 35,
    mediaTypes: ["tv", "podcast"],
  },
];

export const mediaShows: MediaShow[] = [
  {
    id: "show-latewave",
    name: "Latewave Live",
    mediaType: "tv",
    host: "Mira Sol",
    genre: "Talk & Performance",
    targetDemographic: "18-34 urbans",
    monetizationModel: "Ad revenue + premium streaming",
    rating: 91,
    novelty: 82,
    sponsorshipHealth: 88,
    distribution: ["Prime Broadcast", "VOD", "Clip Network"],
    formatModules: ["module-live-jam", "module-fan-call", "module-clip-lab"],
  },
  {
    id: "show-deepcuts",
    name: "Deep Cuts Anthology",
    mediaType: "podcast",
    host: "Aiden Kross",
    genre: "Narrative Documentary",
    targetDemographic: "25-44 storytellers",
    monetizationModel: "Subscription + fan club exclusives",
    rating: 87,
    novelty: 90,
    sponsorshipHealth: 75,
    distribution: ["Podcast Apps", "Fan Club", "Localization Packs"],
    formatModules: ["module-behind-scenes", "module-vr-tour"],
  },
  {
    id: "show-signalboost",
    name: "Signal Boost",
    mediaType: "radio",
    host: "DJ Vela",
    genre: "Live Performance Spotlight",
    targetDemographic: "All-ages regional",
    monetizationModel: "Ad revenue + merch tie-ins",
    rating: 79,
    novelty: 68,
    sponsorshipHealth: 80,
    distribution: ["Live Broadcast", "Regional Syndication"],
    formatModules: ["module-live-jam", "module-sponsor-spot"],
  },
  {
    id: "show-orbit",
    name: "Orbit Sessions",
    mediaType: "podcast",
    host: "Lyra Chen",
    genre: "Artist Masterclasses",
    targetDemographic: "Aspiring musicians",
    monetizationModel: "Donation-driven + education bundles",
    rating: 84,
    novelty: 77,
    sponsorshipHealth: 70,
    distribution: ["Podcast Apps", "Education Portal"],
    formatModules: ["module-behind-scenes", "module-sponsor-spot"],
  },
  {
    id: "show-starlane",
    name: "Starlane Weekly",
    mediaType: "tv",
    host: "Rex Harper",
    genre: "Music News Magazine",
    targetDemographic: "Global mainstream",
    monetizationModel: "Ad revenue + syndication",
    rating: 86,
    novelty: 65,
    sponsorshipHealth: 92,
    distribution: ["Broadcast", "Syndication", "Clip Network"],
    formatModules: ["module-sponsor-spot", "module-clip-lab"],
  },
  {
    id: "show-midnight",
    name: "Midnight Frequencies",
    mediaType: "radio",
    host: "DJ Sora",
    genre: "Experimental Nightwave",
    targetDemographic: "Night owls",
    monetizationModel: "Ad revenue + interactive donations",
    rating: 82,
    novelty: 88,
    sponsorshipHealth: 64,
    distribution: ["Live Broadcast", "Archived Clips"],
    formatModules: ["module-fan-call", "module-sponsor-spot"],
  },
];

export const mediaSchedule: MediaScheduleItem[] = [
  {
    id: "slot-monday-prime",
    mediaType: "tv",
    facilityId: "facility-aurora",
    showId: "show-latewave",
    slot: "Mon 20:00 (Live)",
    exclusivity: "global",
    rehearsalRequirement: 85,
    marketingFocus: "buzz",
    predictedReach: 4.5,
  },
  {
    id: "slot-tuesday-stream",
    mediaType: "podcast",
    facilityId: "facility-underground",
    showId: "show-deepcuts",
    slot: "Tue 10:00 (Season drop)",
    exclusivity: "regional",
    rehearsalRequirement: 70,
    marketingFocus: "reach",
    predictedReach: 2.2,
  },
  {
    id: "slot-wed-drive",
    mediaType: "radio",
    facilityId: "facility-skyline",
    showId: "show-signalboost",
    slot: "Wed 17:00 (Drive time)",
    exclusivity: "none",
    rehearsalRequirement: 60,
    marketingFocus: "sales",
    predictedReach: 1.7,
  },
  {
    id: "slot-thu-global",
    mediaType: "tv",
    facilityId: "facility-vanguard",
    showId: "show-starlane",
    slot: "Thu 21:00 (Syndicated)",
    exclusivity: "global",
    rehearsalRequirement: 75,
    marketingFocus: "reach",
    predictedReach: 3.8,
  },
  {
    id: "slot-fri-late",
    mediaType: "radio",
    facilityId: "facility-pulse",
    showId: "show-midnight",
    slot: "Fri 23:30 (Live)",
    exclusivity: "regional",
    rehearsalRequirement: 55,
    marketingFocus: "buzz",
    predictedReach: 2.5,
  },
  {
    id: "slot-sat-premiere",
    mediaType: "podcast",
    facilityId: "facility-signal",
    showId: "show-orbit",
    slot: "Sat 09:00 (Premiere)",
    exclusivity: "none",
    rehearsalRequirement: 65,
    marketingFocus: "sales",
    predictedReach: 1.4,
  },
];

export const analyticsSnapshots: MediaAnalyticsSnapshot[] = [
  { week: "Week 1", mediaBuzz: 62, fanConversion: 18, reach: 2.8, sponsorSatisfaction: 75 },
  { week: "Week 2", mediaBuzz: 74, fanConversion: 22, reach: 3.1, sponsorSatisfaction: 78 },
  { week: "Week 3", mediaBuzz: 81, fanConversion: 28, reach: 3.9, sponsorSatisfaction: 82 },
  { week: "Week 4", mediaBuzz: 88, fanConversion: 31, reach: 4.2, sponsorSatisfaction: 86 },
  { week: "Week 5", mediaBuzz: 93, fanConversion: 36, reach: 4.8, sponsorSatisfaction: 89 },
];

export const mediaCampaigns: MediaCampaign[] = [
  {
    id: "campaign-global-talk",
    label: "Global Talk Show Tour",
    type: "label",
    durationWeeks: 6,
    unlockRequires: "Label prestige 3",
    bonuses: ["+12% global reach", "+8% syndication bids", "+5% media buzz"],
    costPerWeek: 45000,
  },
  {
    id: "campaign-podcast-blitz",
    label: "Podcast Blitz",
    type: "manager",
    durationWeeks: 4,
    unlockRequires: "Manager insight 2",
    bonuses: ["+15% subscription growth", "+10% fan loyalty"],
    costPerWeek: 18000,
  },
  {
    id: "campaign-syndication",
    label: "Regional Syndication Network",
    type: "facility",
    durationWeeks: 5,
    unlockRequires: "Facility reputation 70",
    bonuses: ["Unlocks 2 new cities", "+9% ad revenue share"],
    costPerWeek: 22000,
  },
  {
    id: "campaign-clip-lab",
    label: "Clip Virality Accelerator",
    type: "manager",
    durationWeeks: 3,
    unlockRequires: "Social media insight 2",
    bonuses: ["+30% clip CTR", "+12% Twaater followers"],
    costPerWeek: 12500,
  },
];

export const mediaBuzzEvents: MediaBuzzEvent[] = [
  {
    id: "buzz-viral",
    title: "Viral Clip Surge",
    description: "Latewave Live's holographic jam session trended worldwide on Twaater.",
    impact: "positive",
    magnitude: 24,
    mitigation: "Extend clip to premium subscribers before buzz decays.",
  },
  {
    id: "buzz-pr-crisis",
    title: "Technical Meltdown",
    description: "Signal Boost experienced dead air during a chart reveal, sparking memes.",
    impact: "negative",
    magnitude: 18,
    mitigation: "Deploy Crisis Shield playbook and schedule apology interview.",
  },
  {
    id: "buzz-fan-club",
    title: "Fan Club Documentary",
    description: "Deep Cuts Anthology released a behind-the-scenes season finale just for superfans.",
    impact: "positive",
    magnitude: 16,
    mitigation: "Convert the mini-documentary into a paid bundle next week.",
  },
  {
    id: "buzz-sponsor",
    title: "Sponsor Demands Shake-up",
    description: "Platinum partner requested more interactive placements on Starlane Weekly.",
    impact: "negative",
    magnitude: 12,
    mitigation: "Integrate Sponsor Showcase module and renegotiate ad split.",
  },
];
