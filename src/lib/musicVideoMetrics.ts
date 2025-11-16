import { Database } from "@/integrations/supabase/types";

export type MusicVideoConfigRow = Database["public"]["Tables"]["music_video_configs"]["Row"];

export type BudgetTier = "diy" | "indie" | "studio" | "blockbuster" | string;
export type ThemeOption = "cinematic" | "narrative" | "performance" | "animated" | "experimental" | string;
export type ArtStyleOption =
  | "neon_cyberpunk"
  | "vintage_film"
  | "modern_minimal"
  | "surrealist"
  | "documentary"
  | string;
export type ImageQualityOption = "hd" | "4k" | "6k" | "8k" | string;
export type CastOption =
  | "band_only"
  | "featured_dancers"
  | "celebrity_cameo"
  | "professional_actors"
  | string;
export type CastQualityOption = "emerging" | "seasoned" | "award_winning" | string;
export type LocationStyleOption =
  | "urban_night"
  | "desert_scape"
  | "sound_stage"
  | "studio_with_led"
  | "on_tour"
  | string;

export interface MusicVideoPlanInput {
  theme: ThemeOption;
  artStyle: ArtStyleOption;
  budgetTier: BudgetTier;
  imageQuality: ImageQualityOption;
  castOption: CastOption;
  castQuality?: CastQualityOption | null;
  locationStyle?: LocationStyleOption | null;
}

export interface MusicVideoPlan {
  budgetAmount: number;
  productionValueScore: number;
  youtubeViews: number;
  chartPosition: number;
  chartVelocity: number;
  mtvSpins: number;
}

const BUDGET_BASELINE: Record<BudgetTier, number> = {
  diy: 3500,
  indie: 15000,
  studio: 52000,
  blockbuster: 180000,
};

const THEME_MULTIPLIERS: Record<string, number> = {
  cinematic: 1.1,
  narrative: 1.06,
  performance: 0.96,
  animated: 1.02,
  experimental: 1.08,
};

const ART_STYLE_MULTIPLIERS: Record<string, number> = {
  neon_cyberpunk: 1.09,
  vintage_film: 1.0,
  modern_minimal: 1.04,
  surrealist: 1.12,
  documentary: 0.95,
};

const IMAGE_QUALITY_MULTIPLIERS: Record<string, number> = {
  hd: 0.95,
  "4k": 1.05,
  "6k": 1.08,
  "8k": 1.12,
};

const CAST_OPTION_MULTIPLIERS: Record<string, number> = {
  band_only: 0.9,
  featured_dancers: 1.04,
  celebrity_cameo: 1.18,
  professional_actors: 1.15,
};

const CAST_QUALITY_MULTIPLIERS: Record<string, number> = {
  emerging: 0.96,
  seasoned: 1.05,
  award_winning: 1.12,
};

const LOCATION_MULTIPLIERS: Record<string, number> = {
  urban_night: 1.06,
  desert_scape: 1.03,
  sound_stage: 0.98,
  studio_with_led: 1.08,
  on_tour: 1.02,
};

const THEME_CHART_LOOKUP: Record<string, string> = {
  cinematic: "Global Cinematic Premieres 50",
  narrative: "Storyline Spotlight 75",
  performance: "Live Performance Heat Index",
  animated: "Animated Visuals Top 40",
  experimental: "Avant Visual Vanguard 30",
};

const BUDGET_TO_MTV_SLOT: Record<string, string> = {
  diy: "MTV Uprising Nights",
  indie: "MTV Indie Vision",
  studio: "MTV Prime Countdown",
  blockbuster: "MTV World Premiere",
};

function lookupMultiplier<T extends Record<string, number>>(map: T, key: string, fallback = 1) {
  return map[key] ?? fallback;
}

function resolveBudgetBaseline(budgetTier: BudgetTier) {
  return BUDGET_BASELINE[budgetTier] ?? 18000;
}

export function calculateMusicVideoPlan(input: MusicVideoPlanInput): MusicVideoPlan {
  const baseBudget = resolveBudgetBaseline(input.budgetTier);
  const themeMultiplier = lookupMultiplier(THEME_MULTIPLIERS, input.theme, 1);
  const artMultiplier = lookupMultiplier(ART_STYLE_MULTIPLIERS, input.artStyle, 1);
  const imageMultiplier = lookupMultiplier(IMAGE_QUALITY_MULTIPLIERS, input.imageQuality, 1);
  const castMultiplier = lookupMultiplier(CAST_OPTION_MULTIPLIERS, input.castOption, 1);
  const castQualityMultiplier = input.castQuality
    ? lookupMultiplier(CAST_QUALITY_MULTIPLIERS, input.castQuality, 1)
    : 1;
  const locationMultiplier = input.locationStyle
    ? lookupMultiplier(LOCATION_MULTIPLIERS, input.locationStyle, 1)
    : 1;

  const compositeMultiplier =
    themeMultiplier *
    artMultiplier *
    imageMultiplier *
    castMultiplier *
    castQualityMultiplier *
    locationMultiplier;

  const budgetAmount = Math.round(baseBudget * (0.7 + compositeMultiplier * 0.35));
  const productionValueScore = Math.log(budgetAmount + 5000) * compositeMultiplier * 1.15;

  const youtubeViews = Math.round(7500 * productionValueScore ** 2);
  const chartPosition = Math.max(1, Math.min(100, Math.round(108 - productionValueScore * 6.2)));
  const chartVelocity = Math.max(1, Math.round(productionValueScore * 4.6));
  const mtvSpins = Math.max(6, Math.round(productionValueScore * 17));

  return {
    budgetAmount,
    productionValueScore,
    youtubeViews,
    chartPosition,
    chartVelocity,
    mtvSpins,
  };
}

export function resolveChartName(theme: ThemeOption, fallback = "Visual Premiere Hotlist") {
  return THEME_CHART_LOOKUP[theme] ?? fallback;
}

export function resolveMtvProgram(budgetTier: BudgetTier, fallback = "MTV After Hours") {
  return BUDGET_TO_MTV_SLOT[budgetTier] ?? fallback;
}

const YOUTUBE_ID_REGEX =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/i;

export function extractYouTubeVideoId(url?: string | null) {
  if (!url) return null;
  const match = url.match(YOUTUBE_ID_REGEX);
  return match ? match[1] : null;
}

export function buildPlanFromRow(row: Pick<MusicVideoConfigRow, "theme" | "art_style" | "budget_tier" | "image_quality" | "cast_option" | "cast_quality" | "location_style">) {
  return calculateMusicVideoPlan({
    theme: row.theme,
    artStyle: row.art_style,
    budgetTier: row.budget_tier,
    imageQuality: row.image_quality,
    castOption: row.cast_option,
    castQuality: row.cast_quality,
    locationStyle: row.location_style ?? undefined,
  });
}

export function derivePlanMetadata(row: MusicVideoConfigRow) {
  const plan = buildPlanFromRow(row);
  return {
    plan,
    chartName: resolveChartName(row.theme as ThemeOption),
    mtvProgram: resolveMtvProgram(row.budget_tier as BudgetTier),
    youtubeVideoId: extractYouTubeVideoId(row.youtube_video_url ?? undefined),
  };
}
