import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveVenueProfile } from '@/features/gig-demo-3d/venueProfile';
import { ConcertScene } from '@/features/gig-demo-3d/ConcertScene';
import { DEFAULT_SETTINGS, type CameraShot, type DemoSettings } from '@/features/gig-demo-3d/config';
import { useGigPlayerModels, type GigPlayerModelsData } from '@/features/player-model/usePlayerModel';
import type { PlayerAppearance } from '@/features/player-model/appearance';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import type { TotpCameraShot, TotpStageKey } from '@/features/top-of-the-pops/broadcastProfile';
import { resolveTotpPresenter, totpVariantLabel } from '@/features/top-of-the-pops/presenters';
import { totpAudienceChoreography } from '@/features/top-of-the-pops/studioAudience';
import type { GigViewerReplay } from '../../events/types';
import type { GigExperienceDTO } from '../../types';
import type { DerivedPlaybackState } from '../engine/PlaybackController';
import type { CrowdTuningOptions } from '../engine/CrowdTuning';
import type { GigViewerCameraMode } from '../engine/CameraDirector';
import type { PerformanceTier } from '../engine/ViewerDiagnostics';
import { buildStagePlan, concertFrame, concertOptions, type ConcertPresentationMode } from './presentation';

const EMPTY_APPEARANCES: Record<string, PlayerAppearance> = {};
const EMPTY_RICH_CLOTHING: Record<string, ResolvedEquippedClothing[]> = {};
const CAMERAS: Record<GigViewerCameraMode, CameraShot> = { venue_wide: 'front', stage_focus: 'guitar', auto: 'director', drums: 'drums', band_pov: 'stage' };
const TOTP_CAMERAS: Record<TotpCameraShot, CameraShot> = {
  presenter_wide: 'tv_presenter_wide', presenter_close: 'tv_presenter_close', crane_sweep: 'tv_crane', studio_master: 'front',
  lead_close: 'tv_lead_close', lead_medium: 'tv_lead_medium', instrument_close: 'tv_instrument_left', drummer_close: 'tv_drummer_close', side_tracking: 'tv_tracking',
  low_angle: 'tv_low_angle', audience_reverse: 'tv_audience_reverse', audience_dance: 'tv_audience_reverse', overhead: 'tv_overhead',
  push_in: 'tv_push_in', pull_back: 'front', finale_wide: 'tv_crane',
};

