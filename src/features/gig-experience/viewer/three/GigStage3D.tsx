import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveVenueProfile } from '@/features/gig-demo-3d/venueProfile';
import { ConcertScene } from '@/features/gig-demo-3d/ConcertScene';
import { DEFAULT_SETTINGS, type CameraShot, type DemoSettings } from '@/features/gig-demo-3d/config';
import { useGigPlayerModels } from '@/features/player-model/usePlayerModel';
import type { PlayerAppearance } from '@/features/player-model/appearance';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import type { GigViewerReplay } from '../../events/types';
import type { GigExperienceDTO } from '../../types';
import type { DerivedPlaybackState } from '../engine/PlaybackController';
import type { CrowdTuningOptions } from '../engine/CrowdTuning';
import type { GigViewerCameraMode } from '../engine/CameraDirector';
import type { PerformanceTier } from '../engine/ViewerDiagnostics';
import { buildStagePlan, concertFrame, concertOptions } from './presentation';

const EMPTY_APPEARANCES: Record<string, PlayerAppearance> = {};
const EMPTY_RICH_CLOTHING: Record<string, ResolvedEquippedClothing[]> = {};
const CAMERAS: Record<GigViewerCameraMode, CameraShot> = { venue_wide: 'front', stage_focus: 'guitar', auto: 'director', drums: 'drums', band_pov: 'stage' };

export default function GigStage3D({ replay, experience, playbackState, reducedMotion, cameraMode, tier, archetype, tuning, pyrotechnics, pyroIntensity }: {
  replay: GigViewerReplay; experience: GigExperienceDTO | null; playbackState: DerivedPlaybackState;
  reducedMotion: boolean; cameraMode: GigViewerCameraMode; tier: PerformanceTier; archetype: string;
  tuning: CrowdTuningOptions; pyrotechnics: boolean; pyroIntensity: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null), renderer = useRef<ConcertScene | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'), [message, setMessage] = useState(''), [attempt, setAttempt] = useState(0);
  const plan = useMemo(() => buildStagePlan(replay, experience), [replay, experience]);
  const playerModels = useGigPlayerModels(plan.entities.flatMap(p => p.profileId ? [p.profileId] : []));
  const options = useMemo(() => concertOptions(
    plan,
    playerModels.data?.appearances ?? EMPTY_APPEARANCES,
    replay,
    experience,
    archetype,
    playerModels.data?.richClothing ?? EMPTY_RICH_CLOTHING,
  ), [plan, playerModels.data, replay, experience, archetype]);
  // Structural updates rebuild once; playback, camera and accessibility controls
  // update the existing WebGL context instead of downloading the band again.
  const optionsKey = JSON.stringify(options);
  const venueProfile = resolveVenueProfile(options.venue);
  const frame = concertFrame(plan, replay, experience, playbackState, reducedMotion, tuning, options.venue);
  const settings: DemoSettings = { ...DEFAULT_SETTINGS, playing: playbackState.isPlaying, camera: CAMERAS[cameraMode], reducedMotion, quality: tier === 'high' ? 'high' : tier === 'low' ? 'low' : 'balanced', look: frame.look, energy: frame.energy, crowd: frame.crowd, haze: tier !== 'low' };
  const latest = useRef({ settings, frame, pyrotechnics, pyroIntensity, tuning }); latest.current = { settings, frame, pyrotechnics, pyroIntensity, tuning };
  const waiting = playerModels.isFetching && !playerModels.data && !playerModels.isError;

  useEffect(() => {
    if (!canvas.current || waiting) return;
    let alive = true;
    setStatus('loading'); setMessage('');
    try {
      const scene = new ConcertScene(canvas.current, latest.current.settings, () => {}, (state, error) => { if (alive) { setStatus(state); setMessage(error ?? ''); } }, options);
      renderer.current = scene; scene.setFrame(latest.current.frame); scene.setEffects(latest.current.pyrotechnics, latest.current.pyroIntensity); scene.setCrowdTuning(latest.current.tuning);
    } catch { setStatus('error'); setMessage('3D graphics could not start on this device. Try again or use the timeline and playback controls below.'); }
    return () => { alive = false; renderer.current?.destroy(); renderer.current = null; };
    // optionsKey compares scene content, not query/refetch object identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, attempt, waiting]);

  useEffect(() => {
    renderer.current?.setSettings(settings); renderer.current?.setFrame(frame); renderer.current?.setEffects(pyrotechnics, pyroIntensity); renderer.current?.setCrowdTuning(tuning);
  });

  return <div className="relative h-full min-h-0 w-full bg-slate-950" data-renderer="three" data-renderer-status={status}>
    <canvas ref={canvas} className="block h-full min-h-0 w-full" role="img" aria-label={`3D performance at ${experience?.gig.venue.name ?? 'the venue'}. ${plan.entities.map(p => `${p.displayName}, ${p.roleLabel}`).join('; ')}. Use the timeline for commentary.`} />
    <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3 text-xs text-white/80" aria-hidden="true"><span className="rounded bg-black/40 px-3 py-2 backdrop-blur">{experience?.gig.venue.name ?? 'Live performance'}</span><span className="rounded bg-black/40 px-3 py-2">{venueProfile.label}{options.venue.capacity && options.venue.capacity > 0 ? ` · ${options.venue.capacity.toLocaleString()} capacity` : ''}</span></div>
    {(status !== 'ready' || waiting) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-8 text-center text-slate-100" role={status === 'error' ? 'alert' : 'status'}>
      <strong className="text-lg">{status === 'error' ? 'The stage could not load' : 'Setting the stage'}</strong>
      <p className="max-w-md text-sm text-slate-300">{status === 'error' ? message : 'Loading the performers, outfits, lighting and venue materials…'}</p>
      {status === 'error' && <button className="rounded-lg bg-cyan-300 px-5 py-2 font-semibold text-slate-950" onClick={() => setAttempt(n => n + 1)}>Retry 3D stage</button>}
    </div>}
    {playerModels.isError && <div role="status" className="absolute bottom-3 left-3 right-3 rounded bg-slate-950/90 p-2 text-xs text-slate-200">Saved outfits could not load; starter models are shown. <button className="underline" onClick={() => void playerModels.refetch()}>Reload outfits</button></div>}
    {status === 'ready' && !playerModels.isError && <Link to="/avatar-designer" className="absolute bottom-3 right-3 rounded bg-black/60 px-3 py-2 text-xs text-white hover:bg-black/80">Edit my stage model</Link>}
  </div>;
}