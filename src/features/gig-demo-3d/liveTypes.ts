import type { PlayerAppearance } from '@/features/player-model/appearance';

export type StageRole = 'vocals' | 'guitar' | 'bass' | 'drums' | 'keyboard' | 'dj' | 'strings' | 'brass' | 'percussion' | 'other' | 'fan';
export interface ConcertPerformer {
  id: string;
  displayName: string;
  role: StageRole;
  position: [number, number, number];
  appearance: PlayerAppearance;
  phase: number;
}
export interface ConcertVenue { name: string; bandName: string; archetype: string; seed: number; type?: string | null; capacity?: number | null; id?: string | null; }
export interface ConcertFrame {
  positionMs: number;
  energy: number;
  crowd: number;
  occupancy?: number;
  crowdReaction: string;
  performing: boolean;
  look: 'electric' | 'amber' | 'encore';
  lightLevel: number;
  focusId: string | null;
  effect: { type: string; intensity: number; progress: number } | null;
  performers: { id: string; position: [number, number, number]; visible: boolean; walking: boolean; action: string | null; actionProgress: number }[];
}
export interface ConcertOptions {
  performers: ConcertPerformer[];
  venue: ConcertVenue;
  /** When true, the replay clock is the only source of scene time. */
  externalClock: boolean;
}
