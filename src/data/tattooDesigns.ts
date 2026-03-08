/**
 * Tattoo body slot definitions and sleeve system
 */

export const BODY_SLOTS = {
  left_upper_arm: { label: 'Left Upper Arm', arm: 'left', sleeveSlot: true },
  left_forearm: { label: 'Left Forearm', arm: 'left', sleeveSlot: true },
  left_wrist: { label: 'Left Wrist', arm: 'left', sleeveSlot: true },
  left_shoulder: { label: 'Left Shoulder', arm: 'left', sleeveSlot: true },
  left_inner_arm: { label: 'Left Inner Arm', arm: 'left', sleeveSlot: true },
  right_upper_arm: { label: 'Right Upper Arm', arm: 'right', sleeveSlot: true },
  right_forearm: { label: 'Right Forearm', arm: 'right', sleeveSlot: true },
  right_wrist: { label: 'Right Wrist', arm: 'right', sleeveSlot: true },
  right_shoulder: { label: 'Right Shoulder', arm: 'right', sleeveSlot: true },
  right_inner_arm: { label: 'Right Inner Arm', arm: 'right', sleeveSlot: true },
  neck: { label: 'Neck', arm: null, sleeveSlot: false },
  chest: { label: 'Chest', arm: null, sleeveSlot: false },
  back: { label: 'Back', arm: null, sleeveSlot: false },
} as const;

export type BodySlot = keyof typeof BODY_SLOTS;

export const LEFT_SLEEVE_SLOTS: BodySlot[] = ['left_shoulder', 'left_upper_arm', 'left_inner_arm', 'left_forearm', 'left_wrist'];
export const RIGHT_SLEEVE_SLOTS: BodySlot[] = ['right_shoulder', 'right_upper_arm', 'right_inner_arm', 'right_forearm', 'right_wrist'];

export const TATTOO_CATEGORIES = [
  'skull', 'tribal', 'japanese', 'musical', 'sleeve', 'geometric', 'text', 'abstract', 'portrait'
] as const;

export type TattooCategory = typeof TATTOO_CATEGORIES[number];

export const CATEGORY_LABELS: Record<TattooCategory, string> = {
  skull: '💀 Skull',
  tribal: '🔥 Tribal',
  japanese: '🐉 Japanese',
  musical: '🎵 Musical',
  sleeve: '💪 Sleeve Piece',
  geometric: '◆ Geometric',
  text: '✍️ Script',
  abstract: '🎨 Abstract',
  portrait: '👤 Portrait',
};

export interface TattooDesign {
  id: string;
  name: string;
  category: TattooCategory;
  body_slot: BodySlot;
  base_price: number;
  ink_color_primary: string;
  ink_color_secondary: string | null;
  description: string;
  genre_affinity: Record<string, number>;
}

export interface PlayerTattoo {
  id: string;
  user_id: string;
  tattoo_design_id: string;
  parlour_id: string | null;
  body_slot: BodySlot;
  quality_score: number;
  ink_color: string;
  applied_at: string;
  is_infected: boolean;
  infection_cleared_at: string | null;
  price_paid: number;
  // Joined
  design?: TattooDesign;
}

/**
 * Calculate quality score based on parlour tier with variance
 */
export function calculateTattooQuality(parlourTier: number, artistQualityBonus: number = 0): number {
  const tierRanges: Record<number, [number, number]> = {
    1: [20, 50],
    2: [35, 65],
    3: [50, 80],
    4: [70, 92],
    5: [85, 100],
  };
  const [min, max] = tierRanges[parlourTier] || [40, 70];
  return Math.round(min + Math.random() * (max - min));
}

/**
 * Calculate infection chance based on parlour tier
 */
export function rollForInfection(infectionRisk: number): boolean {
  return Math.random() < infectionRisk;
}

/**
 * Check sleeve completion for an arm
 */
export function getSleeveProgress(tattoos: PlayerTattoo[], arm: 'left' | 'right'): { filled: number; total: number; isComplete: boolean } {
  const slots = arm === 'left' ? LEFT_SLEEVE_SLOTS : RIGHT_SLEEVE_SLOTS;
  const filledSlots = slots.filter(slot => tattoos.some(t => t.body_slot === slot));
  return {
    filled: filledSlots.length,
    total: slots.length,
    isComplete: filledSlots.length >= slots.length,
  };
}
