/**
 * DikCok Virality Algorithm
 * Calculates engagement scores, trending rankings, and simulates view growth over time.
 */

export interface ViralityFactors {
  views: number;
  hypeGained: number;
  fanGain: number;
  bandFame: number;
  challengeBonus: boolean;
  videoAge: number; // hours since creation
  videoTypeCategory: string;
}

export interface ViralityScore {
  trendingScore: number;
  engagementRate: number;
  viralPotential: number;
  decayMultiplier: number;
  projectedViews24h: number;
}

const CATEGORY_MULTIPLIERS: Record<string, number> = {
  performance: 1.2,
  behind_the_scenes: 1.0,
  challenge: 1.5,
  comedy: 1.3,
  tutorial: 0.9,
  vlog: 0.8,
  collaboration: 1.4,
  default: 1.0,
};

/**
 * Calculate time-based decay — videos lose trending momentum over time.
 * Uses accelerated game time (1 real day = 3 game days).
 */
export function calculateDecay(hoursOld: number): number {
  // Half-life of ~18 hours for trending purposes
  const halfLife = 18;
  return Math.pow(0.5, hoursOld / halfLife);
}

/**
 * Calculate the trending score for a video.
 * Incorporates views, engagement, recency, and band fame.
 */
export function calculateTrendingScore(factors: ViralityFactors): ViralityScore {
  const decay = calculateDecay(factors.videoAge);
  const categoryMultiplier = CATEGORY_MULTIPLIERS[factors.videoTypeCategory] ?? CATEGORY_MULTIPLIERS.default;

  // Base engagement = views weighted by recency
  const viewVelocity = factors.views / Math.max(factors.videoAge, 1);
  
  // Engagement rate: how much hype + fans per view
  const engagementRate = factors.views > 0
    ? ((factors.hypeGained + factors.fanGain * 2) / factors.views) * 100
    : 0;

  // Fame amplifier — famous bands get more organic reach (diminishing returns)
  const fameAmplifier = 1 + Math.log10(Math.max(factors.bandFame, 1)) * 0.15;

  // Challenge bonus for participating in active challenges
  const challengeBoost = factors.challengeBonus ? 1.3 : 1.0;

  // Trending score combines velocity, engagement, and modifiers
  const trendingScore = Math.round(
    (viewVelocity * 10 + engagementRate * 5 + factors.hypeGained * 0.5) *
    decay *
    categoryMultiplier *
    fameAmplifier *
    challengeBoost
  );

  // Viral potential (0-100) — indicates likelihood of exponential growth
  const viralPotential = Math.min(100, Math.round(
    (viewVelocity > 50 ? 30 : viewVelocity > 10 ? 15 : 5) +
    (engagementRate > 5 ? 25 : engagementRate > 2 ? 12 : 3) +
    (factors.challengeBonus ? 15 : 0) +
    (factors.bandFame > 1000 ? 20 : factors.bandFame > 100 ? 10 : 0) +
    (categoryMultiplier > 1.2 ? 10 : 0)
  ));

  // Project 24h views based on current velocity and decay curve
  const projectedViews24h = Math.round(
    factors.views + viewVelocity * 24 * decay * fameAmplifier * 0.6
  );

  return {
    trendingScore,
    engagementRate: Math.round(engagementRate * 10) / 10,
    viralPotential,
    decayMultiplier: Math.round(decay * 100) / 100,
    projectedViews24h,
  };
}

/**
 * Simulate organic view growth for a video.
 * Called when displaying videos to add simulated growth.
 */
export function simulateViewGrowth(
  currentViews: number,
  bandFame: number,
  hoursOld: number,
  viralPotential: number
): number {
  if (hoursOld < 0.5) return 0; // Too new

  const decay = calculateDecay(hoursOld);
  const baseGrowth = Math.log2(Math.max(currentViews, 1)) * 2;
  const fameBoost = Math.log10(Math.max(bandFame, 1)) * 3;
  const viralBoost = viralPotential > 50 ? viralPotential / 20 : 0;

  const growthRate = (baseGrowth + fameBoost + viralBoost) * decay;
  const variance = 1 + (Math.random() - 0.5) * 0.4; // ±20% variance

  return Math.max(0, Math.round(growthRate * variance));
}

/**
 * Rank an array of videos by trending score.
 */
export function rankByTrending<T extends { id: string }>(
  videos: T[],
  getFactors: (video: T) => ViralityFactors
): (T & { virality: ViralityScore })[] {
  return videos
    .map((video) => ({
      ...video,
      virality: calculateTrendingScore(getFactors(video)),
    }))
    .sort((a, b) => b.virality.trendingScore - a.virality.trendingScore);
}
