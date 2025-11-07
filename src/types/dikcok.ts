export interface DikCokVideoType {
  id: string;
  name: string;
  category: string;
  description: string;
  difficulty: "Easy" | "Medium" | "Advanced";
  unlockRequirement: string;
  durationHint: string;
  signatureEffects: string[];
}

export interface DikCokBand {
  id: string;
  name: string;
  genre: string;
  hype: number;
  fans: number;
  fameTier: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";
  trendTag: string;
  momentum: "Surging" | "Rising" | "Steady" | "Cooling";
  analytics: {
    videosCreated: number;
    averageEngagement: number;
    duetParticipationRate: number;
    fanConversionRate: number;
  };
}

export interface DikCokTrack {
  id: string;
  bandId: string;
  title: string;
  genre: string;
  bpm: number;
  mood: string;
  usage: "Open" | "Fans Only" | "Event Exclusive" | "Premium";
  popularityScore: number;
  featuredIn: number;
  unlocks?: string[];
}

export interface DikCokTrendVideo {
  id: string;
  title: string;
  creator: string;
  bandId: string;
  videoTypeId: string;
  views: number;
  hypeGain: number;
  fanGain: number;
  trendingTag: string;
  engagementVelocity: "Exploding" | "Trending" | "Stable" | "Niche";
  bestForFeeds: ("ForYou" | "Trending" | "FanFavorites" | "Friends")[];
}

export interface DikCokChallenge {
  id: string;
  name: string;
  theme: string;
  startsAt: string;
  endsAt: string;
  requirements: string[];
  rewards: string[];
  sponsor?: string;
  crossGameHook?: string;
}

export interface DikCokFanMission {
  id: string;
  bandId: string;
  description: string;
  expiresAt: string;
  rewards: string[];
}

export interface DikCokGuild {
  id: string;
  name: string;
  focus: string;
  members: number;
  weeklyHype: number;
  ranking: number;
  perks: string[];
}

export interface DikCokForecast {
  id: string;
  trendTag: string;
  predictionWindow: string;
  projectedOutcome: string;
  confidence: number;
  wagerRange: string;
}

export interface DikCokPremiere {
  id: string;
  bandId: string;
  title: string;
  scheduledFor: string;
  exclusiveTemplate: string;
  perks: string[];
}

export interface DikCokStoryChain {
  id: string;
  title: string;
  description: string;
  episodes: number;
  progress: number;
  rewards: string[];
}

export interface DikCokRadioSlot {
  id: string;
  trackId: string;
  mood: string;
  featureHook: string;
}

export interface DikCokArchivedClassic {
  id: string;
  title: string;
  originalCreator: string;
  originalBand: string;
  season: string;
  remixOpensIn: string;
}

export interface DikCokGeoTrend {
  region: string;
  topTrend: string;
  growth: number;
  opportunityTag: string;
}

export interface DikCokPoll {
  id: string;
  question: string;
  options: string[];
  totalVotes: number;
}
