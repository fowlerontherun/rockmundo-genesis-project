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
  props: Array<'trusses' | 'led_wall' | 'pa_towers' | 'canopy' | 'tent_poles' | 'flags' | 'treeline' | 'skyline' | 'hills' | 'sea' | 'stars' | 'sun' | 'floodlights' | 'brick_wall' | 'curtains' | 'balconies' | 'bunting' | 'food_stalls' | 'ferris_wheel' | 'disco_ball' | 'chandeliers' | 'stained_glass' | 'mountains' | 'vine_rows' | 'city_lights' | 'neon_signs' | 'rooftop_railing' | 'slot_machines' | 'ice_surface' | 'sand_dunes' | 'street_lamps' | 'river' | 'hangar' | 'lanterns' | 'forest_canopy' | 'sports_lines' | 'wall_posters' | 'snow_caps' | 'seating_bowl' | 'upper_tier' | 'tent_stripes' | 'tent_pennants' | 'stall_seating' | 'pitch_ring'>;
  /** Weather / atmosphere overlay hint. */
  atmosphere: 'clear' | 'hazy' | 'dusty' | 'humid' | 'breezy' | 'smoky';
}

const NIGHT_SKY = 'bg-gradient-to-b from-indigo-950 via-slate-900 to-black';

const PRESETS: Record<VenuePresentationTier, Omit<StageScenery, 'tier' | 'timeOfDay'>> = {
  street_corner: { environment: 'outdoor', label: 'Street corner busk', skyClass: 'bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950', groundClass: 'bg-stone-800', stageClass: 'bg-black/40 border-white/10', stageShape: 'flat', props: ['street_lamps', 'skyline', 'city_lights', 'wall_posters'], atmosphere: 'breezy' },
  church_hall: { environment: 'indoor', label: 'Church hall', skyClass: 'bg-gradient-to-b from-amber-900 via-stone-900 to-stone-950', groundClass: 'bg-stone-900', stageClass: 'bg-black/45 border-amber-200/25', stageShape: 'arch', props: ['stained_glass', 'bunting', 'lanterns'], atmosphere: 'clear' },
  school_hall: { environment: 'indoor', label: 'School hall', skyClass: 'bg-gradient-to-b from-sky-950 via-slate-900 to-slate-950', groundClass: 'bg-amber-900/80', stageClass: 'bg-black/50 border-sky-200/20', stageShape: 'flat', props: ['sports_lines', 'curtains', 'wall_posters'], atmosphere: 'clear' },
  student_union: { environment: 'indoor', label: 'Student union', skyClass: 'bg-gradient-to-b from-fuchsia-950 via-slate-950 to-black', groundClass: 'bg-slate-950', stageClass: 'bg-black/60 border-fuchsia-200/25', stageShape: 'flat', props: ['neon_signs', 'wall_posters', 'pa_towers', 'disco_ball'], atmosphere: 'smoky' },
  jazz_lounge: { environment: 'indoor', label: 'Jazz lounge', skyClass: 'bg-gradient-to-b from-rose-950 via-stone-950 to-black', groundClass: 'bg-stone-950', stageClass: 'bg-black/70 border-amber-200/30', stageShape: 'arch', props: ['curtains', 'lanterns', 'chandeliers'], atmosphere: 'smoky' },
  opera_house: { environment: 'indoor', label: 'Opera house', skyClass: 'bg-gradient-to-b from-amber-950 via-red-950 to-black', groundClass: 'bg-stone-950', stageClass: 'bg-black/55 border-amber-200/40', stageShape: 'arch', props: ['curtains', 'balconies', 'chandeliers'], atmosphere: 'clear' },
  casino_ballroom: { environment: 'indoor', label: 'Casino ballroom', skyClass: 'bg-gradient-to-b from-yellow-950 via-purple-950 to-black', groundClass: 'bg-red-950', stageClass: 'bg-black/55 border-yellow-200/35', stageShape: 'arch', props: ['chandeliers', 'slot_machines', 'disco_ball', 'neon_signs'], atmosphere: 'hazy' },
  cruise_ship: { environment: 'covered_outdoor', label: 'Cruise ship lounge', skyClass: 'bg-gradient-to-b from-indigo-800 via-sky-900 to-slate-950', groundClass: 'bg-sky-950', stageClass: 'bg-black/50 border-cyan-100/30', stageShape: 'arch', props: ['stars', 'sea', 'lanterns', 'rooftop_railing'], atmosphere: 'humid' },
  riverside_barge: { environment: 'outdoor', label: 'Riverside barge', skyClass: 'bg-gradient-to-b from-slate-800 via-indigo-900 to-slate-950', groundClass: 'bg-slate-900', stageClass: 'bg-black/50 border-cyan-200/25', stageShape: 'flat', props: ['stars', 'river', 'city_lights', 'skyline', 'lanterns'], atmosphere: 'humid' },
  rooftop_terrace: { environment: 'outdoor', label: 'Rooftop terrace', skyClass: 'bg-gradient-to-b from-orange-500 via-purple-800 to-slate-950', groundClass: 'bg-stone-900', stageClass: 'bg-black/45 border-orange-100/30', stageShape: 'flat', props: ['skyline', 'city_lights', 'rooftop_railing', 'lanterns'], atmosphere: 'breezy' },
  ice_arena: { environment: 'indoor', label: 'Ice arena', skyClass: 'bg-gradient-to-b from-sky-900 via-slate-900 to-slate-950', groundClass: 'bg-sky-200/70', stageClass: 'bg-black/55 border-sky-100/30', stageShape: 'truss', props: ['ice_surface', 'trusses', 'led_wall', 'pa_towers', 'balconies'], atmosphere: 'hazy' },
  city_square: { environment: 'outdoor', label: 'City square stage', skyClass: 'bg-gradient-to-b from-indigo-800 via-slate-900 to-slate-950', groundClass: 'bg-stone-800', stageClass: 'bg-black/50 border-white/20', stageShape: 'truss', props: ['stars', 'skyline', 'city_lights', 'street_lamps', 'trusses', 'pa_towers', 'food_stalls'], atmosphere: 'breezy' },
  vineyard_stage: { environment: 'outdoor', label: 'Vineyard stage', skyClass: 'bg-gradient-to-b from-amber-300 via-rose-400 to-indigo-800', groundClass: 'bg-lime-900', stageClass: 'bg-stone-900/55 border-amber-200/35', stageShape: 'tent', props: ['sun', 'vine_rows', 'hills', 'lanterns', 'canopy'], atmosphere: 'clear' },
  mountain_stage: { environment: 'outdoor', label: 'Mountain stage', skyClass: 'bg-gradient-to-b from-sky-700 via-slate-800 to-slate-950', groundClass: 'bg-slate-800', stageClass: 'bg-black/50 border-sky-100/30', stageShape: 'truss', props: ['mountains', 'snow_caps', 'treeline', 'pa_towers', 'floodlights'], atmosphere: 'breezy' },
  desert_stage: { environment: 'outdoor', label: 'Desert stage', skyClass: 'bg-gradient-to-b from-orange-300 via-amber-600 to-purple-900', groundClass: 'bg-amber-700', stageClass: 'bg-black/45 border-amber-100/35', stageShape: 'truss', props: ['sun', 'sand_dunes', 'trusses', 'pa_towers', 'flags'], atmosphere: 'dusty' },
  festival_dance_tent: { environment: 'covered_outdoor', label: 'Festival dance tent', skyClass: 'bg-gradient-to-b from-cyan-950 via-fuchsia-950 to-black', groundClass: 'bg-zinc-950', stageClass: 'bg-black/60 border-cyan-200/30', stageShape: 'tent', props: ['canopy', 'tent_poles', 'led_wall', 'disco_ball', 'trusses'], atmosphere: 'smoky' },
  festival_forest_stage: { environment: 'covered_outdoor', label: 'Forest stage', skyClass: 'bg-gradient-to-b from-emerald-950 via-teal-950 to-slate-950', groundClass: 'bg-emerald-950', stageClass: 'bg-black/55 border-emerald-200/25', stageShape: 'tent', props: ['forest_canopy', 'treeline', 'lanterns', 'stars', 'pa_towers'], atmosphere: 'humid' },
  festival_airfield: { environment: 'outdoor', label: 'Airfield festival stage', skyClass: 'bg-gradient-to-b from-slate-700 via-indigo-900 to-slate-950', groundClass: 'bg-zinc-800', stageClass: 'bg-black/50 border-white/25', stageShape: 'truss', props: ['stars', 'hangar', 'trusses', 'led_wall', 'pa_towers', 'floodlights', 'flags', 'food_stalls'], atmosphere: 'dusty' },
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
  festival_cabaret_tent: { environment: 'covered_outdoor', label: 'Cabaret tent', skyClass: 'bg-gradient-to-b from-rose-950 via-purple-950 to-black', groundClass: 'bg-red-950', stageClass: 'bg-black/60 border-rose-200/35', stageShape: 'tent', props: ['canopy', 'tent_stripes', 'tent_poles', 'tent_pennants', 'curtains', 'lanterns', 'disco_ball'], atmosphere: 'smoky' },
  festival_gospel_tent: { environment: 'covered_outdoor', label: 'Gospel tent', skyClass: 'bg-gradient-to-b from-amber-900 via-amber-950 to-stone-950', groundClass: 'bg-amber-950', stageClass: 'bg-black/50 border-amber-200/40', stageShape: 'tent', props: ['canopy', 'tent_stripes', 'tent_poles', 'tent_pennants', 'stall_seating', 'bunting', 'lanterns'], atmosphere: 'humid' },
  festival_comedy_tent: { environment: 'covered_outdoor', label: 'Comedy tent', skyClass: 'bg-gradient-to-b from-sky-950 via-indigo-950 to-black', groundClass: 'bg-zinc-900', stageClass: 'bg-black/60 border-sky-200/30', stageShape: 'tent', props: ['canopy', 'tent_stripes', 'tent_poles', 'tent_pennants', 'stall_seating', 'wall_posters'], atmosphere: 'hazy' },
  festival_world_tent: { environment: 'covered_outdoor', label: 'World music tent', skyClass: 'bg-gradient-to-b from-orange-900 via-fuchsia-950 to-slate-950', groundClass: 'bg-amber-900', stageClass: 'bg-black/55 border-orange-200/35', stageShape: 'tent', props: ['canopy', 'tent_stripes', 'tent_poles', 'tent_pennants', 'flags', 'bunting', 'lanterns', 'food_stalls'], atmosphere: 'dusty' },
  arena_bowl: { environment: 'indoor', label: 'Arena bowl (seated tiers)', skyClass: 'bg-gradient-to-b from-slate-950 via-indigo-950 to-black', groundClass: 'bg-slate-950', stageClass: 'bg-black/65 border-indigo-200/30', stageShape: 'truss', props: ['seating_bowl', 'upper_tier', 'balconies', 'trusses', 'led_wall', 'pa_towers', 'floodlights'], atmosphere: 'hazy' },
  stadium_bowl: { environment: 'outdoor', label: 'Bowl stadium (wide view)', skyClass: 'bg-gradient-to-b from-indigo-900 via-slate-900 to-slate-950', groundClass: 'bg-emerald-900', stageClass: 'bg-black/55 border-emerald-100/30', stageShape: 'truss', props: ['stars', 'seating_bowl', 'upper_tier', 'pitch_ring', 'trusses', 'led_wall', 'pa_towers', 'floodlights', 'flags'], atmosphere: 'breezy' },
  festival_acoustic_field: { environment: 'covered_outdoor', label: 'Acoustic field stage', skyClass: 'bg-gradient-to-b from-sky-600 via-amber-300 to-emerald-300', groundClass: 'bg-emerald-700', stageClass: 'bg-emerald-950/55 border-amber-200/35', stageShape: 'tent', props: ['sun', 'canopy', 'treeline', 'bunting', 'hills'], atmosphere: 'clear' },
};

export function mapTimeOfDay(venue?: LiveGigVenueInput | null, tier?: VenuePresentationTier): StageTimeOfDay {
  const type = `${venue?.venueType ?? ''} ${venue?.stageSize ?? ''}`;
  if (/afternoon|matinee|daytime|acoustic/i.test(type)) return 'day';
  if (/sunset|golden/i.test(type)) return 'golden_hour';
  if (tier === 'park_bandstand' || tier === 'festival_acoustic_field' || tier === 'school_hall' || tier === 'street_corner') return 'day';
  if (tier === 'beach_stage' || tier === 'festival_second_stage' || tier === 'vineyard_stage' || tier === 'rooftop_terrace') return 'golden_hour';
  if (tier === 'amphitheatre' || tier === 'mountain_stage' || tier === 'desert_stage' || tier === 'city_square') return 'dusk';
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
