/**
 * Fan Sentiment System (v1.0.953)
 * Tracks how fans feel about the band beyond raw numbers.
 * Sentiment shifts based on releases, gigs, social media, scandals, etc.
 * Affects merch sales, ticket demand, streaming loyalty, radio, video, and followers.
 */

export interface FanSentiment {
  score: number;           // -100 to 100
  mood: "hostile" | "frustrated" | "indifferent" | "pleased" | "devoted" | "fanatical";
  merchDemandMod: number;  // 0.5 – 1.5
  ticketDemandMod: number; // 0.6 – 1.4
  streamLoyaltyMod: number; // 0.7 – 1.3
  radioEngagementMod: number; // 0.7 – 1.3
  videoViewsMod: number;   // 0.6 – 1.4
  followerGrowthMod: number; // 0.6 – 1.4
  viralChance: number;      // 0 – 0.15 (chance of organic viral moment)
}

function getSentimentMood(score: number): FanSentiment["mood"] {
  if (score <= -60) return "hostile";
  if (score <= -20) return "frustrated";
  if (score <= 20) return "indifferent";
  if (score <= 50) return "pleased";
  if (score <= 80) return "devoted";
  return "fanatical";
}

/**
 * Get fan sentiment state from raw score.
 */
export function getFanSentiment(score: number): FanSentiment {
  const clamped = Math.max(-100, Math.min(100, score));
  const mood = getSentimentMood(clamped);
  const t = (clamped + 100) / 200; // 0 to 1

  return {
    score: clamped,
    mood,
    merchDemandMod: parseFloat((0.5 + t * 1.0).toFixed(2)),
    ticketDemandMod: parseFloat((0.6 + t * 0.8).toFixed(2)),
    streamLoyaltyMod: parseFloat((0.7 + t * 0.6).toFixed(2)),
    radioEngagementMod: parseFloat((0.7 + t * 0.6).toFixed(2)),
    videoViewsMod: parseFloat((0.6 + t * 0.8).toFixed(2)),
    followerGrowthMod: parseFloat((0.6 + t * 0.8).toFixed(2)),
    viralChance: parseFloat((Math.max(0, t - 0.5) * 0.3).toFixed(3)),
  };
}

/**
 * Events that shift fan sentiment.
 */
export const SENTIMENT_EVENTS: Record<string, number> = {
  // Positive
  amazing_gig: 8,
  album_release: 10,
  single_release: 5,
  chart_hit: 12,
  fan_interaction: 4,
  free_concert: 15,
  charity_event: 10,
  social_media_engagement: 3,
  merch_quality_high: 5,
  music_video_release: 6,
  award_win: 12,
  comeback_after_hiatus: 8,

  // Negative
  bad_gig: -8,
  cancelled_show: -15,
  price_gouge_tickets: -12,
  ignoring_fans: -6,
  scandal: -20,
  sellout_perception: -10,
  low_quality_release: -8,
  long_hiatus_no_communication: -5,
  merch_quality_low: -7,
  band_breakup_rumor: -10,
};

/**
 * Apply a sentiment event.
 */
export function applySentimentEvent(currentScore: number, eventKey: string): { newScore: number; change: number } {
  const change = SENTIMENT_EVENTS[eventKey] ?? 0;
  const newScore = Math.max(-100, Math.min(100, currentScore + change));
  return { newScore, change };
}

/**
 * Daily sentiment drift: extreme values slowly normalize.
 */
export function dailySentimentDrift(currentScore: number): number {
  if (Math.abs(currentScore) <= 5) return currentScore;
  const drift = currentScore > 0 ? -0.5 : 0.5;
  return parseFloat((currentScore + drift).toFixed(1));
}

/**
 * Calculate sentiment from recent activity metrics.
 */
export function estimateSentimentFromActivity(
  recentGigRating: number,   // 0-25 average
  releaseFrequencyDays: number, // days since last release
  socialEngagementRate: number, // 0-100
  scandalCount: number         // recent scandals
): number {
  let score = 0;
  
  // Gig quality contributes up to ±30
  score += ((recentGigRating / 25) - 0.5) * 60;
  
  // Release frequency: penalize long gaps
  if (releaseFrequencyDays > 90) score -= 10;
  else if (releaseFrequencyDays > 180) score -= 25;
  else if (releaseFrequencyDays < 30) score += 10;
  
  // Social engagement
  score += (socialEngagementRate / 100) * 20;
  
  // Scandals
  score -= scandalCount * 15;
  
  return Math.max(-100, Math.min(100, Math.round(score)));
}
