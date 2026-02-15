import { supabase } from "@/integrations/supabase/client";

interface BandMetrics {
  fame: number;
  total_fans: number;
  release_count: number;
}

interface ContractOfferTerms {
  advance_amount: number;
  royalty_artist_pct: number;
  royalty_label_pct: number;
  single_quota: number;
  album_quota: number;
  term_months: number;
  termination_fee_pct: number;
  manufacturing_covered: boolean;
  territories: string[];
  contract_value: number;
}

/**
 * Generate contract offer terms based on band/artist metrics
 * Larger bands get better deals:
 * - Higher advances
 * - Better royalty splits
 * - Lower termination fees
 */
export function generateContractTerms(
  metrics: BandMetrics,
  labelReputation: number,
  songQuality: number
): ContractOfferTerms {
  const { fame, total_fans, release_count } = metrics;

  // Determine band tier
  let tier: "small" | "medium" | "large" | "major";
  if (total_fans >= 50000 || fame >= 80) {
    tier = "major";
  } else if (total_fans >= 10000 || fame >= 50) {
    tier = "large";
  } else if (total_fans >= 1000 || fame >= 20) {
    tier = "medium";
  } else {
    tier = "small";
  }

  // Quality bonus (0-20% improvement on terms)
  const qualityBonus = Math.min(songQuality / 500, 0.2);

  // Base terms by tier
  const tierConfig = {
    small: {
      advanceBase: 1000,
      advanceMax: 10000,
      artistRoyaltyBase: 12,
      artistRoyaltyMax: 20,
      singleQuota: 4,
      albumQuota: 1,
      termMonths: 36,
      terminationFeePct: 60,
    },
    medium: {
      advanceBase: 5000,
      advanceMax: 30000,
      artistRoyaltyBase: 18,
      artistRoyaltyMax: 30,
      singleQuota: 3,
      albumQuota: 1,
      termMonths: 30,
      terminationFeePct: 50,
    },
    large: {
      advanceBase: 20000,
      advanceMax: 100000,
      artistRoyaltyBase: 25,
      artistRoyaltyMax: 40,
      singleQuota: 2,
      albumQuota: 2,
      termMonths: 24,
      terminationFeePct: 40,
    },
    major: {
      advanceBase: 50000,
      advanceMax: 500000,
      artistRoyaltyBase: 35,
      artistRoyaltyMax: 50,
      singleQuota: 2,
      albumQuota: 1,
      termMonths: 18,
      terminationFeePct: 25,
    },
  };

  const config = tierConfig[tier];

  // Calculate actual values with some randomness
  const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
  const fameMultiplier = 1 + (fame / 100) * 0.5;
  const fanMultiplier = 1 + Math.log10(Math.max(total_fans, 1)) * 0.1;
  const experienceMultiplier = 1 + Math.min(release_count * 0.05, 0.25);

  // Higher label reputation = slightly worse terms for artist (they're pickier)
  const labelFactor = 1 - (labelReputation / 400);

  const advance = Math.min(
    Math.round(
      config.advanceBase +
      (config.advanceMax - config.advanceBase) *
      fameMultiplier *
      fanMultiplier *
      (1 + qualityBonus) *
      randomFactor *
      labelFactor
    ),
    config.advanceMax * 3 // Hard cap at 3x tier max to prevent integer overflow
  );

  const artistRoyalty = Math.round(
    config.artistRoyaltyBase +
    (config.artistRoyaltyMax - config.artistRoyaltyBase) *
    (fameMultiplier - 1) *
    experienceMultiplier *
    (1 + qualityBonus)
  );

  // Clamp royalty
  const clampedArtistRoyalty = Math.min(Math.max(artistRoyalty, config.artistRoyaltyBase), config.artistRoyaltyMax);

  // Termination fee decreases with artist power
  const terminationFee = Math.round(
    config.terminationFeePct * (1 - qualityBonus * 0.5) * (2 - fameMultiplier)
  );
  const clampedTerminationFee = Math.min(Math.max(terminationFee, 15), 70);

  // Territory coverage improves with tier
  const territoryOptions = ["NA", "EU", "UK", "ASIA", "LATAM", "OCEANIA"];
  const territoryCoverage = tier === "major" ? 6 : tier === "large" ? 4 : tier === "medium" ? 2 : 1;
  const territories = territoryOptions.slice(0, territoryCoverage);

  // Calculate estimated contract value
  const contractValue = advance + 
    (config.singleQuota * 5000) + 
    (config.albumQuota * 25000);

  return {
    advance_amount: advance,
    royalty_artist_pct: clampedArtistRoyalty,
    royalty_label_pct: 100 - clampedArtistRoyalty,
    single_quota: config.singleQuota,
    album_quota: config.albumQuota,
    term_months: config.termMonths,
    termination_fee_pct: clampedTerminationFee,
    manufacturing_covered: true,
    territories,
    contract_value: contractValue,
  };
}

/**
 * Fetch band metrics for contract generation
 */
export async function fetchBandMetrics(bandId: string): Promise<BandMetrics> {
  const { data: band } = await supabase
    .from("bands")
    .select("fame, total_fans")
    .eq("id", bandId)
    .single();

  const { count: releaseCount } = await supabase
    .from("releases")
    .select("*", { count: "exact", head: true })
    .eq("band_id", bandId)
    .eq("release_status", "released");

  return {
    fame: band?.fame ?? 0,
    total_fans: band?.total_fans ?? 0,
    release_count: releaseCount ?? 0,
  };
}

/**
 * Fetch solo artist metrics for contract generation
 */
export async function fetchArtistMetrics(profileId: string): Promise<BandMetrics> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("fame, fans")
    .eq("id", profileId)
    .single();

  const { count: releaseCount } = await supabase
    .from("releases")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profileId)
    .eq("release_status", "released");

  return {
    fame: profile?.fame ?? 0,
    total_fans: profile?.fans ?? 0,
    release_count: releaseCount ?? 0,
  };
}

/**
 * Check if a label should accept a demo based on quality and metrics
 */
export function shouldAcceptDemo(
  songQuality: number,
  bandMetrics: BandMetrics,
  labelReputation: number,
  genreMatch: boolean
): { accepted: boolean; reason?: string } {
  // Base acceptance threshold based on label reputation
  // Higher rep labels are pickier
  const baseThreshold = 30 + (labelReputation * 0.3);

  // Calculate demo score
  let score = songQuality;
  score += bandMetrics.fame * 0.5;
  score += Math.log10(Math.max(bandMetrics.total_fans, 1)) * 10;
  score += bandMetrics.release_count * 5;
  if (genreMatch) score += 15;

  // Add some randomness (labels can take chances)
  score += (Math.random() - 0.5) * 20;

  if (score >= baseThreshold) {
    return { accepted: true };
  }

  // Generate rejection reason
  const reasons = [
    "We're not currently looking for artists in this genre.",
    "Your sound doesn't quite fit our roster at this time.",
    "We loved the demo but our A&R schedule is full.",
    "Keep working on your craft and resubmit in a few months.",
    "Great potential, but we need to see more streaming numbers first.",
  ];

  return {
    accepted: false,
    reason: reasons[Math.floor(Math.random() * reasons.length)],
  };
}