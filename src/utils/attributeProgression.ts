import type { Tables } from "@/lib/supabase-types";

export type AttributeSnapshot = Tables<'player_attributes'>;

export type AttributeKey = keyof Pick<
  AttributeSnapshot,
  | 'creative_insight'
  | 'musical_ability'
  | 'rhythm_sense'
  | 'stage_presence'
  | 'technical_mastery'
  | 'vocal_talent'
>;

export type FullAttributeKey = keyof Pick<
  AttributeSnapshot,
  | 'charisma'
  | 'looks'
  | 'mental_focus'
  | 'musicality'
  | 'physical_endurance'
  | 'stage_presence'
  | 'crowd_engagement'
  | 'social_reach'
  | 'musical_ability'
  | 'vocal_talent'
  | 'rhythm_sense'
  | 'creative_insight'
  | 'technical_mastery'
>;

export const ATTRIBUTE_MAX_VALUE = 1000;
export const ATTRIBUTE_TRAINING_INCREMENT = 10;

export const ATTRIBUTE_KEYS: AttributeKey[] = [
  'musical_ability',
  'vocal_talent',
  'rhythm_sense',
  'stage_presence',
  'creative_insight',
  'technical_mastery',
];

export const FULL_ATTRIBUTE_KEYS: FullAttributeKey[] = [
  'charisma',
  'looks',
  'mental_focus',
  'musicality',
  'physical_endurance',
  'stage_presence',
  'crowd_engagement',
  'social_reach',
  'musical_ability',
  'vocal_talent',
  'rhythm_sense',
  'creative_insight',
  'technical_mastery',
];

export const ATTRIBUTE_METADATA: Record<AttributeKey, {
  label: string;
  description: string;
  relatedSkills: string[];
}> = {
  musical_ability: {
    label: 'Musical Ability',
    description: 'Overall instrumental precision, tone, and fretboard mastery.',
    relatedSkills: ['guitar', 'bass', 'composition'],
  },
  vocal_talent: {
    label: 'Vocal Talent',
    description: 'Pitch control, range, and the nuances that make performances soar.',
    relatedSkills: ['vocals', 'performance'],
  },
  rhythm_sense: {
    label: 'Rhythm Sense',
    description: 'Timing, groove, and percussive instincts that anchor a band.',
    relatedSkills: ['drums', 'bass', 'performance'],
  },
  stage_presence: {
    label: 'Stage Presence',
    description: 'Charisma, confidence, and crowd engagement during live shows.',
    relatedSkills: ['performance', 'vocals'],
  },
  creative_insight: {
    label: 'Creative Insight',
    description: 'Songwriting intuition, lyrical storytelling, and innovative ideas.',
    relatedSkills: ['songwriting', 'composition', 'creativity'],
  },
  technical_mastery: {
    label: 'Technical Mastery',
    description: 'Studio expertise, production prowess, and sound engineering instincts.',
    relatedSkills: ['technical', 'songwriting'],
  },
};

