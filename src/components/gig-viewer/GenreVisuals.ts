/**
 * Genre-reactive visual configurations
 * Maps music genres to color palettes, crowd behaviors, and lighting styles
 */

export interface GenreVisualConfig {
  // Color palette
  primaryHue: number;    // HSL hue
  secondaryHue: number;
  saturation: number;    // 0-100
  lightingStyle: 'strobe' | 'sweep' | 'pulse' | 'subtle' | 'rapid' | 'warm';
  // Crowd behavior
  crowdStyle: 'mosh' | 'bounce' | 'sway' | 'jump' | 'wave' | 'hype';
  crowdIntensityMod: number; // multiplier on base intensity
  enableCirclePit: boolean;
  enablePhoneLights: boolean;
  enableCrowdSurfer: boolean;
  // Stage effects
  bassPulse: boolean;     // border throbs on beat
  fogHeavy: boolean;
  particleStyle: 'sparks' | 'confetti' | 'smoke' | 'none';
  // Ambient
  ambientTone: string;    // warm, cool, neutral, neon
}

const GENRE_VISUALS: Record<string, GenreVisualConfig> = {
  // Rock family
  Rock: {
    primaryHue: 0, secondaryHue: 30, saturation: 70,
    lightingStyle: 'sweep', crowdStyle: 'jump', crowdIntensityMod: 1.1,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: true,
    bassPulse: false, fogHeavy: false, particleStyle: 'sparks', ambientTone: 'warm',
  },
  'Modern Rock': {
    primaryHue: 350, secondaryHue: 20, saturation: 65,
    lightingStyle: 'sweep', crowdStyle: 'jump', crowdIntensityMod: 1.1,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: true,
    bassPulse: false, fogHeavy: false, particleStyle: 'sparks', ambientTone: 'warm',
  },
  'Heavy Metal': {
    primaryHue: 0, secondaryHue: 15, saturation: 80,
    lightingStyle: 'strobe', crowdStyle: 'mosh', crowdIntensityMod: 1.4,
    enableCirclePit: true, enablePhoneLights: false, enableCrowdSurfer: true,
    bassPulse: true, fogHeavy: true, particleStyle: 'sparks', ambientTone: 'warm',
  },
  'Metalcore/Djent': {
    primaryHue: 350, secondaryHue: 270, saturation: 75,
    lightingStyle: 'strobe', crowdStyle: 'mosh', crowdIntensityMod: 1.5,
    enableCirclePit: true, enablePhoneLights: false, enableCrowdSurfer: true,
    bassPulse: true, fogHeavy: true, particleStyle: 'sparks', ambientTone: 'cool',
  },
  'Punk Rock': {
    primaryHue: 120, secondaryHue: 0, saturation: 60,
    lightingStyle: 'strobe', crowdStyle: 'mosh', crowdIntensityMod: 1.3,
    enableCirclePit: true, enablePhoneLights: false, enableCrowdSurfer: true,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'neutral',
  },

  // Pop family
  Pop: {
    primaryHue: 300, secondaryHue: 180, saturation: 70,
    lightingStyle: 'sweep', crowdStyle: 'bounce', crowdIntensityMod: 1.0,
    enableCirclePit: false, enablePhoneLights: true, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'confetti', ambientTone: 'neon',
  },
  'K-Pop/J-Pop': {
    primaryHue: 320, secondaryHue: 200, saturation: 80,
    lightingStyle: 'rapid', crowdStyle: 'bounce', crowdIntensityMod: 1.2,
    enableCirclePit: false, enablePhoneLights: true, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'confetti', ambientTone: 'neon',
  },
  'Indie/Bedroom Pop': {
    primaryHue: 40, secondaryHue: 160, saturation: 45,
    lightingStyle: 'subtle', crowdStyle: 'sway', crowdIntensityMod: 0.8,
    enableCirclePit: false, enablePhoneLights: true, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },
  Hyperpop: {
    primaryHue: 300, secondaryHue: 60, saturation: 95,
    lightingStyle: 'rapid', crowdStyle: 'jump', crowdIntensityMod: 1.3,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: false, particleStyle: 'confetti', ambientTone: 'neon',
  },

  // Electronic family
  Electronica: {
    primaryHue: 180, secondaryHue: 280, saturation: 85,
    lightingStyle: 'rapid', crowdStyle: 'bounce', crowdIntensityMod: 1.2,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: true, particleStyle: 'none', ambientTone: 'neon',
  },
  EDM: {
    primaryHue: 190, secondaryHue: 300, saturation: 90,
    lightingStyle: 'rapid', crowdStyle: 'jump', crowdIntensityMod: 1.3,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: true, particleStyle: 'confetti', ambientTone: 'neon',
  },
  Synthwave: {
    primaryHue: 280, secondaryHue: 180, saturation: 80,
    lightingStyle: 'pulse', crowdStyle: 'sway', crowdIntensityMod: 0.9,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: true, particleStyle: 'none', ambientTone: 'neon',
  },

  // Hip Hop family
  'Hip Hop': {
    primaryHue: 270, secondaryHue: 45, saturation: 70,
    lightingStyle: 'pulse', crowdStyle: 'hype', crowdIntensityMod: 1.1,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: false, particleStyle: 'smoke', ambientTone: 'cool',
  },
  Trap: {
    primaryHue: 280, secondaryHue: 0, saturation: 75,
    lightingStyle: 'pulse', crowdStyle: 'hype', crowdIntensityMod: 1.2,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: true, particleStyle: 'smoke', ambientTone: 'cool',
  },
  Drill: {
    primaryHue: 0, secondaryHue: 240, saturation: 60,
    lightingStyle: 'strobe', crowdStyle: 'hype', crowdIntensityMod: 1.2,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: true, particleStyle: 'smoke', ambientTone: 'cool',
  },
  'Gangsta Rap': {
    primaryHue: 260, secondaryHue: 40, saturation: 65,
    lightingStyle: 'pulse', crowdStyle: 'hype', crowdIntensityMod: 1.1,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: true, particleStyle: 'smoke', ambientTone: 'cool',
  },
  'Boom Bap': {
    primaryHue: 35, secondaryHue: 200, saturation: 55,
    lightingStyle: 'subtle', crowdStyle: 'bounce', crowdIntensityMod: 0.9,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },
  'Conscious Rap': {
    primaryHue: 45, secondaryHue: 160, saturation: 50,
    lightingStyle: 'subtle', crowdStyle: 'sway', crowdIntensityMod: 0.85,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },
  'Lo-Fi Hip Hop': {
    primaryHue: 200, secondaryHue: 280, saturation: 35,
    lightingStyle: 'subtle', crowdStyle: 'sway', crowdIntensityMod: 0.6,
    enableCirclePit: false, enablePhoneLights: true, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },
  Grime: {
    primaryHue: 240, secondaryHue: 0, saturation: 70,
    lightingStyle: 'strobe', crowdStyle: 'hype', crowdIntensityMod: 1.3,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: false, particleStyle: 'smoke', ambientTone: 'cool',
  },
  Phonk: {
    primaryHue: 0, secondaryHue: 270, saturation: 65,
    lightingStyle: 'pulse', crowdStyle: 'bounce', crowdIntensityMod: 1.1,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: true, particleStyle: 'smoke', ambientTone: 'cool',
  },
  'Emo Rap': {
    primaryHue: 260, secondaryHue: 340, saturation: 55,
    lightingStyle: 'subtle', crowdStyle: 'sway', crowdIntensityMod: 0.9,
    enableCirclePit: false, enablePhoneLights: true, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'cool',
  },

  // Jazz / Blues family
  Jazz: {
    primaryHue: 35, secondaryHue: 200, saturation: 50,
    lightingStyle: 'warm', crowdStyle: 'sway', crowdIntensityMod: 0.6,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },
  'Jazz Rap': {
    primaryHue: 40, secondaryHue: 260, saturation: 50,
    lightingStyle: 'subtle', crowdStyle: 'sway', crowdIntensityMod: 0.7,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },
  Blues: {
    primaryHue: 220, secondaryHue: 35, saturation: 45,
    lightingStyle: 'warm', crowdStyle: 'sway', crowdIntensityMod: 0.7,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },

  // R&B / Soul
  'R&B': {
    primaryHue: 280, secondaryHue: 340, saturation: 55,
    lightingStyle: 'pulse', crowdStyle: 'sway', crowdIntensityMod: 0.8,
    enableCirclePit: false, enablePhoneLights: true, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },
  'Alt R&B/Neo-Soul': {
    primaryHue: 300, secondaryHue: 180, saturation: 50,
    lightingStyle: 'pulse', crowdStyle: 'sway', crowdIntensityMod: 0.75,
    enableCirclePit: false, enablePhoneLights: true, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },

  // Country / Reggae / Latin / World
  Country: {
    primaryHue: 40, secondaryHue: 25, saturation: 50,
    lightingStyle: 'warm', crowdStyle: 'sway', crowdIntensityMod: 0.8,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },
  Reggae: {
    primaryHue: 120, secondaryHue: 45, saturation: 60,
    lightingStyle: 'pulse', crowdStyle: 'sway', crowdIntensityMod: 0.9,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },
  Latin: {
    primaryHue: 15, secondaryHue: 45, saturation: 70,
    lightingStyle: 'sweep', crowdStyle: 'bounce', crowdIntensityMod: 1.1,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'confetti', ambientTone: 'warm',
  },
  Flamenco: {
    primaryHue: 10, secondaryHue: 35, saturation: 65,
    lightingStyle: 'warm', crowdStyle: 'sway', crowdIntensityMod: 0.85,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },
  'World Music': {
    primaryHue: 30, secondaryHue: 160, saturation: 55,
    lightingStyle: 'subtle', crowdStyle: 'sway', crowdIntensityMod: 0.85,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },
  'African Music': {
    primaryHue: 35, secondaryHue: 120, saturation: 65,
    lightingStyle: 'pulse', crowdStyle: 'bounce', crowdIntensityMod: 1.1,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },
  'Afrobeats/Amapiano': {
    primaryHue: 40, secondaryHue: 300, saturation: 70,
    lightingStyle: 'pulse', crowdStyle: 'bounce', crowdIntensityMod: 1.2,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: false, particleStyle: 'confetti', ambientTone: 'warm',
  },

  // Classical
  Classical: {
    primaryHue: 45, secondaryHue: 200, saturation: 30,
    lightingStyle: 'warm', crowdStyle: 'sway', crowdIntensityMod: 0.4,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'warm',
  },

  // Other rap subgenres
  'Cloud Rap': {
    primaryHue: 220, secondaryHue: 180, saturation: 40,
    lightingStyle: 'subtle', crowdStyle: 'sway', crowdIntensityMod: 0.7,
    enableCirclePit: false, enablePhoneLights: true, enableCrowdSurfer: false,
    bassPulse: false, fogHeavy: true, particleStyle: 'smoke', ambientTone: 'cool',
  },
  'Mumble Rap': {
    primaryHue: 280, secondaryHue: 330, saturation: 65,
    lightingStyle: 'pulse', crowdStyle: 'bounce', crowdIntensityMod: 1.0,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: true, particleStyle: 'smoke', ambientTone: 'cool',
  },
  Crunk: {
    primaryHue: 50, secondaryHue: 0, saturation: 75,
    lightingStyle: 'strobe', crowdStyle: 'hype', crowdIntensityMod: 1.4,
    enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
    bassPulse: true, fogHeavy: false, particleStyle: 'confetti', ambientTone: 'warm',
  },
};

