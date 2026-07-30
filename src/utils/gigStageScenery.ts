import type { LiveGigVenueInput, VenuePresentationTier } from './gigLivePresentation';

export type StageEnvironment = 'indoor' | 'covered_outdoor' | 'outdoor';
export type StageTimeOfDay = 'day' | 'golden_hour' | 'dusk' | 'night';

export interface StageScenery {
  tier: VenuePresentationTier;
  environment: StageEnvironment;
  timeOfDay: StageTimeOfDay;
  label: string;
  /** Tailwind gradient classes used for the sky / room backdrop. */
  skyClass: string;
  /** Tailwind classes for the ground / floor band beneath the crowd. */
  groundClass: string;
  /** Tailwind classes for the stage deck itself. */
  stageClass: string;
  /** Shape of the stage deck (rounded shell vs open festival truss). */
  stageShape: 'arch' | 'flat' | 'tent' | 'truss';
  /** Decorative scenery layers drawn behind the stage. */
  props: Array<'trusses' | 'led_wall' | 'pa_towers' | 'canopy' | 'tent_poles' | 'flags' | 'treeline' | 'skyline' | 'hills' | 'sea' | 'stars' | 'sun' | 'floodlights' | 'brick_wall' | 'curtains' | 'balconies' | 'bunting' | 'food_stalls' | 'ferris_wheel'>;
  /** Weather / atmosphere overlay hint. */
  atmosphere: 'clear' | 'hazy' | 'dusty' | 'humid' | 'breezy' | 'smoky';
}

const NIGHT_SKY = 'bg-gradient-to-b from-indigo-950 via-slate-900 to-black';

