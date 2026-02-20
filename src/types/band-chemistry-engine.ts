// Enhanced Band Chemistry Engine — Types & Configuration
// 4-axis system: Overall Chemistry, Romantic Tension, Creative Alignment, Conflict Index

// ─── Core Types ─────────────────────────────────────────

export interface BandChemistryState {
  chemistry_level: number;       // 0–100 overall chemistry
  romantic_tension: number;      // 0–100 higher = more volatile
  creative_alignment: number;    // 0–100 higher = better synergy
  conflict_index: number;        // 0–100 higher = more friction
}

export interface BandChemistryModifiers {
  songQualityModifier: number;        // Multiplier for songwriting output
  performanceRatingModifier: number;  // Multiplier for live performance scores
  memberLeaveRisk: number;            // 0–100 probability per week
  dramaEventChance: number;           // 0–100 probability per action
  rehearsalEfficiency: number;        // Multiplier for rehearsal gains
  fanPerception: number;              // -25 to +25 modifier to fan growth
}

// ─── Drama Event Types ──────────────────────────────────

export type DramaType =
  | 'romantic_breakup' | 'romantic_tension' | 'affair_scandal'
  | 'creative_clash' | 'genre_disagreement' | 'songwriting_dispute'
  | 'rivalry_eruption' | 'jealousy_incident' | 'leadership_challenge'
  | 'public_scandal' | 'media_fallout' | 'fan_backlash'
  | 'member_threat_leave' | 'member_ultimatum' | 'intervention'
  | 'reconciliation' | 'creative_breakthrough' | 'unity_moment';

export type DramaSeverity = 'minor' | 'moderate' | 'major' | 'critical';

export interface DramaEventPreset {
  type: DramaType;
  label: string;
  severity: DramaSeverity;
  chemistry_change: number;
  romantic_tension_change: number;
  creative_alignment_change: number;
  conflict_index_change: number;
  member_leave_risk: number; // Added risk % to each member
  isPublic: boolean;
  description: string;
}

