import type { SkillProgressRecord } from "@/hooks/useSkillSystem.types";

export interface ClothingScores {
  qualityScore: number;
  styleScore: number;
  rarity: string;
  productionCost: number;
}

const getSkillLevel = (progress: SkillProgressRecord[], slug: string): number => {
  const skill = progress.find((s) => s.skill_slug === slug);
  return skill?.current_level ?? 0;
};

export const getRarityFromQuality = (quality: number): string => {
  if (quality >= 86) return "legendary";
  if (quality >= 71) return "epic";
  if (quality >= 51) return "rare";
  if (quality >= 31) return "uncommon";
  return "common";
};

export const calculateClothingScores = (
  skillProgress: SkillProgressRecord[]
): ClothingScores => {
  const construction = getSkillLevel(skillProgress, "clothing_basic_construction");
  const constructionPro = getSkillLevel(skillProgress, "clothing_professional_construction");
  const constructionMastery = getSkillLevel(skillProgress, "clothing_mastery_construction");
  const textiles = getSkillLevel(skillProgress, "fashion_basic_textiles");
  const textilesPro = getSkillLevel(skillProgress, "fashion_professional_textiles");
  const patterns = getSkillLevel(skillProgress, "fashion_basic_patterns");
  const patternsPro = getSkillLevel(skillProgress, "fashion_professional_patterns");

  const styleAesthetics = getSkillLevel(skillProgress, "fashion_basic_styling");
  const styleAestheticsPro = getSkillLevel(skillProgress, "fashion_professional_styling");
  const genreAesthetics = getSkillLevel(skillProgress, "clothing_basic_genre_style");
  const genreAestheticsPro = getSkillLevel(skillProgress, "clothing_professional_genre_fashion");
  const fashionFundamentals = getSkillLevel(skillProgress, "fashion_basic_fundamentals");
  const fashionFundamentalsPro = getSkillLevel(skillProgress, "fashion_professional_fundamentals");

  // Combined construction skill (basic + pro + mastery contributions)
  const totalConstruction = construction + constructionPro * 1.5 + constructionMastery * 2;
  const totalTextiles = textiles + textilesPro * 1.5;
  const totalPatterns = patterns + patternsPro * 1.5;

  const qualityScore = Math.min(
    100,
    Math.floor(totalConstruction / 10 + totalTextiles / 15 + totalPatterns / 15)
  );

  const totalStyle = styleAesthetics + styleAestheticsPro * 1.5;
  const totalGenre = genreAesthetics + genreAestheticsPro * 1.5;
  const totalFundamentals = fashionFundamentals + fashionFundamentalsPro * 1.5;

  const styleScore = Math.min(
    100,
    Math.floor(totalStyle / 10 + totalGenre / 15 + totalFundamentals / 20)
  );

  const rarity = getRarityFromQuality(qualityScore);

  // Production cost scales with quality
  const productionCost = Math.max(50, Math.floor(qualityScore * 15 + styleScore * 5));

  return { qualityScore, styleScore, rarity, productionCost };
};

export const GENRE_STYLES = [
  "rock",
  "hip_hop",
  "pop",
  "jazz",
  "electronic",
  "country",
  "metal",
  "punk",
  "r_and_b",
  "latin",
] as const;

export type GenreStyle = (typeof GENRE_STYLES)[number];

export const CLOTHING_CATEGORIES = [
  "tops",
  "bottoms",
  "outerwear",
  "shoes",
  "accessories",
  "hats",
] as const;

export type ClothingCategory = (typeof CLOTHING_CATEGORIES)[number];

export const CATEGORY_EMOJIS: Record<ClothingCategory, string> = {
  tops: "👕",
  bottoms: "👖",
  outerwear: "🧥",
  shoes: "👟",
  accessories: "💎",
  hats: "🎩",
};

export const RARITY_COLORS: Record<string, string> = {
  common: "text-muted-foreground border-muted-foreground/30",
  uncommon: "text-success border-success/50",
  rare: "text-primary border-primary/50",
  epic: "text-accent border-accent/50",
  legendary: "text-warning border-warning/50",
};
