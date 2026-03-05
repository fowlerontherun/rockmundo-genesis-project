/**
 * Stage Practice Mini-Game — Shared Types
 */

// ─── Instrument definitions ───────────────────────────────────────────
export const INSTRUMENT_SLUGS = [
  'guitar', 'bass', 'drums', 'vocals', 'basic_keyboard',
  'basic_strings', 'basic_percussions', 'basic_electronic_instruments',
] as const;

export const INSTRUMENT_LABELS: Record<string, string> = {
  guitar: 'Guitar',
  bass: 'Bass',
  drums: 'Drums',
  vocals: 'Vocals',
  basic_keyboard: 'Keyboard',
  basic_strings: 'Strings',
  basic_percussions: 'Percussion',
  basic_electronic_instruments: 'Electronic',
};

// ─── Note types ───────────────────────────────────────────────────────
export type NoteType = 'normal' | 'hold' | 'bonus' | 'hazard';

export interface GameNote {
  id: string;
  type: NoteType;
  lane: number; // 0-based lane position
  spawnTime: number; // ms since game start
  fallSpeed: number; // px/s
  y: number; // current y position
  hitWindow: number; // ms tolerance for hit
  xpMultiplier: number;
  active: boolean;
  holdDuration?: number; // ms, for hold notes
}

// ─── Hit accuracy ─────────────────────────────────────────────────────
export type HitAccuracy = 'perfect' | 'good' | 'miss';

export interface HitResult {
  accuracy: HitAccuracy;
  noteId: string;
  points: number;
}

// ─── Difficulty scaling ───────────────────────────────────────────────
export interface DifficultyProfile {
  label: string;
  baseSpeed: number; // px/s
  speedIncrement: number; // per level
  spawnInterval: number; // ms between notes
  spawnIntervalDecrement: number; // per level (ms)
  hitWindowMs: number; // timing tolerance
  noteDensity: number; // notes per wave
  holdNoteChance: number; // 0-1
  bonusNoteChance: number; // 0-1
  hazardChance: number; // 0-1
}

export function getDifficultyFromSkill(skillLevel: number): DifficultyProfile {
  if (skillLevel <= 3) {
    return {
      label: 'Beginner',
      baseSpeed: 60,
      speedIncrement: 4,
      spawnInterval: 1800,
      spawnIntervalDecrement: 30,
      hitWindowMs: 250,
      noteDensity: 3,
      holdNoteChance: 0,
      bonusNoteChance: 0.05,
      hazardChance: 0.06,
    };
  }
  if (skillLevel <= 8) {
    return {
      label: 'Intermediate',
      baseSpeed: 80,
      speedIncrement: 6,
      spawnInterval: 1400,
      spawnIntervalDecrement: 40,
      hitWindowMs: 180,
      noteDensity: 4,
      holdNoteChance: 0.1,
      bonusNoteChance: 0.08,
      hazardChance: 0.08,
    };
  }
  if (skillLevel <= 14) {
    return {
      label: 'Advanced',
      baseSpeed: 110,
      speedIncrement: 8,
      spawnInterval: 1000,
      spawnIntervalDecrement: 30,
      hitWindowMs: 130,
      noteDensity: 5,
      holdNoteChance: 0.15,
      bonusNoteChance: 0.1,
      hazardChance: 0.1,
    };
  }
  return {
    label: 'Master',
    baseSpeed: 140,
    speedIncrement: 10,
    spawnInterval: 750,
    spawnIntervalDecrement: 20,
    hitWindowMs: 90,
    noteDensity: 6,
    holdNoteChance: 0.2,
    bonusNoteChance: 0.12,
    hazardChance: 0.12,
  };
}