export interface BandDramaEvent {
  id: string;
  band_id: string;
  drama_type: DramaType;
  severity: DramaSeverity;
  chemistry_change: number;
  romantic_tension_change: number;
  creative_alignment_change: number;
  conflict_index_change: number;
  instigator_member_id: string | null;
  target_member_id: string | null;
  member_leave_risk: number;
  resolved: boolean;
  resolution_type: string | null;
  resolved_at: string | null;
  description: string | null;
  public_knowledge: boolean;
  media_coverage: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Drama Event Presets ────────────────────────────────

export const DRAMA_PRESETS: Record<string, DramaEventPreset> = {
  // Romantic triggers
  romantic_breakup: {
    type: 'romantic_breakup', label: 'Romantic Breakup', severity: 'major',
    chemistry_change: -15, romantic_tension_change: 30, creative_alignment_change: -10, conflict_index_change: 20,
    member_leave_risk: 25, isPublic: false, description: 'Two band members ended their relationship',
  },
  romantic_tension_rise: {
    type: 'romantic_tension', label: 'Romantic Tension', severity: 'moderate',
    chemistry_change: -5, romantic_tension_change: 15, creative_alignment_change: -3, conflict_index_change: 8,
    member_leave_risk: 5, isPublic: false, description: 'Unresolved romantic feelings creating awkwardness',
  },
  affair_scandal: {
    type: 'affair_scandal', label: 'Affair Scandal', severity: 'critical',
    chemistry_change: -25, romantic_tension_change: 40, creative_alignment_change: -15, conflict_index_change: 35,
    member_leave_risk: 40, isPublic: true, description: 'A secret affair within the band has been exposed',
  },

  // Creative triggers
  creative_clash: {
    type: 'creative_clash', label: 'Creative Clash', severity: 'moderate',
    chemistry_change: -8, romantic_tension_change: 0, creative_alignment_change: -20, conflict_index_change: 15,
    member_leave_risk: 10, isPublic: false, description: 'Members disagree on the band\'s musical direction',
  },
  genre_disagreement: {
    type: 'genre_disagreement', label: 'Genre Disagreement', severity: 'minor',
    chemistry_change: -3, romantic_tension_change: 0, creative_alignment_change: -12, conflict_index_change: 8,
    member_leave_risk: 5, isPublic: false, description: 'Dispute over what genre to pursue',
  },
  songwriting_dispute: {
    type: 'songwriting_dispute', label: 'Songwriting Dispute', severity: 'moderate',
    chemistry_change: -6, romantic_tension_change: 0, creative_alignment_change: -15, conflict_index_change: 12,
    member_leave_risk: 8, isPublic: false, description: 'Conflict over songwriting credits or direction',
  },

  // Rivalry triggers
  rivalry_eruption: {
    type: 'rivalry_eruption', label: 'Rivalry Eruption', severity: 'major',
    chemistry_change: -12, romantic_tension_change: 5, creative_alignment_change: -8, conflict_index_change: 25,
    member_leave_risk: 20, isPublic: false, description: 'A personal rivalry has escalated between members',
  },
  jealousy_incident: {
    type: 'jealousy_incident', label: 'Jealousy Incident', severity: 'moderate',
    chemistry_change: -7, romantic_tension_change: 10, creative_alignment_change: -5, conflict_index_change: 15,
    member_leave_risk: 10, isPublic: false, description: 'Jealousy over spotlight, skills, or relationships',
  },
  leadership_challenge: {
    type: 'leadership_challenge', label: 'Leadership Challenge', severity: 'major',
    chemistry_change: -10, romantic_tension_change: 0, creative_alignment_change: -5, conflict_index_change: 20,
    member_leave_risk: 15, isPublic: false, description: 'A member is challenging the band leader\'s authority',
  },

  // Public triggers
  public_scandal: {
    type: 'public_scandal', label: 'Public Scandal', severity: 'critical',
    chemistry_change: -20, romantic_tension_change: 10, creative_alignment_change: -10, conflict_index_change: 30,
    member_leave_risk: 30, isPublic: true, description: 'A scandal involving band members has gone public',
  },
  media_fallout: {
    type: 'media_fallout', label: 'Media Fallout', severity: 'major',
    chemistry_change: -12, romantic_tension_change: 5, creative_alignment_change: -5, conflict_index_change: 18,
    member_leave_risk: 12, isPublic: true, description: 'Negative media coverage straining the band',
  },
  fan_backlash: {
    type: 'fan_backlash', label: 'Fan Backlash', severity: 'moderate',
    chemistry_change: -8, romantic_tension_change: 0, creative_alignment_change: -8, conflict_index_change: 12,
    member_leave_risk: 8, isPublic: true, description: 'Fans reacting negatively, putting pressure on the band',
  },

  // Escalation triggers
  member_threat_leave: {
    type: 'member_threat_leave', label: 'Member Threatens to Leave', severity: 'critical',
    chemistry_change: -18, romantic_tension_change: 5, creative_alignment_change: -10, conflict_index_change: 30,
    member_leave_risk: 50, isPublic: false, description: 'A member is threatening to leave the band',
  },
  member_ultimatum: {
    type: 'member_ultimatum', label: 'Ultimatum Issued', severity: 'critical',
    chemistry_change: -15, romantic_tension_change: 5, creative_alignment_change: -8, conflict_index_change: 25,
    member_leave_risk: 35, isPublic: false, description: 'A member has issued an ultimatum to the band',
  },
  intervention: {
    type: 'intervention', label: 'Band Intervention', severity: 'major',
    chemistry_change: 5, romantic_tension_change: -5, creative_alignment_change: 3, conflict_index_change: -10,
    member_leave_risk: -5, isPublic: false, description: 'The band held an intervention to address issues',
  },

  // Positive triggers
  reconciliation: {
    type: 'reconciliation', label: 'Reconciliation', severity: 'moderate',
    chemistry_change: 12, romantic_tension_change: -10, creative_alignment_change: 8, conflict_index_change: -15,
    member_leave_risk: -15, isPublic: false, description: 'Members have reconciled and resolved their differences',
  },
  creative_breakthrough: {
    type: 'creative_breakthrough', label: 'Creative Breakthrough', severity: 'moderate',
    chemistry_change: 10, romantic_tension_change: 0, creative_alignment_change: 20, conflict_index_change: -8,
    member_leave_risk: -10, isPublic: false, description: 'The band had a creative breakthrough together',
  },
  unity_moment: {
    type: 'unity_moment', label: 'Unity Moment', severity: 'minor',
    chemistry_change: 15, romantic_tension_change: -5, creative_alignment_change: 10, conflict_index_change: -12,
    member_leave_risk: -20, isPublic: false, description: 'A shared experience brought the band closer together',
  },
};

// ─── Modifier Calculations ──────────────────────────────

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/**
 * Calculate all gameplay modifiers from the 4-axis chemistry state.
 */
export function calculateBandChemistryModifiers(state: BandChemistryState): BandChemistryModifiers {
  const { chemistry_level, romantic_tension, creative_alignment, conflict_index } = state;

  // Song Quality: High creative alignment boosts, high conflict hurts
  // Range: 0.6x to 1.5x
  const songQualityModifier = clamp(
    0.7 +
    (creative_alignment / 200) +     // +0.0 to +0.5
    (chemistry_level / 500) +         // +0.0 to +0.2
    (-conflict_index / 500) +         // -0.2 to 0.0
    (-romantic_tension / 1000),       // -0.1 to 0.0
    0.6, 1.5
  );

  // Performance Rating: Overall chemistry matters most, tension is volatile (can help or hurt)
  // Range: 0.5x to 1.5x
  const tensionVolatility = romantic_tension > 50
    ? (Math.random() > 0.4 ? -0.1 : 0.08) // High tension = usually bad, sometimes electric
    : 0;
  const performanceRatingModifier = clamp(
    0.6 +
    (chemistry_level / 150) +          // +0.0 to +0.67
    (-conflict_index / 400) +          // -0.25 to 0.0
    (creative_alignment / 500) +       // +0.0 to +0.2
    tensionVolatility,
    0.5, 1.5
  );

  // Member Leave Risk: High conflict and tension push members out
  // Range: 0 to 80%
  const memberLeaveRisk = clamp(
    (conflict_index * 0.4) +
    (romantic_tension * 0.2) +
    (-chemistry_level * 0.3) +
    (-creative_alignment * 0.1) + 15,
    0, 80
  );

  // Drama Event Chance: Higher when things are unstable
  // Range: 2% to 60%
  const dramaEventChance = clamp(
    2 +
    (conflict_index * 0.35) +
    (romantic_tension * 0.2) +
    (-chemistry_level * 0.15),
    2, 60
  );

  // Rehearsal Efficiency: Good chemistry = productive rehearsals
  // Range: 0.5x to 1.5x
  const rehearsalEfficiency = clamp(
    0.6 +
    (chemistry_level / 200) +
    (creative_alignment / 250) +
    (-conflict_index / 500),
    0.5, 1.5
  );

  // Fan Perception: Public drama hurts, unity helps
  // Range: -25 to +25
  const fanPerception = clamp(
    (chemistry_level / 5) +
    (-conflict_index / 5) +
    (-romantic_tension / 10) - 5,
    -25, 25
  );

  return {
    songQualityModifier: Math.round(songQualityModifier * 1000) / 1000,
    performanceRatingModifier: Math.round(performanceRatingModifier * 1000) / 1000,
    memberLeaveRisk: Math.round(memberLeaveRisk),
    dramaEventChance: Math.round(dramaEventChance),
    rehearsalEfficiency: Math.round(rehearsalEfficiency * 1000) / 1000,
    fanPerception: Math.round(fanPerception),
  };
}

// ─── Drama Trigger Logic ────────────────────────────────

export type DramaTriggerSource =
  | 'romantic_breakup'
  | 'rivalry'
  | 'creative_disagreement'
  | 'public_scandal'
  | 'weekly_check'
  | 'gig_outcome'
  | 'songwriting_session';

/**
 * Determine which drama events could fire based on current chemistry state + trigger source.
 * Returns the preset key and a probability for each.
 */
export function evaluateDramaTriggers(
  state: BandChemistryState,
  source: DramaTriggerSource,
): { presetKey: string; probability: number }[] {
  const candidates: { presetKey: string; probability: number }[] = [];

  switch (source) {
    case 'romantic_breakup':
      candidates.push({ presetKey: 'romantic_breakup', probability: 90 });
      if (state.romantic_tension > 40) candidates.push({ presetKey: 'member_threat_leave', probability: 20 });
      if (state.conflict_index > 50) candidates.push({ presetKey: 'rivalry_eruption', probability: 30 });
      break;

    case 'rivalry':
      candidates.push({ presetKey: 'rivalry_eruption', probability: 70 });
      candidates.push({ presetKey: 'jealousy_incident', probability: 40 });
      if (state.conflict_index > 60) candidates.push({ presetKey: 'member_threat_leave', probability: 25 });
      break;

    case 'creative_disagreement':
      candidates.push({ presetKey: 'creative_clash', probability: 60 });
      candidates.push({ presetKey: 'genre_disagreement', probability: 40 });
      candidates.push({ presetKey: 'songwriting_dispute', probability: 30 });
      // Sometimes disagreement leads to breakthrough
      if (state.creative_alignment > 60) candidates.push({ presetKey: 'creative_breakthrough', probability: 15 });
      break;

    case 'public_scandal':
      candidates.push({ presetKey: 'public_scandal', probability: 80 });
      candidates.push({ presetKey: 'media_fallout', probability: 60 });
      candidates.push({ presetKey: 'fan_backlash', probability: 50 });
      break;

    case 'weekly_check': {
      // Passive drama based on state
      if (state.conflict_index > 60) candidates.push({ presetKey: 'member_threat_leave', probability: state.conflict_index / 5 });
      if (state.romantic_tension > 50) candidates.push({ presetKey: 'romantic_tension_rise', probability: state.romantic_tension / 4 });
      if (state.creative_alignment < 30) candidates.push({ presetKey: 'creative_clash', probability: 15 });
      // Positive: high chemistry can trigger unity
      if (state.chemistry_level > 75 && state.conflict_index < 20) candidates.push({ presetKey: 'unity_moment', probability: 10 });
      break;
    }

    case 'gig_outcome':
      // Bad state + gig stress can trigger drama
      if (state.conflict_index > 40) candidates.push({ presetKey: 'rivalry_eruption', probability: 15 });
      if (state.romantic_tension > 60) candidates.push({ presetKey: 'jealousy_incident', probability: 20 });
      // Good gigs can heal
      if (state.chemistry_level > 60) candidates.push({ presetKey: 'unity_moment', probability: 12 });
      break;

    case 'songwriting_session':
      if (state.creative_alignment < 40) candidates.push({ presetKey: 'songwriting_dispute', probability: 25 });
      if (state.creative_alignment > 70) candidates.push({ presetKey: 'creative_breakthrough', probability: 20 });
      break;
  }

  return candidates;
}

/**
 * Roll for drama events from a list of candidates.
 * Returns the preset keys that actually fire.
 */
export function rollDramaEvents(
  candidates: { presetKey: string; probability: number }[],
  maxEvents = 2,
): string[] {
  const fired: string[] = [];
  for (const c of candidates) {
    if (fired.length >= maxEvents) break;
    if (Math.random() * 100 < c.probability) {
      fired.push(c.presetKey);
    }
  }
  return fired;
}

// ─── Natural Decay / Healing ────────────────────────────

/**
 * Apply weekly natural drift to chemistry axes.
 * Conflict and tension decay slowly; creative alignment drifts toward 50.
 */
export function calculateWeeklyDrift(state: BandChemistryState): Partial<BandChemistryState> {
  return {
    conflict_index: clamp(state.conflict_index - 3, 0, 100),          // -3 per week
    romantic_tension: clamp(state.romantic_tension - 2, 0, 100),      // -2 per week
    creative_alignment: state.creative_alignment < 50                  // Drifts toward 50
      ? clamp(state.creative_alignment + 2, 0, 100)
      : state.creative_alignment > 50
        ? clamp(state.creative_alignment - 1, 0, 100)
        : state.creative_alignment,
    chemistry_level: state.conflict_index > 50                         // High conflict slowly erodes chemistry
      ? clamp(state.chemistry_level - 2, 0, 100)
      : state.chemistry_level,
  };
}
