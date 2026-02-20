// Social Drama Event Generator — Types & Configuration

// ─── Drama Categories ───────────────────────────────────

export type SocialDramaCategory =
  | 'public_breakup' | 'affair_exposed' | 'diss_track'
  | 'onstage_fight' | 'surprise_wedding' | 'custody_dispute'
  | 'rehab_announcement' | 'feud_escalation' | 'public_apology'
  | 'leaked_dms' | 'award_snub_rant' | 'contract_dispute';

export type DramaSeverity = 'minor' | 'moderate' | 'major' | 'explosive';
export type OutletTone = 'tabloid' | 'serious' | 'gossip' | 'supportive' | 'neutral';

// ─── DB Row Types ───────────────────────────────────────

export interface SocialDramaEvent {
  id: string;
  primary_entity_id: string;
  primary_entity_type: 'player' | 'npc' | 'band';
  primary_entity_name: string;
  secondary_entity_id: string | null;
  secondary_entity_type: 'player' | 'npc' | 'band' | null;
  secondary_entity_name: string | null;
  drama_category: SocialDramaCategory;
  severity: DramaSeverity;
  headline: string;
  description: string;
  reputation_impact: ReputationImpact[];
  fan_loyalty_change: number;
  streaming_multiplier: number;
  chart_boost: number;
  fame_change: number;
  effect_duration_days: number;
  effects_active: boolean;
  effects_expire_at: string | null;
  media_article_id: string | null;
  went_viral: boolean;
  viral_score: number;
  twaater_hashtag: string | null;
  is_active: boolean;
  resolved: boolean;
  resolved_at: string | null;
  follow_up_event_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GeneratedMediaArticle {
  id: string;
  drama_event_id: string | null;
  source_type: 'drama' | 'achievement' | 'chart' | 'gig' | 'release' | 'editorial';
  outlet_name: string;
  outlet_tone: OutletTone;
  headline: string;
  subheadline: string | null;
  body_text: string;
  tags: string[];
  mentioned_entity_ids: string[];
  mentioned_entity_names: string[];
  reader_count: number;
  share_count: number;
  sentiment_score: number;
  controversy_score: number;
  is_published: boolean;
  is_breaking: boolean;
  featured: boolean;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ReputationImpact {
  axis: 'authenticity' | 'attitude' | 'reliability' | 'creativity';
  change: number;
}

// ─── Media Outlets ──────────────────────────────────────

export interface MediaOutlet {
  name: string;
  tone: OutletTone;
  fameThreshold: number; // Minimum fame to be covered
  controversyBias: number; // How much they love controversy (0-100)
}

export const MEDIA_OUTLETS: MediaOutlet[] = [
  { name: 'RockMundo Daily', tone: 'neutral', fameThreshold: 0, controversyBias: 30 },
  { name: 'The Scandal Sheet', tone: 'tabloid', fameThreshold: 100, controversyBias: 90 },
  { name: 'Music Insider', tone: 'serious', fameThreshold: 500, controversyBias: 20 },
  { name: 'Gossip Riff', tone: 'gossip', fameThreshold: 200, controversyBias: 80 },
  { name: 'Fan Pulse', tone: 'supportive', fameThreshold: 50, controversyBias: 15 },
  { name: 'Chart Watch Weekly', tone: 'neutral', fameThreshold: 1000, controversyBias: 25 },
  { name: 'Underground Buzz', tone: 'supportive', fameThreshold: 0, controversyBias: 10 },
  { name: 'Celebrity Scoop', tone: 'tabloid', fameThreshold: 2000, controversyBias: 95 },
];

// ─── Drama Event Presets ────────────────────────────────

export interface DramaPreset {
  category: SocialDramaCategory;
  label: string;
  defaultSeverity: DramaSeverity;
  // Headline templates — {primary} and {secondary} are replaced with entity names
  headlines: string[];
  bodyTemplates: string[];
  // Impacts
  reputationImpact: ReputationImpact[];
  fanLoyaltyChange: { min: number; max: number };
  streamingMultiplier: { min: number; max: number };
  chartBoost: { min: number; max: number };
  fameChange: { min: number; max: number };
  effectDurationDays: number;
  viralChance: number; // 0-100
  // Integration
  emotionalPresets: string[]; // Keys into emotional engine
  bandChemistrySource: string | null; // Trigger source for band chemistry engine
  twaaterHashtagTemplate: string;
}

export const SOCIAL_DRAMA_PRESETS: Record<SocialDramaCategory, DramaPreset> = {
  public_breakup: {
    category: 'public_breakup', label: 'Public Breakup', defaultSeverity: 'major',
    headlines: [
      'BREAKING: {primary} and {secondary} Call It Quits!',
      '{primary} Confirms Split From {secondary}',
      'Heartbreak in the Music World: {primary} & {secondary} Are Over',
    ],
    bodyTemplates: [
      'Sources close to {primary} confirm the relationship with {secondary} has ended after weeks of speculation. Fans are divided, with some showing support and others expressing disappointment.',
      'The once-inseparable pair were spotted leaving separately after what witnesses describe as an emotional final conversation. Neither party has released an official statement yet.',
    ],
    reputationImpact: [{ axis: 'authenticity', change: -3 }],
    fanLoyaltyChange: { min: -15, max: -5 },
    streamingMultiplier: { min: 1.2, max: 1.8 }, // Breakup curiosity boost
    chartBoost: { min: 5, max: 15 },
    fameChange: { min: 50, max: 200 },
    effectDurationDays: 10,
    viralChance: 45,
    emotionalPresets: ['heartbreak', 'public_humiliation'],
    bandChemistrySource: 'romantic_breakup',
    twaaterHashtagTemplate: '{primary}Breakup',
  },

  affair_exposed: {
    category: 'affair_exposed', label: 'Affair Exposed', defaultSeverity: 'explosive',
    headlines: [
      'SCANDAL: {primary} Caught Cheating on {secondary}!',
      'Affair EXPOSED — {primary}\'s Secret Relationship Revealed',
      'Betrayal! {primary} and Mystery Partner Photographed Together',
    ],
    bodyTemplates: [
      'Explosive photos have surfaced showing {primary} in a compromising situation, sending shockwaves through the music community. {secondary} has reportedly been blindsided by the revelation.',
      'What started as rumors on social media has been confirmed — {primary} has been carrying on a secret relationship. The fallout is expected to be significant.',
    ],
    reputationImpact: [
      { axis: 'authenticity', change: -12 },
      { axis: 'reliability', change: -8 },
    ],
    fanLoyaltyChange: { min: -30, max: -10 },
    streamingMultiplier: { min: 1.5, max: 3.0 }, // Scandal = massive curiosity streams
    chartBoost: { min: 10, max: 30 },
    fameChange: { min: 100, max: 500 },
    effectDurationDays: 14,
    viralChance: 80,
    emotionalPresets: ['public_humiliation', 'betrayal_felt'],
    bandChemistrySource: 'romantic_breakup',
    twaaterHashtagTemplate: '{primary}Exposed',
  },

  diss_track: {
    category: 'diss_track', label: 'Diss Track', defaultSeverity: 'major',
    headlines: [
      '{primary} Drops BRUTAL Diss Track Aimed at {secondary}!',
      'Gloves Off: {primary} Goes Full Savage on New Single',
      'Music Beef Escalates — {primary} Fires Shots at {secondary}',
    ],
    bodyTemplates: [
      '{primary} has released a scathing new track with barely-veiled references to {secondary}. Lines like the bridge have fans dissecting every word. Will {secondary} respond?',
      'The music industry is buzzing after {primary} dropped what many are calling the most brutal diss track of the year, targeting {secondary}. Social media is ablaze.',
    ],
    reputationImpact: [
      { axis: 'attitude', change: -5 },
      { axis: 'creativity', change: 5 },
    ],
    fanLoyaltyChange: { min: -5, max: 15 }, // Can actually gain fans
    streamingMultiplier: { min: 2.0, max: 3.0 }, // Diss tracks get massive streams
    chartBoost: { min: 15, max: 40 },
    fameChange: { min: 200, max: 800 },
    effectDurationDays: 7,
    viralChance: 70,
    emotionalPresets: ['revenge_success'],
    bandChemistrySource: 'rivalry',
    twaaterHashtagTemplate: '{primary}vs{secondary}',
  },

  onstage_fight: {
    category: 'onstage_fight', label: 'On-Stage Fight', defaultSeverity: 'explosive',
    headlines: [
      'CHAOS: {primary} and {secondary} Brawl ON STAGE!',
      'Concert Descends Into Chaos as {primary} Throws Hands',
      'WATCH: Fists Fly at {primary} Concert — Gig Cancelled Mid-Set',
    ],
    bodyTemplates: [
      'Fans at last night\'s show witnessed an unprecedented scene as {primary} and {secondary} got into a physical altercation mid-performance. Security intervened, and the show was cut short.',
      'Video footage going viral shows the moment tensions boiled over between {primary} and {secondary} during what was supposed to be a routine set. Venue management has issued a statement.',
    ],
    reputationImpact: [
      { axis: 'attitude', change: -10 },
      { axis: 'reliability', change: -8 },
    ],
    fanLoyaltyChange: { min: -25, max: -5 },
    streamingMultiplier: { min: 1.3, max: 2.5 },
    chartBoost: { min: 5, max: 20 },
    fameChange: { min: 150, max: 600 },
    effectDurationDays: 14,
    viralChance: 90,
    emotionalPresets: ['public_humiliation', 'rival_conflict'],
    bandChemistrySource: 'rivalry',
    twaaterHashtagTemplate: '{primary}Fight',
  },

  surprise_wedding: {
    category: 'surprise_wedding', label: 'Surprise Wedding', defaultSeverity: 'major',
    headlines: [
      'JUST MARRIED! {primary} and {secondary} Tie the Knot in Secret Ceremony!',
      'Surprise! {primary} Reveals Secret Wedding to {secondary}',
      'Love Wins: {primary} & {secondary} Elope in Intimate Ceremony',
    ],
    bodyTemplates: [
      'In a move that stunned fans and the media alike, {primary} and {secondary} have officially tied the knot in a private ceremony. The couple shared the news on social media, sending congratulations flooding in.',
      'It\'s official — {primary} and {secondary} are married! The secret ceremony took place with only close friends in attendance, and the internet has erupted with well-wishes.',
    ],
    reputationImpact: [
      { axis: 'authenticity', change: 8 },
      { axis: 'reliability', change: 5 },
    ],
    fanLoyaltyChange: { min: 5, max: 25 },
    streamingMultiplier: { min: 1.2, max: 1.6 },
    chartBoost: { min: 5, max: 15 },
    fameChange: { min: 100, max: 400 },
    effectDurationDays: 7,
    viralChance: 60,
    emotionalPresets: ['major_milestone', 'friend_gained'],
    bandChemistrySource: null,
    twaaterHashtagTemplate: '{primary}Wedding',
  },

  custody_dispute: {
    category: 'custody_dispute', label: 'Custody Dispute', defaultSeverity: 'major',
    headlines: [
      '{primary} and {secondary} Locked in Bitter Custody Battle',
      'Court Drama: {primary} Files for Sole Custody',
      'Family Feud — {primary} and {secondary}\'s Private War Goes Public',
    ],
    bodyTemplates: [
      'What started as a private matter has become very public — {primary} and {secondary} are now embroiled in a contentious custody dispute. Legal representatives for both sides have declined to comment.',
      'The ongoing custody battle between {primary} and {secondary} has taken another dramatic turn, with court filings revealing explosive allegations from both parties.',
    ],
    reputationImpact: [
      { axis: 'reliability', change: -5 },
      { axis: 'authenticity', change: -3 },
    ],
    fanLoyaltyChange: { min: -20, max: -5 },
    streamingMultiplier: { min: 0.9, max: 1.3 },
    chartBoost: { min: 0, max: 5 },
    fameChange: { min: 50, max: 150 },
    effectDurationDays: 21,
    viralChance: 35,
    emotionalPresets: ['heartbreak', 'negative_press'],
    bandChemistrySource: null,
    twaaterHashtagTemplate: '{primary}CustodyBattle',
  },

  rehab_announcement: {
    category: 'rehab_announcement', label: 'Rehab Announcement', defaultSeverity: 'moderate',
    headlines: [
      '{primary} Enters Rehab — "Time to Focus on Healing"',
      'Taking a Step Back: {primary} Announces Break for Recovery',
    ],
    bodyTemplates: [
      '{primary} has announced they will be stepping away from the spotlight to focus on personal health. Fans and fellow artists have responded with overwhelming support.',
    ],
    reputationImpact: [{ axis: 'authenticity', change: 5 }],
    fanLoyaltyChange: { min: -5, max: 10 },
    streamingMultiplier: { min: 1.1, max: 1.4 },
    chartBoost: { min: 0, max: 5 },
    fameChange: { min: 30, max: 100 },
    effectDurationDays: 14,
    viralChance: 30,
    emotionalPresets: ['positive_press'],
    bandChemistrySource: null,
    twaaterHashtagTemplate: 'Support{primary}',
  },

  feud_escalation: {
    category: 'feud_escalation', label: 'Feud Escalation', defaultSeverity: 'major',
    headlines: [
      'Feud Alert: {primary} vs {secondary} Just Got REAL',
      '{primary} Fires Back at {secondary} in Explosive Interview',
    ],
    bodyTemplates: [
      'The simmering rivalry between {primary} and {secondary} has reached new heights after {primary} made scathing comments in a recent interview. Industry watchers predict this won\'t end quietly.',
    ],
    reputationImpact: [{ axis: 'attitude', change: -6 }],
    fanLoyaltyChange: { min: -10, max: 5 },
    streamingMultiplier: { min: 1.3, max: 2.0 },
    chartBoost: { min: 5, max: 20 },
    fameChange: { min: 80, max: 300 },
    effectDurationDays: 10,
    viralChance: 55,
    emotionalPresets: ['rival_conflict'],
    bandChemistrySource: 'rivalry',
    twaaterHashtagTemplate: '{primary}vs{secondary}',
  },

  public_apology: {
    category: 'public_apology', label: 'Public Apology', defaultSeverity: 'moderate',
    headlines: [
      '{primary} Issues Heartfelt Public Apology',
      '"I Was Wrong" — {primary} Apologizes to {secondary} and Fans',
    ],
    bodyTemplates: [
      'In a lengthy statement posted on social media, {primary} has apologized for recent behavior, calling it "a wake-up call." Fan reaction has been mixed, with many appreciating the honesty.',
    ],
    reputationImpact: [
      { axis: 'authenticity', change: 6 },
      { axis: 'attitude', change: 4 },
    ],
    fanLoyaltyChange: { min: 5, max: 15 },
    streamingMultiplier: { min: 1.0, max: 1.2 },
    chartBoost: { min: 0, max: 5 },
    fameChange: { min: 20, max: 80 },
    effectDurationDays: 5,
    viralChance: 25,
    emotionalPresets: ['positive_press'],
    bandChemistrySource: null,
    twaaterHashtagTemplate: '{primary}Apology',
  },

  leaked_dms: {
    category: 'leaked_dms', label: 'Leaked DMs', defaultSeverity: 'major',
    headlines: [
      'LEAKED: {primary}\'s Private Messages Exposed!',
      'DM Scandal — {primary}\'s Texts With {secondary} Go Viral',
    ],
    bodyTemplates: [
      'Private messages allegedly sent by {primary} have been leaked online, revealing shocking conversations about {secondary}. The authenticity of the messages has not been confirmed.',
    ],
    reputationImpact: [
      { axis: 'authenticity', change: -8 },
      { axis: 'reliability', change: -5 },
    ],
    fanLoyaltyChange: { min: -20, max: -5 },
    streamingMultiplier: { min: 1.3, max: 2.0 },
    chartBoost: { min: 5, max: 15 },
    fameChange: { min: 100, max: 300 },
    effectDurationDays: 10,
    viralChance: 75,
    emotionalPresets: ['public_humiliation', 'betrayal_felt'],
    bandChemistrySource: 'public_scandal',
    twaaterHashtagTemplate: '{primary}Leaked',
  },

  award_snub_rant: {
    category: 'award_snub_rant', label: 'Award Snub Rant', defaultSeverity: 'moderate',
    headlines: [
      '{primary} Goes Off on Award Snub: "This Industry Is Rigged!"',
      'Sore Loser? {primary} Blasts Awards Committee',
    ],
    bodyTemplates: [
      'After being overlooked for a major award, {primary} took to social media in a fiery rant, accusing the committee of bias. The post has divided fans and the industry alike.',
    ],
    reputationImpact: [
      { axis: 'attitude', change: -8 },
      { axis: 'authenticity', change: 3 },
    ],
    fanLoyaltyChange: { min: -10, max: 5 },
    streamingMultiplier: { min: 1.1, max: 1.5 },
    chartBoost: { min: 3, max: 10 },
    fameChange: { min: 50, max: 150 },
    effectDurationDays: 5,
    viralChance: 40,
    emotionalPresets: ['negative_press', 'rival_charted_higher'],
    bandChemistrySource: null,
    twaaterHashtagTemplate: '{primary}Robbed',
  },

  contract_dispute: {
    category: 'contract_dispute', label: 'Contract Dispute', defaultSeverity: 'moderate',
    headlines: [
      '{primary} at War with Label Over Contract Terms',
      'Legal Battle: {primary} Seeks Release From Record Deal',
    ],
    bodyTemplates: [
      '{primary} has publicly called out their label, accusing them of unfair practices. The dispute could have major implications for upcoming releases and touring plans.',
    ],
    reputationImpact: [{ axis: 'authenticity', change: 4 }],
    fanLoyaltyChange: { min: -5, max: 10 },
    streamingMultiplier: { min: 0.8, max: 1.2 },
    chartBoost: { min: 0, max: 5 },
    fameChange: { min: 30, max: 120 },
    effectDurationDays: 14,
    viralChance: 20,
    emotionalPresets: ['negative_press'],
    bandChemistrySource: null,
    twaaterHashtagTemplate: 'Free{primary}',
  },
};

// ─── Article Generation ─────────────────────────────────

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInRange(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min));
}

