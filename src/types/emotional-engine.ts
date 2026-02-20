// Dynamic Emotional Engine Types & Configuration

/**
 * Core emotional attributes
 */
export type EmotionKey = 'happiness' | 'loneliness' | 'inspiration' | 'jealousy' | 'resentment' | 'obsession';

/**
 * Sources that can trigger emotional changes
 */
export type EmotionEventSource =
  | 'relationship'
  | 'gig'
  | 'songwriting'
  | 'chart'
  | 'band'
  | 'social'
  | 'news'
  | 'decay'
  | 'system';

/**
 * A character's current emotional state
 */
export interface CharacterEmotionalState {
  id: string;
  profile_id: string;
  happiness: number;
  loneliness: number;
  inspiration: number;
  jealousy: number;
  resentment: number;
  obsession: number;
  songwriting_modifier: number;
  performance_modifier: number;
  interaction_modifier: number;
  last_event_at: string | null;
  last_decay_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * An event that changed emotional state
 */
export interface EmotionalStateEvent {
  id: string;
  profile_id: string;
  event_source: EmotionEventSource;
  event_type: string;
  source_id: string | null;
  happiness_change: number;
  loneliness_change: number;
  inspiration_change: number;
  jealousy_change: number;
  resentment_change: number;
  obsession_change: number;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Input for applying an emotional event
 */
export interface ApplyEmotionInput {
  profile_id: string;
  event_source: EmotionEventSource;
  event_type: string;
  source_id?: string;
  happiness_change?: number;
  loneliness_change?: number;
  inspiration_change?: number;
  jealousy_change?: number;
  resentment_change?: number;
  obsession_change?: number;
  description?: string;
}

// ─── Emotion Display Config ────────────────────────────

export interface EmotionDisplayInfo {
  key: EmotionKey;
  label: string;
  icon: string;
  lowLabel: string;
  highLabel: string;
  color: string;
}

export const EMOTION_DISPLAY: EmotionDisplayInfo[] = [
  { key: 'happiness', label: 'Happiness', icon: 'smile', lowLabel: 'Miserable', highLabel: 'Euphoric', color: 'text-yellow-500' },
  { key: 'loneliness', label: 'Loneliness', icon: 'user-x', lowLabel: 'Connected', highLabel: 'Isolated', color: 'text-blue-400' },
  { key: 'inspiration', label: 'Inspiration', icon: 'lightbulb', lowLabel: 'Blocked', highLabel: 'On Fire', color: 'text-orange-400' },
  { key: 'jealousy', label: 'Jealousy', icon: 'eye', lowLabel: 'Secure', highLabel: 'Consumed', color: 'text-green-500' },
  { key: 'resentment', label: 'Resentment', icon: 'flame', lowLabel: 'At Peace', highLabel: 'Bitter', color: 'text-red-500' },
  { key: 'obsession', label: 'Obsession', icon: 'target', lowLabel: 'Balanced', highLabel: 'Fixated', color: 'text-purple-500' },
];

// ─── Event Presets ─────────────────────────────────────

/**
 * Pre-defined emotional impacts for common game events.
 * Each preset is a partial ApplyEmotionInput (deltas only).
 */
export const EMOTION_EVENT_PRESETS: Record<string, Omit<ApplyEmotionInput, 'profile_id' | 'event_source' | 'event_type'>> = {
  // Relationship events
  friend_gained:        { happiness_change: 8, loneliness_change: -10, description: 'Made a new friend' },
  friend_lost:          { happiness_change: -12, loneliness_change: 15, resentment_change: 5, description: 'Lost a friend' },
  betrayal_received:    { happiness_change: -20, resentment_change: 25, jealousy_change: 10, description: 'Betrayed by someone close' },
  romantic_success:     { happiness_change: 15, loneliness_change: -20, obsession_change: 10, description: 'Romance is blooming' },
  romantic_rejection:   { happiness_change: -15, loneliness_change: 10, resentment_change: 5, description: 'Romantic rejection' },

  // Gig events
  gig_great_show:       { happiness_change: 12, inspiration_change: 10, loneliness_change: -5, description: 'Amazing gig performance' },
  gig_bad_show:         { happiness_change: -10, inspiration_change: -5, loneliness_change: 5, description: 'Terrible gig' },
  gig_sold_out:         { happiness_change: 15, inspiration_change: 8, description: 'Sold out show!' },
  gig_empty_venue:      { happiness_change: -8, loneliness_change: 8, inspiration_change: -5, description: 'Nobody showed up' },

  // Songwriting events
  song_completed:       { happiness_change: 5, inspiration_change: -3, obsession_change: -5, description: 'Finished a song' },
  masterpiece_written:  { happiness_change: 20, inspiration_change: 15, obsession_change: 5, description: 'Wrote a masterpiece!' },
  creative_block:       { happiness_change: -5, inspiration_change: -15, resentment_change: 3, description: 'Hit a creative wall' },
  breakthrough_session: { inspiration_change: 20, happiness_change: 8, description: 'Creative breakthrough!' },

  // Chart events
  song_charted:         { happiness_change: 10, inspiration_change: 8, description: 'Song entered the charts' },
  song_number_one:      { happiness_change: 25, inspiration_change: 15, obsession_change: -5, description: '#1 hit!' },
  song_dropped_off:     { happiness_change: -5, inspiration_change: -3, description: 'Song fell off charts' },
  rival_charted_higher: { jealousy_change: 15, resentment_change: 8, obsession_change: 5, description: 'A rival outperformed you on the charts' },

  // Band events
  band_chemistry_high:  { happiness_change: 8, loneliness_change: -8, inspiration_change: 5, description: 'Band is vibing' },
  band_chemistry_low:   { happiness_change: -5, loneliness_change: 5, resentment_change: 8, description: 'Band tension rising' },
  band_member_left:     { happiness_change: -10, loneliness_change: 10, resentment_change: 5, description: 'A bandmate left' },
  band_formed:          { happiness_change: 15, loneliness_change: -15, inspiration_change: 10, description: 'Started a new band!' },

  // Social events
  public_praise:        { happiness_change: 8, inspiration_change: 5, loneliness_change: -3, description: 'Praised publicly' },
  public_insult:        { happiness_change: -10, resentment_change: 10, loneliness_change: 5, description: 'Publicly insulted' },
  viral_moment:         { happiness_change: 12, inspiration_change: 5, obsession_change: 3, description: 'Went viral on social media' },

  // News events
  positive_press:       { happiness_change: 8, inspiration_change: 5, description: 'Positive media coverage' },
  negative_press:       { happiness_change: -10, resentment_change: 8, loneliness_change: 5, description: 'Bad press' },
  scandal_leaked:       { happiness_change: -15, resentment_change: 15, jealousy_change: 5, obsession_change: 8, description: 'A scandal leaked to the press' },

  // Decay / time
  natural_recovery:     { resentment_change: -2, jealousy_change: -2, obsession_change: -2, description: 'Time heals' },
  isolation_effect:     { loneliness_change: 3, happiness_change: -2, description: 'Feeling isolated' },
};

// ─── Modifier Thresholds for UI Labels ─────────────────

/**
 * Get a human-readable label for a modifier value
 */
export function getModifierLabel(modifier: number): { label: string; sentiment: 'positive' | 'neutral' | 'negative' } {
  if (modifier >= 1.3) return { label: 'Supercharged', sentiment: 'positive' };
  if (modifier >= 1.1) return { label: 'Boosted', sentiment: 'positive' };
  if (modifier >= 0.95) return { label: 'Stable', sentiment: 'neutral' };
  if (modifier >= 0.8) return { label: 'Impaired', sentiment: 'negative' };
  return { label: 'Crippled', sentiment: 'negative' };
}

/**
 * Get emotion intensity label
 */
export function getEmotionIntensity(value: number): string {
  if (value >= 80) return 'Extreme';
  if (value >= 60) return 'High';
  if (value >= 40) return 'Moderate';
  if (value >= 20) return 'Low';
  return 'Minimal';
}