const PRESETS: Record<VenuePresentationTier, Omit<StageScenery, 'tier' | 'timeOfDay'>> = {
  dive_basement: { environment: 'indoor', label: 'Basement dive', skyClass: 'bg-gradient-to-b from-stone-900 via-neutral-950 to-black', groundClass: 'bg-neutral-950', stageClass: 'bg-black/70 border-white/10', stageShape: 'flat', props: ['brick_wall'], atmosphere: 'smoky' },
  small_bar: { environment: 'indoor', label: 'Back-room bar', skyClass: 'bg-gradient-to-b from-amber-950 via-stone-950 to-black', groundClass: 'bg-stone-950', stageClass: 'bg-black/60 border-amber-200/15', stageShape: 'flat', props: ['brick_wall', 'bunting'], atmosphere: 'smoky' },
  local_club: { environment: 'indoor', label: 'Local club', skyClass: 'bg-gradient-to-b from-slate-900 via-slate-950 to-black', groundClass: 'bg-slate-950', stageClass: 'bg-black/60 border-white/15', stageShape: 'arch', props: ['curtains', 'pa_towers'], atmosphere: 'hazy' },
  warehouse: { environment: 'indoor', label: 'Warehouse rave', skyClass: 'bg-gradient-to-b from-zinc-900 via-zinc-950 to-black', groundClass: 'bg-zinc-950', stageClass: 'bg-black/60 border-cyan-200/20', stageShape: 'truss', props: ['trusses', 'led_wall', 'pa_towers'], atmosphere: 'smoky' },
  theatre: { environment: 'indoor', label: 'Seated theatre', skyClass: 'bg-gradient-to-b from-red-950 via-stone-950 to-black', groundClass: 'bg-stone-950', stageClass: 'bg-black/60 border-amber-200/25', stageShape: 'arch', props: ['curtains', 'balconies'], atmosphere: 'clear' },
  music_hall: { environment: 'indoor', label: 'Music hall', skyClass: 'bg-gradient-to-b from-purple-950 via-slate-950 to-black', groundClass: 'bg-slate-950', stageClass: 'bg-black/60 border-purple-200/20', stageShape: 'arch', props: ['curtains', 'balconies', 'pa_towers'], atmosphere: 'hazy' },
  large_venue: { environment: 'indoor', label: 'Large venue', skyClass: 'bg-gradient-to-b from-slate-900 via-slate-950 to-black', groundClass: 'bg-slate-950', stageClass: 'bg-black/60 border-white/20', stageShape: 'truss', props: ['trusses', 'led_wall', 'pa_towers'], atmosphere: 'hazy' },
  arena: { environment: 'indoor', label: 'Indoor arena', skyClass: 'bg-gradient-to-b from-slate-900 via-indigo-950 to-black', groundClass: 'bg-slate-950', stageClass: 'bg-black/60 border-white/25', stageShape: 'truss', props: ['trusses', 'led_wall', 'pa_towers', 'balconies'], atmosphere: 'hazy' },
  stadium: { environment: 'outdoor', label: 'Open-air stadium', skyClass: 'bg-gradient-to-b from-indigo-900 via-slate-900 to-slate-950', groundClass: 'bg-emerald-950', stageClass: 'bg-black/55 border-white/25', stageShape: 'truss', props: ['stars', 'trusses', 'led_wall', 'pa_towers', 'floodlights', 'skyline'], atmosphere: 'breezy' },
  amphitheatre: { environment: 'outdoor', label: 'Open-air amphitheatre', skyClass: 'bg-gradient-to-b from-sky-900 via-indigo-950 to-slate-950', groundClass: 'bg-emerald-950', stageClass: 'bg-black/50 border-amber-100/25', stageShape: 'arch', props: ['stars', 'hills', 'treeline', 'pa_towers'], atmosphere: 'breezy' },
  park_bandstand: { environment: 'covered_outdoor', label: 'Park bandstand', skyClass: 'bg-gradient-to-b from-sky-500 via-sky-300 to-emerald-200', groundClass: 'bg-emerald-700', stageClass: 'bg-emerald-950/60 border-amber-200/40', stageShape: 'tent', props: ['sun', 'treeline', 'bunting', 'canopy'], atmosphere: 'clear' },
  beach_stage: { environment: 'outdoor', label: 'Beachfront stage', skyClass: 'bg-gradient-to-b from-orange-400 via-rose-400 to-indigo-700', groundClass: 'bg-amber-200/80', stageClass: 'bg-slate-900/60 border-orange-100/30', stageShape: 'truss', props: ['sun', 'sea', 'flags', 'pa_towers'], atmosphere: 'humid' },
  festival_stage: { environment: 'outdoor', label: 'Festival field stage', skyClass: 'bg-gradient-to-b from-indigo-800 via-purple-900 to-slate-950', groundClass: 'bg-lime-950', stageClass: 'bg-black/50 border-white/20', stageShape: 'truss', props: ['stars', 'trusses', 'pa_towers', 'flags', 'treeline', 'food_stalls'], atmosphere: 'dusty' },
  festival_main_stage: { environment: 'outdoor', label: 'Festival main stage', skyClass: 'bg-gradient-to-b from-fuchsia-900 via-indigo-900 to-slate-950', groundClass: 'bg-lime-950', stageClass: 'bg-black/50 border-fuchsia-200/25', stageShape: 'truss', props: ['stars', 'trusses', 'led_wall', 'pa_towers', 'floodlights', 'flags', 'ferris_wheel', 'food_stalls'], atmosphere: 'dusty' },
  festival_second_stage: { environment: 'outdoor', label: 'Festival second stage', skyClass: 'bg-gradient-to-b from-amber-500 via-orange-600 to-indigo-900', groundClass: 'bg-lime-900', stageClass: 'bg-black/45 border-amber-100/30', stageShape: 'truss', props: ['sun', 'trusses', 'pa_towers', 'flags', 'treeline'], atmosphere: 'dusty' },
  festival_tent: { environment: 'covered_outdoor', label: 'Festival big top', skyClass: 'bg-gradient-to-b from-purple-950 via-fuchsia-950 to-slate-950', groundClass: 'bg-amber-950', stageClass: 'bg-black/55 border-fuchsia-200/25', stageShape: 'tent', props: ['canopy', 'tent_poles', 'trusses', 'flags'], atmosphere: 'humid' },
  festival_acoustic_field: { environment: 'covered_outdoor', label: 'Acoustic field stage', skyClass: 'bg-gradient-to-b from-sky-600 via-amber-300 to-emerald-300', groundClass: 'bg-emerald-700', stageClass: 'bg-emerald-950/55 border-amber-200/35', stageShape: 'tent', props: ['sun', 'canopy', 'treeline', 'bunting', 'hills'], atmosphere: 'clear' },
};

export function mapTimeOfDay(venue?: LiveGigVenueInput | null, tier?: VenuePresentationTier): StageTimeOfDay {
  const type = `${venue?.venueType ?? ''} ${venue?.stageSize ?? ''}`;
  if (/afternoon|matinee|daytime|acoustic/i.test(type)) return 'day';
  if (/sunset|golden/i.test(type)) return 'golden_hour';
  if (tier === 'park_bandstand' || tier === 'festival_acoustic_field') return 'day';
  if (tier === 'beach_stage' || tier === 'festival_second_stage') return 'golden_hour';
  if (tier === 'amphitheatre') return 'dusk';
  return 'night';
}

export function buildStageScenery(tier: VenuePresentationTier, venue?: LiveGigVenueInput | null): StageScenery {
  const preset = PRESETS[tier] ?? PRESETS.local_club;
  const timeOfDay = mapTimeOfDay(venue, tier);
  const forcedOutdoor = venue?.isOutdoor === true && preset.environment === 'indoor';
  return {
    ...preset,
    tier,
    timeOfDay,
    environment: forcedOutdoor ? 'outdoor' : preset.environment,
    skyClass: forcedOutdoor ? NIGHT_SKY : preset.skyClass,
    props: forcedOutdoor ? [...preset.props, 'stars', 'treeline'] : preset.props,
  };
}
