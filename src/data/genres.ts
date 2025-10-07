/**
 * Centralized music genre system
 * Synced with the skill tree genre tracks
 */

// Genre list from skill tree
export const MUSIC_GENRES = [
  "Rock",
  "Pop",
  "Hip Hop",
  "Jazz",
  "Blues",
  "Country",
  "Reggae",
  "Heavy Metal",
  "Classical",
  "Electronica",
  "Latin",
  "World Music",
  "R&B",
  "Punk Rock",
  "Flamenco",
  "African Music",
  "Modern Rock",
  "EDM",
  "Trap",
  "Drill",
  "Lo-Fi Hip Hop",
  "K-Pop/J-Pop",
  "Afrobeats/Amapiano",
  "Synthwave",
  "Indie/Bedroom Pop",
  "Hyperpop",
  "Metalcore/Djent",
  "Alt R&B/Neo-Soul"
] as const;

export type MusicGenre = typeof MUSIC_GENRES[number];

// Helper function to convert genre name to skill slug format
const sanitizeSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

// Map genre names to their skill slugs at each tier
export const GENRE_SKILL_MAP: Record<string, { basic: string; professional: string; mastery: string }> = 
  Object.fromEntries(
    MUSIC_GENRES.map(genre => {
      const slugBase = sanitizeSlug(genre);
      return [
        genre,
        {
          basic: `genres_basic_${slugBase}`,
          professional: `genres_professional_${slugBase}`,
          mastery: `genres_mastery_${slugBase}`
        }
      ];
    })
  );

/**
 * Get the skill slug for a genre at a specific tier
 */
export function getGenreSkillSlug(
  genre: string, 
  tier: 'basic' | 'professional' | 'mastery' = 'basic'
): string | null {
  const mapping = GENRE_SKILL_MAP[genre];
  return mapping ? mapping[tier] : null;
}

/**
 * Get all skill slugs for a genre (all tiers)
 */
export function getAllGenreSkillSlugs(genre: string): string[] {
  const mapping = GENRE_SKILL_MAP[genre];
  if (!mapping) return [];
  return [mapping.basic, mapping.professional, mapping.mastery];
}

/**
 * Options formatted for Select components
 */
export const GENRE_SELECT_OPTIONS = MUSIC_GENRES.map(genre => ({
  value: genre,
  label: genre
}));

/**
 * Check if a string is a valid genre
 */
export function isValidGenre(genre: string): genre is MusicGenre {
  return MUSIC_GENRES.includes(genre as MusicGenre);
}