/**
 * Select which media outlets will cover this drama event.
 */
export function selectCoveringOutlets(
  fame: number,
  severity: DramaSeverity,
  controversyLevel: number,
): MediaOutlet[] {
  const severityMultiplier = { minor: 0.5, moderate: 1, major: 1.5, explosive: 2 }[severity];

  return MEDIA_OUTLETS.filter(outlet => {
    if (fame < outlet.fameThreshold) return false;
    // Higher controversy bias = more likely to cover controversial events
    const coverageChance = 30 + (controversyLevel * outlet.controversyBias / 100) * severityMultiplier;
    return Math.random() * 100 < coverageChance;
  });
}

/**
 * Generate a media article from a drama preset and entity names.
 */
export function generateArticle(
  preset: DramaPreset,
  primaryName: string,
  secondaryName: string | null,
  outlet: MediaOutlet,
): Omit<GeneratedMediaArticle, 'id' | 'drama_event_id' | 'created_at'> {
  const secondary = secondaryName ?? 'an unnamed party';
  const headline = randomItem(preset.headlines)
    .replace('{primary}', primaryName)
    .replace('{secondary}', secondary);
  const body = randomItem(preset.bodyTemplates)
    .replace(/{primary}/g, primaryName)
    .replace(/{secondary}/g, secondary);

  // Tone-specific subheadline
  const subheadlines: Record<OutletTone, string> = {
    tabloid: 'You won\'t BELIEVE what happened next...',
    gossip: 'We have ALL the details inside.',
    serious: 'An analysis of the situation and its implications.',
    supportive: 'Fans rally around in a show of support.',
    neutral: 'Here\'s what we know so far.',
  };

  const controversyScore = {
    minor: randomInRange(10, 30),
    moderate: randomInRange(30, 55),
    major: randomInRange(55, 80),
    explosive: randomInRange(80, 100),
  }[preset.defaultSeverity];

  const sentimentScore = preset.fanLoyaltyChange.min >= 0
    ? randomInRange(20, 60)
    : randomInRange(-80, -10);

  return {
    source_type: 'drama',
    outlet_name: outlet.name,
    outlet_tone: outlet.tone,
    headline,
    subheadline: subheadlines[outlet.tone],
    body_text: body,
    tags: [preset.category, preset.defaultSeverity, outlet.tone],
    mentioned_entity_ids: [],
    mentioned_entity_names: [primaryName, ...(secondaryName ? [secondaryName] : [])],
    reader_count: 0,
    share_count: 0,
    sentiment_score: sentimentScore,
    controversy_score: controversyScore,
    is_published: true,
    is_breaking: preset.defaultSeverity === 'explosive',
    featured: preset.defaultSeverity === 'major' || preset.defaultSeverity === 'explosive',
    expires_at: null,
    metadata: {},
  };
}