export const FULL_ATTRIBUTE_METADATA: Record<FullAttributeKey, {
  label: string;
  description: string;
  affectedSystems: string[];
}> = {
  charisma: {
    label: 'Charisma',
    description: 'Personal magnetism that influences interviews, sponsors, and fan interactions.',
    affectedSystems: ['Interviews', 'Sponsors', 'Social Media'],
  },
  looks: {
    label: 'Looks',
    description: 'Physical appearance that affects photo shoots, magazine covers, and sponsor appeal.',
    affectedSystems: ['Photo Shoots', 'Sponsors', 'Fan Appeal'],
  },
  mental_focus: {
    label: 'Mental Focus',
    description: 'Concentration and learning efficiency that speeds up skill training.',
    affectedSystems: ['Learning', 'Skill Training', 'Practice'],
  },
  musicality: {
    label: 'Musicality',
    description: 'Natural musical sense that enhances all musical output quality.',
    affectedSystems: ['Songwriting', 'Recording', 'Performance'],
  },
  physical_endurance: {
    label: 'Physical Endurance',
    description: 'Stamina for tours and performances, reducing fatigue and health drain.',
    affectedSystems: ['Tours', 'Gigs', 'Health'],
  },
  stage_presence: {
    label: 'Stage Presence',
    description: 'Charisma, confidence, and crowd engagement during live shows.',
    affectedSystems: ['Gigs', 'Encores', 'Fan Satisfaction'],
  },
  crowd_engagement: {
    label: 'Crowd Engagement',
    description: 'Ability to connect with audiences, driving fan growth and ticket sales.',
    affectedSystems: ['Gigs', 'Fan Growth', 'Ticket Sales'],
  },
  social_reach: {
    label: 'Social Reach',
    description: 'Influence on social media platforms, increasing viral chances and follower growth.',
    affectedSystems: ['Social Media', 'Viral Content', 'Fan Growth'],
  },
  musical_ability: {
    label: 'Musical Ability',
    description: 'Overall instrumental precision, tone, and fretboard mastery.',
    affectedSystems: ['Songwriting', 'Recording', 'Performance'],
  },
  vocal_talent: {
    label: 'Vocal Talent',
    description: 'Pitch control, range, and the nuances that make performances soar.',
    affectedSystems: ['Vocals', 'Recording', 'Performance'],
  },
  rhythm_sense: {
    label: 'Rhythm Sense',
    description: 'Timing, groove, and percussive instincts that anchor a band.',
    affectedSystems: ['Drums', 'Recording', 'Performance'],
  },
  creative_insight: {
    label: 'Creative Insight',
    description: 'Songwriting intuition, lyrical storytelling, and innovative ideas.',
    affectedSystems: ['Songwriting', 'Lyrics', 'Composition'],
  },
  technical_mastery: {
    label: 'Technical Mastery',
    description: 'Studio expertise, production prowess, and sound engineering instincts.',
    affectedSystems: ['Recording', 'Mixing', 'Production'],
  },
};

export const SKILL_ATTRIBUTE_MAP: Record<string, AttributeKey> = {
  guitar: 'musical_ability',
  bass: 'musical_ability',
  drums: 'rhythm_sense',
  vocals: 'vocal_talent',
  performance: 'stage_presence',
  songwriting: 'creative_insight',
  composition: 'creative_insight',
  creativity: 'creative_insight',
  technical: 'technical_mastery',
};

export const getAttributeTrainingCost = (currentValue: number) =>
  Math.ceil(120 + currentValue * 0.85);

export const getAttributeValue = (
  attributes: AttributeSnapshot | null | undefined,
  key: AttributeKey | FullAttributeKey,
) => {
  const raw = attributes?.[key];
  if (typeof raw !== 'number' || Number.isNaN(raw)) {
    return 0;
  }
  return Math.max(0, Math.min(ATTRIBUTE_MAX_VALUE, Math.floor(raw)));
};

const normalizeKeys = (keys: AttributeKey | AttributeKey[] | undefined) =>
  Array.isArray(keys) ? keys : keys ? [keys] : [];

export const calculateAttributeMultiplier = (
  attributes: AttributeSnapshot | null | undefined,
  keys: AttributeKey | AttributeKey[] | undefined,
  baseMultiplier = 1,
) => {
  const resolved = normalizeKeys(keys);
  if (resolved.length === 0) {
    return {
      multiplier: baseMultiplier,
      averageValue: 0,
      keys: resolved,
    };
  }

  const total = resolved.reduce((sum, key) => sum + getAttributeValue(attributes, key), 0);
  const averageValue = total / resolved.length;
  const multiplier = baseMultiplier + averageValue / ATTRIBUTE_MAX_VALUE;

  return {
    multiplier,
    averageValue,
    keys: resolved,
  };
};

export const applyAttributeToValue = (
  baseValue: number,
  attributes: AttributeSnapshot | null | undefined,
  keys: AttributeKey | AttributeKey[] | undefined,
  baseMultiplier = 1,
) => {
  if (baseValue <= 0) {
    return {
      value: 0,
      multiplier: baseMultiplier,
      averageValue: 0,
      keys: normalizeKeys(keys),
    };
  }

  const { multiplier, averageValue, keys: resolvedKeys } = calculateAttributeMultiplier(
    attributes,
    keys,
    baseMultiplier,
  );

  return {
    value: Math.max(1, Math.round(baseValue * multiplier)),
    multiplier,
    averageValue,
    keys: resolvedKeys,
  };
};

export const clampAttributeValue = (value: number) =>
  Math.max(0, Math.min(ATTRIBUTE_MAX_VALUE, Math.round(value)));
