/** Local art-direction fixture. Nothing here is a live gig or a game calculation. */
export type CameraShot = 'director' | 'front' | 'guitar' | 'drums' | 'stage';
export type LightingLook = 'electric' | 'amber' | 'encore';
export type DemoQuality = 'balanced' | 'high';
export interface DemoSettings {
  playing: boolean;
  camera: CameraShot;
  look: LightingLook;
  energy: number;
  crowd: number;
  haze: boolean;
  reducedMotion: boolean;
  quality: DemoQuality;
}
export interface DemoStats { fps: number; drawCalls: number; triangles: number; seconds: number }
export const DEFAULT_SETTINGS: DemoSettings = {
  playing: true, camera: 'director', look: 'electric', energy: 0.72,
  crowd: 0.8, haze: true, reducedMotion: false, quality: 'balanced',
};
export const LOOKS = {
  electric: { name: 'Electric blue', key: '#ffc896', left: '#13b9e7', right: '#ed3776', ambient: '#233b60' },
  amber: { name: 'After hours', key: '#ffd5a1', left: '#ed7233', right: '#ffb852', ambient: '#483148' },
  encore: { name: 'The encore', key: '#e4eaff', left: '#826eff', right: '#35dcc8', ambient: '#283451' },
} as const;
export const SHOTS: { id: CameraShot; label: string }[] = [
  { id: 'director', label: 'Director' }, { id: 'front', label: 'Front row' },
  { id: 'guitar', label: 'Guitar side' }, { id: 'drums', label: 'Drum cam' },
  { id: 'stage', label: 'On stage' },
];
export const DEMO_DURATION = 96;
export function songSection(seconds: number) {
  const position = Math.max(0, seconds) % DEMO_DURATION;
  if (position < 16) return 'Opening riff';
  if (position < 38) return 'Verse';
  if (position < 60) return 'Chorus';
  if (position < 78) return 'Guitar solo';
  return 'Final chorus';
}
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