/**
 * Calculate the full impacts for a drama event.
 */
export function calculateDramaImpacts(preset: DramaPreset, fame: number) {
  const fanLoyaltyChange = randomInRange(preset.fanLoyaltyChange.min, preset.fanLoyaltyChange.max);
  const streamingMultiplier = +(preset.streamingMultiplier.min + Math.random() * (preset.streamingMultiplier.max - preset.streamingMultiplier.min)).toFixed(2);
  const chartBoost = randomInRange(preset.chartBoost.min, preset.chartBoost.max);
  const fameChange = randomInRange(preset.fameChange.min, preset.fameChange.max);
  const viralRoll = Math.random() * 100;
  const wentViral = viralRoll < preset.viralChance;
  const viralScore = wentViral ? randomInRange(60, 100) : randomInRange(0, 30);

  // Viral events get boosted impacts
  const viralMultiplier = wentViral ? 1.5 : 1.0;

  return {
    fanLoyaltyChange: Math.round(fanLoyaltyChange * viralMultiplier),
    streamingMultiplier: +(streamingMultiplier * (wentViral ? 1.3 : 1)).toFixed(2),
    chartBoost: Math.round(chartBoost * viralMultiplier),
    fameChange: Math.round(fameChange * viralMultiplier),
    wentViral,
    viralScore,
    twaaterHashtag: preset.twaaterHashtagTemplate
      .replace('{primary}', '').replace('{secondary}', ''),
  };
}