export default function GigStage3D({ replay, experience, playbackState, reducedMotion, cameraMode, tier, archetype, tuning, pyrotechnics, pyroIntensity, presentationMode = 'gig', totpCameraShot, totpStage = 'main_stage', totpPresenterKey = 'alex_rayne', totpShowVariant = 'regular', totpAudienceReaction = 0, totpCueType = 'performance', totpMonitorPrimary = null, totpMonitorSecondary = null, playerModelsSnapshot = null }: {
  replay: GigViewerReplay; experience: GigExperienceDTO | null; playbackState: DerivedPlaybackState;
  reducedMotion: boolean; cameraMode: GigViewerCameraMode; tier: PerformanceTier; archetype: string;
  tuning: CrowdTuningOptions; pyrotechnics: boolean; pyroIntensity: number;
  presentationMode?: ConcertPresentationMode; totpCameraShot?: TotpCameraShot | null; totpStage?: TotpStageKey;
  totpPresenterKey?: string | null; totpShowVariant?: string | null; totpAudienceReaction?: number | null; totpCueType?: 'presenter' | 'graphic' | 'performance' | 'audience'; totpMonitorPrimary?: string | null; totpMonitorSecondary?: string | null;
  /** Frozen render-only performer models, used by historical broadcasts instead of current player cosmetics. */
  playerModelsSnapshot?: GigPlayerModelsData | null;
}) {
  const canvas = useRef<HTMLCanvasElement>(null), renderer = useRef<ConcertScene | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'), [message, setMessage] = useState(''), [attempt, setAttempt] = useState(0);
  const plan = useMemo(() => buildStagePlan(replay, experience), [replay, experience]);
  const livePlayerModels = useGigPlayerModels(playerModelsSnapshot ? [] : plan.entities.flatMap(p => p.profileId ? [p.profileId] : []));
  const resolvedPlayerModels = playerModelsSnapshot ?? livePlayerModels.data ?? null;
  const options = useMemo(() => {
    const base = concertOptions(
      plan,
      resolvedPlayerModels?.appearances ?? EMPTY_APPEARANCES,
      replay,
      experience,
      archetype,
      resolvedPlayerModels?.richClothing ?? EMPTY_RICH_CLOTHING,
      presentationMode,
      totpStage,
    );
    if (presentationMode !== 'totp') return base;
    return {
      ...base,
      venue: { ...base.venue, presenterKey: totpPresenterKey ?? 'alex_rayne', showVariant: totpShowVariant ?? 'regular' },
      television: { presenterKey: totpPresenterKey ?? 'alex_rayne', showVariant: totpShowVariant ?? 'regular', stageKey: totpStage },
    };
  }, [plan, resolvedPlayerModels, replay, experience, archetype, presentationMode, totpStage, totpPresenterKey, totpShowVariant]);
  const optionsKey = JSON.stringify(options);
  const venueProfile = resolveVenueProfile(options.venue);
  const baseFrame = concertFrame(plan, replay, experience, playbackState, reducedMotion, tuning, options.venue, presentationMode, totpStage);
  const frame = presentationMode === 'totp'
    ? {
        ...baseFrame,
        crowd: Math.max(.9, baseFrame.crowd),
        crowdReaction: reducedMotion
          ? 'still'
          : totpCueType === 'audience'
            ? 'tv_roaring'
            : totpCueType === 'presenter'
              ? 'tv_warm'
              : totpAudienceChoreography(Number(totpAudienceReaction ?? 0)),
      }
    : baseFrame;
  const resolvedCamera: CameraShot = presentationMode === 'totp' && totpCameraShot ? TOTP_CAMERAS[totpCameraShot] : CAMERAS[cameraMode];
  const totpEnergy = presentationMode === 'totp'
    ? Math.min(1, frame.energy + (totpCueType === 'audience' ? .14 : totpCueType === 'performance' ? .07 : 0))
    : frame.energy;
  const totpLook = presentationMode !== 'totp'
    ? frame.look
    : totpStage === 'rock_stage'
      ? 'amber'
      : totpStage === 'stage_b'
        ? 'encore'
        : totpStage === 'studio_floor'
          ? 'encore'
          : 'electric';
  const settings: DemoSettings = { ...DEFAULT_SETTINGS, playing: playbackState.isPlaying, camera: resolvedCamera, reducedMotion, quality: tier === 'high' ? 'high' : tier === 'low' ? 'low' : 'balanced', look: totpLook, energy: totpEnergy, crowd: frame.crowd, haze: tier !== 'low' };
  const latest = useRef({ settings, frame, pyrotechnics, pyroIntensity, tuning }); latest.current = { settings, frame, pyrotechnics, pyroIntensity, tuning };
  const waiting = !playerModelsSnapshot && livePlayerModels.isFetching && !livePlayerModels.data && !livePlayerModels.isError;

  useEffect(() => {
    if (!canvas.current || waiting) return;
    let alive = true;
    setStatus('loading'); setMessage('');
    try {
      const scene = new ConcertScene(canvas.current, latest.current.settings, () => {}, (state, error) => { if (alive) { setStatus(state); setMessage(error ?? ''); } }, options);
      renderer.current = scene; scene.setFrame(latest.current.frame); scene.setEffects(latest.current.pyrotechnics, latest.current.pyroIntensity); scene.setCrowdTuning(latest.current.tuning);
    } catch { setStatus('error'); setMessage('3D graphics could not start on this device. Try again or use the timeline and playback controls below.'); }
    return () => { alive = false; renderer.current?.destroy(); renderer.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsKey, attempt, waiting]);

  useEffect(() => { renderer.current?.setSettings(settings); renderer.current?.setFrame(frame); renderer.current?.setEffects(pyrotechnics, pyroIntensity); renderer.current?.setCrowdTuning(tuning); });

  const isTotp = presentationMode === 'totp';
  const presenter = resolveTotpPresenter(totpPresenterKey);
  const variantLabel = totpVariantLabel(totpShowVariant);
  const venueLabel = isTotp ? 'RockMundo Television Centre · London' : experience?.gig.venue.name ?? 'Live performance';
  const ariaLabel = isTotp
    ? `Top of the Pops television performance presented by ${presenter.displayName} on ${totpStage.replaceAll('_', ' ')}. ${plan.entities.map(p => `${p.displayName}, ${p.roleLabel}`).join('; ')}.`
    : `3D performance at ${experience?.gig.venue.name ?? 'the venue'}. ${plan.entities.map(p => `${p.displayName}, ${p.roleLabel}`).join('; ')}. Use the timeline for commentary.`;

  return <div className="relative h-full min-h-0 w-full bg-slate-950" data-renderer="three" data-renderer-status={status} data-presentation-mode={presentationMode} data-totp-camera-shot={totpCameraShot ?? undefined} data-totp-stage={isTotp ? totpStage : undefined} data-totp-presenter={isTotp ? presenter.key : undefined} data-totp-show-variant={isTotp ? totpShowVariant ?? 'regular' : undefined} data-totp-audience-choreography={isTotp ? frame.crowdReaction : undefined} data-player-model-source={playerModelsSnapshot ? 'snapshot' : 'live'}>
    <canvas ref={canvas} className="block h-full min-h-0 w-full" role="img" aria-label={ariaLabel} />
    <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-3 text-xs text-white/80" aria-hidden="true">
      <span className="rounded bg-black/40 px-3 py-2 backdrop-blur">{venueLabel}</span>
      <span className="rounded bg-black/40 px-3 py-2">{isTotp ? `TOP OF THE POPS · ${variantLabel ? `${variantLabel.toUpperCase()} · ` : ''}${totpStage.replaceAll('_', ' ').toUpperCase()}` : `${venueProfile.label}${options.venue.capacity && options.venue.capacity > 0 ? ` · ${options.venue.capacity.toLocaleString()} capacity` : ''}`}</span>
    </div>
    {(status !== 'ready' || waiting) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-8 text-center text-slate-100" role={status === 'error' ? 'alert' : 'status'}>
      <strong className="text-lg">{status === 'error' ? 'The stage could not load' : isTotp ? `Preparing ${presenter.displayName}'s television studio` : 'Setting the stage'}</strong>
      <p className="max-w-md text-sm text-slate-300">{status === 'error' ? message : isTotp ? 'Loading the performers, outfits, studio lights, cameras and audience…' : 'Loading the performers, outfits, lighting and venue materials…'}</p>
      {status === 'error' && <button className="rounded-lg bg-cyan-300 px-5 py-2 font-semibold text-slate-950" onClick={() => setAttempt(n => n + 1)}>Retry 3D stage</button>}
    </div>}
    {!playerModelsSnapshot && livePlayerModels.isError && <div role="status" className="absolute bottom-3 left-3 right-3 rounded bg-slate-950/90 p-2 text-xs text-slate-200">Saved outfits could not load; starter models are shown. <button className="underline" onClick={() => void livePlayerModels.refetch()}>Reload outfits</button></div>}
    {status === 'ready' && !livePlayerModels.isError && !isTotp && <Link to="/avatar-designer" className="absolute bottom-3 right-3 rounded bg-black/60 px-3 py-2 text-xs text-white hover:bg-black/80">Edit my stage model</Link>}
  </div>;
}