// ─── Game state ───────────────────────────────────────────────────────
export interface GameState {
  phase: 'selection' | 'playing' | 'paused' | 'gameover' | 'results';
  level: number;
  score: number;
  combo: number;
  longestCombo: number;
  lives: number;
  maxLives: number;
  notesHit: number;
  notesMissed: number;
  perfectHits: number;
  goodHits: number;
  accuracy: number; // 0-100
  elapsedMs: number;
}

export const INITIAL_GAME_STATE: GameState = {
  phase: 'selection',
  level: 1,
  score: 0,
  combo: 0,
  longestCombo: 0,
  lives: 3,
  maxLives: 3,
  notesHit: 0,
  notesMissed: 0,
  perfectHits: 0,
  goodHits: 0,
  accuracy: 100,
  elapsedMs: 0,
};

// ─── XP calculation ───────────────────────────────────────────────────
export const DAILY_PRACTICE_XP_CAP = 200;
export const MAX_SESSIONS_BEFORE_DIMINISH = 3;

export interface XpRewardResult {
  baseXp: number;
  levelBonus: number;
  accuracyBonus: number;
  comboBonus: number;
  totalXp: number;
  diminishingApplied: boolean;
  dailyCapHit: boolean;
  actualXpAwarded: number;
}

export function calculateXpReward(
  levelReached: number,
  accuracyPct: number,
  longestCombo: number,
  sessionsToday: number,
  xpEarnedToday: number,
): XpRewardResult {
  const baseXp = 10;
  const levelBonus = levelReached * 5;
  const accuracyBonus = Math.round(accuracyPct * 0.5);
  const comboBonus = Math.round(longestCombo * 0.3);
  let totalXp = baseXp + levelBonus + accuracyBonus + comboBonus;

  // Diminishing returns after N sessions
  let diminishingApplied = false;
  if (sessionsToday >= MAX_SESSIONS_BEFORE_DIMINISH) {
    const factor = Math.max(0.2, 1 - (sessionsToday - MAX_SESSIONS_BEFORE_DIMINISH) * 0.25);
    totalXp = Math.round(totalXp * factor);
    diminishingApplied = true;
  }

  // Daily cap
  const remaining = Math.max(0, DAILY_PRACTICE_XP_CAP - xpEarnedToday);
  const actualXpAwarded = Math.min(totalXp, remaining);
  const dailyCapHit = actualXpAwarded < totalXp;

  return {
    baseXp,
    levelBonus,
    accuracyBonus,
    comboBonus,
    totalXp,
    diminishingApplied,
    dailyCapHit,
    actualXpAwarded,
  };
}

// ─── Default practice songs ──────────────────────────────────────────
export interface PracticeSong {
  id: string;
  title: string;
  genre: string;
  durationSeconds: number;
  bpm: number;
  isDefault: boolean;
  audioUrl?: string | null;
}

export const DEFAULT_PRACTICE_SONGS: PracticeSong[] = [
  { id: 'default-rock-basics', title: 'Rock Basics', genre: 'Rock', durationSeconds: 120, bpm: 120, isDefault: true },
  { id: 'default-blues-shuffle', title: 'Blues Shuffle', genre: 'Blues', durationSeconds: 90, bpm: 95, isDefault: true },
  { id: 'default-punk-rush', title: 'Punk Rush', genre: 'Punk', durationSeconds: 80, bpm: 160, isDefault: true },
  { id: 'default-ballad-flow', title: 'Ballad Flow', genre: 'Pop', durationSeconds: 150, bpm: 72, isDefault: true },
  { id: 'default-metal-storm', title: 'Metal Storm', genre: 'Metal', durationSeconds: 100, bpm: 180, isDefault: true },
  { id: 'default-funk-groove', title: 'Funk Groove', genre: 'Funk', durationSeconds: 110, bpm: 105, isDefault: true },
];

// ─── Lane config ──────────────────────────────────────────────────────
export const LANE_COUNT = 4;
export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 600;
export const HIT_ZONE_Y = CANVAS_HEIGHT - 80;
export const NOTE_RADIUS = 18;
