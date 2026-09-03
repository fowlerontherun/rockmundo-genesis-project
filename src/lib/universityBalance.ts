export interface UniversityRatingBand {
  label: string;
  minimum: number;
}

const PRESTIGE_BANDS: UniversityRatingBand[] = [
  { label: "Iconic", minimum: 95 },
  { label: "World-class", minimum: 85 },
  { label: "Renowned", minimum: 75 },
  { label: "Established", minimum: 60 },
  { label: "Regional", minimum: 0 },
];

const QUALITY_BANDS: UniversityRatingBand[] = [
  { label: "Exceptional", minimum: 95 },
  { label: "Excellent", minimum: 85 },
  { label: "Advanced", minimum: 75 },
  { label: "Strong", minimum: 60 },
  { label: "Developing", minimum: 0 },
];

function normalizedNumber(value: number | null | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeUniversityRating(value: number | null | undefined) {
  return Math.round(Math.min(100, Math.max(0, normalizedNumber(value, 50))));
}

function findRatingBand(
  value: number | null | undefined,
  bands: UniversityRatingBand[],
) {
  const rating = normalizeUniversityRating(value);
  return bands.find((band) => rating >= band.minimum) ?? bands[bands.length - 1];
}

export function getUniversityPrestigeBand(value: number | null | undefined) {
  return findRatingBand(value, PRESTIGE_BANDS);
}

export function getUniversityQualityBand(value: number | null | undefined) {
  return findRatingBand(value, QUALITY_BANDS);
}

export function calculateUniversityCoursePrice(
  basePrice: number | null | undefined,
  costModifier: number | null | undefined,
) {
  const normalizedBasePrice = Math.max(0, normalizedNumber(basePrice, 0));
  const normalizedModifier = Math.max(0, normalizedNumber(costModifier, 1));
  return Math.floor(normalizedBasePrice * normalizedModifier);
}

export function calculateUniversityCourseDuration(
  baseDurationDays: number | null | undefined,
  qualityOfLearning: number | null | undefined,
) {
  const normalizedDays = Math.max(1, Math.round(normalizedNumber(baseDurationDays, 1)));
  const quality = normalizeUniversityRating(qualityOfLearning);
  const durationMultiplier = (200 - quality) / 100;
  return Math.max(1, Math.ceil(normalizedDays * durationMultiplier));
}

export function calculateUniversityCourseXpRange(
  xpPerDayMin: number | null | undefined,
  xpPerDayMax: number | null | undefined,
  durationDays: number,
) {
  const days = Math.max(1, Math.round(normalizedNumber(durationDays, 1)));
  const dailyMin = Math.max(0, Math.round(normalizedNumber(xpPerDayMin, 0)));
  const dailyMax = Math.max(dailyMin, Math.round(normalizedNumber(xpPerDayMax, dailyMin)));

  return {
    minimum: dailyMin * days,
    maximum: dailyMax * days,
  };
}