// Export for admin demo
export { GENRE_VISUALS };

const DEFAULT_VISUALS: GenreVisualConfig = {
  primaryHue: 220, secondaryHue: 270, saturation: 60,
  lightingStyle: 'sweep', crowdStyle: 'bounce', crowdIntensityMod: 1.0,
  enableCirclePit: false, enablePhoneLights: false, enableCrowdSurfer: false,
  bassPulse: false, fogHeavy: false, particleStyle: 'none', ambientTone: 'neutral',
};

export function getGenreVisuals(genre?: string | null): GenreVisualConfig {
  if (!genre) return DEFAULT_VISUALS;
  return GENRE_VISUALS[genre] || DEFAULT_VISUALS;
}

/**
 * Generate a lighting color from genre visuals + crowd mood
 */
export function getGenreLightingColor(visuals: GenreVisualConfig, crowdMood: string): string {
  const { primaryHue, secondaryHue, saturation } = visuals;
  // Shift color based on mood
  const moodHueShift = crowdMood === 'ecstatic' ? 0
    : crowdMood === 'enthusiastic' ? 10
    : crowdMood === 'engaged' ? 0
    : crowdMood === 'mixed' ? 30
    : 60; // disappointed shifts toward warm/red
  const hue = (primaryHue + moodHueShift) % 360;
  const lightness = crowdMood === 'disappointed' ? 35 : 50;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
