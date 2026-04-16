// Stage equipment component system

export type StageComponentType = 'sound' | 'lighting' | 'video' | 'pyro' | 'stage_design' | 'effects';

export interface StageComponentOption {
  key: string;
  label: string;
  description: string;
  costPerShow: number;
  rating: number; // 0-5 stars
  fameRequired: number;
  haulWeight: number; // contributes to hauling requirement
  icon: string;
}

export interface StageComponentCategory {
  type: StageComponentType;
  label: string;
  icon: string;
  options: StageComponentOption[];
}

export const STAGE_COMPONENT_CATEGORIES: StageComponentCategory[] = [
  {
    type: 'sound',
    label: 'Sound System',
    icon: '🔊',
    options: [
      { key: 'house_pa', label: 'House PA', description: 'Whatever the venue provides', costPerShow: 0, rating: 1, fameRequired: 0, haulWeight: 0, icon: '🔈' },
      { key: 'pa_rental', label: 'PA Rental', description: 'Quality rental system with monitors', costPerShow: 200, rating: 2, fameRequired: 0, haulWeight: 1, icon: '🔉' },
      { key: 'touring_pa', label: 'Touring PA', description: 'Dedicated touring sound system', costPerShow: 600, rating: 3, fameRequired: 2000, haulWeight: 2, icon: '🔊' },
      { key: 'festival_rig', label: 'Festival Rig', description: 'Festival-grade Meyer/JBL line arrays', costPerShow: 1500, rating: 4, fameRequired: 15000, haulWeight: 3, icon: '📢' },
      { key: 'l_acoustics', label: 'L-Acoustics K2', description: 'World-class L-Acoustics line array system', costPerShow: 4000, rating: 5, fameRequired: 50000, haulWeight: 4, icon: '🎵' },
    ],
  },
  {
    type: 'lighting',
    label: 'Lighting',
    icon: '💡',
    options: [
      { key: 'house_lights', label: 'House Lights', description: 'Basic venue lighting', costPerShow: 0, rating: 1, fameRequired: 0, haulWeight: 0, icon: '💡' },
      { key: 'led_par', label: 'LED Par Cans', description: 'Colorful wash lighting', costPerShow: 150, rating: 2, fameRequired: 0, haulWeight: 1, icon: '🔦' },
      { key: 'moving_heads', label: 'Moving Heads', description: 'Programmable moving head spots', costPerShow: 500, rating: 3, fameRequired: 3000, haulWeight: 2, icon: '🌟' },
      { key: 'full_rig', label: 'Full Light Rig', description: 'Truss system with moving heads + strobes', costPerShow: 1200, rating: 4, fameRequired: 12000, haulWeight: 3, icon: '✨' },
      { key: 'arena_lighting', label: 'Arena Lighting + Lasers', description: 'Complete arena show with lasers and intelligent lighting', costPerShow: 3500, rating: 5, fameRequired: 40000, haulWeight: 4, icon: '🌈' },
    ],
  },
  {
    type: 'video',
    label: 'Video & Screens',
    icon: '📺',
    options: [
      { key: 'none_video', label: 'None', description: 'No video production', costPerShow: 0, rating: 0, fameRequired: 0, haulWeight: 0, icon: '❌' },
      { key: 'side_screens', label: 'Side Screens', description: 'Two LED screens flanking the stage', costPerShow: 400, rating: 2, fameRequired: 5000, haulWeight: 2, icon: '📺' },
      { key: 'wraparound', label: 'Wraparound LED Wall', description: 'Massive LED backdrop with side extensions', costPerShow: 1500, rating: 4, fameRequired: 20000, haulWeight: 3, icon: '🖥️' },
      { key: 'immersive_360', label: '360° Immersive', description: 'Full surround LED experience', costPerShow: 5000, rating: 5, fameRequired: 75000, haulWeight: 5, icon: '🎬' },
    ],
  },
  {
    type: 'pyro',
    label: 'Pyrotechnics',
    icon: '🔥',
    options: [
      { key: 'none_pyro', label: 'None', description: 'No pyrotechnics', costPerShow: 0, rating: 0, fameRequired: 0, haulWeight: 0, icon: '❌' },
      { key: 'sparkle', label: 'Sparkle Fountains', description: 'Cold sparks for dramatic moments', costPerShow: 300, rating: 2, fameRequired: 5000, haulWeight: 1, icon: '✨' },
      { key: 'flame_jets', label: 'Flame Jets', description: 'Controlled flame bursts (requires permit)', costPerShow: 800, rating: 3, fameRequired: 15000, haulWeight: 2, icon: '🔥' },
      { key: 'full_pyro', label: 'Full Pyro Show', description: 'Fireworks, flames, concussion pots — the works', costPerShow: 3000, rating: 5, fameRequired: 50000, haulWeight: 3, icon: '💥' },
    ],
  },
  {
    type: 'stage_design',
    label: 'Stage Design',
    icon: '🎭',
    options: [
      { key: 'flat_stage', label: 'Flat Stage', description: 'Standard flat performance area', costPerShow: 0, rating: 1, fameRequired: 0, haulWeight: 0, icon: '🟫' },
      { key: 'risers_backdrop', label: 'Risers + Backdrop', description: 'Drum riser and branded backdrop', costPerShow: 200, rating: 2, fameRequired: 0, haulWeight: 1, icon: '🎪' },
      { key: 'custom_set', label: 'Custom Set Piece', description: 'Themed stage with custom built elements', costPerShow: 1000, rating: 3, fameRequired: 10000, haulWeight: 3, icon: '🏗️' },
      { key: 'multi_level', label: 'Multi-Level Stage', description: 'Catwalks, B-stage, and hydraulic risers', costPerShow: 3000, rating: 4, fameRequired: 30000, haulWeight: 4, icon: '🏟️' },
      { key: 'transforming', label: 'Transforming Stage', description: 'Mechanized stage that changes shape mid-show', costPerShow: 8000, rating: 5, fameRequired: 100000, haulWeight: 5, icon: '⚡' },
    ],
  },
  {
    type: 'effects',
    label: 'Special Effects',
    icon: '🌫️',
    options: [
      { key: 'none_fx', label: 'None', description: 'No special effects', costPerShow: 0, rating: 0, fameRequired: 0, haulWeight: 0, icon: '❌' },
      { key: 'fog_haze', label: 'Fog & Haze', description: 'Atmospheric haze machines', costPerShow: 50, rating: 1, fameRequired: 0, haulWeight: 0, icon: '🌫️' },
      { key: 'co2_confetti', label: 'CO₂ Jets + Confetti', description: 'Blasts of CO₂ and confetti cannons', costPerShow: 400, rating: 3, fameRequired: 8000, haulWeight: 1, icon: '🎉' },
      { key: 'flying_rigs', label: 'Flying Rigs + Rain Curtain', description: 'Wire flying systems and water curtain effects', costPerShow: 2500, rating: 5, fameRequired: 60000, haulWeight: 4, icon: '🦅' },
    ],
  },
];

export type StageComponentSelections = Record<StageComponentType, string>;

export const DEFAULT_STAGE_SELECTIONS: StageComponentSelections = {
  sound: 'house_pa',
  lighting: 'house_lights',
  video: 'none_video',
  pyro: 'none_pyro',
  stage_design: 'flat_stage',
  effects: 'none_fx',
};

export function getSelectedOption(type: StageComponentType, key: string): StageComponentOption | null {
  const category = STAGE_COMPONENT_CATEGORIES.find(c => c.type === type);
  return category?.options.find(o => o.key === key) || null;
}

export function calculateProductionRating(selections: StageComponentSelections): number {
  let totalRating = 0;
  let maxRating = 0;
  for (const cat of STAGE_COMPONENT_CATEGORIES) {
    const selected = getSelectedOption(cat.type, selections[cat.type]);
    totalRating += selected?.rating || 0;
    maxRating += 5; // max per category
  }
  return Math.round((totalRating / maxRating) * 100);
}

export function calculateTotalStageCostPerShow(selections: StageComponentSelections): number {
  let total = 0;
  for (const cat of STAGE_COMPONENT_CATEGORIES) {
    const selected = getSelectedOption(cat.type, selections[cat.type]);
    total += selected?.costPerShow || 0;
  }
  return total;
}

export function calculateTotalHaulWeight(selections: StageComponentSelections): number {
  let total = 0;
  for (const cat of STAGE_COMPONENT_CATEGORIES) {
    const selected = getSelectedOption(cat.type, selections[cat.type]);
    total += selected?.haulWeight || 0;
  }
  return total;
}

export type HaulRequirement = 'minimal' | 'small' | 'medium' | 'large' | 'massive' | 'unlimited';

export function getHaulRequirement(totalWeight: number): HaulRequirement {
  if (totalWeight <= 2) return 'minimal';
  if (totalWeight <= 5) return 'small';
  if (totalWeight <= 10) return 'medium';
  if (totalWeight <= 18) return 'large';
  if (totalWeight <= 25) return 'massive';
  return 'unlimited';
}

export function getStageMerchBoost(rating: number): number {
  // 0-100 production rating → 1.0x to 2.0x merch boost
  return 1 + (rating / 100);
}

export function getStageFameBoost(rating: number): number {
  // 0-100 production rating → 1.0x to 1.5x fame boost
  return 1 + (rating / 200);
}
