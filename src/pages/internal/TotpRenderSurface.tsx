import { useEffect, useState } from "react";
import { derivePlaybackState } from "@/features/gig-experience/viewer/engine/PlaybackController";
import {
  activeCue,
  archivedExperience,
  archivedPlayerModels,
  archivedReplay,
  lockedAudienceReaction,
  lockedPresenterKey,
  lockedShowVariant,
  totpPerformanceStartMs,
} from "@/features/top-of-the-pops/TotpArchivePlayer";
import { TotpBroadcastCanvas } from "@/features/top-of-the-pops/TotpBroadcastCanvas";
import { buildTotpCaptionCues } from "@/features/top-of-the-pops/broadcastCaptions";
import type { TotpBroadcastReplay } from "@/features/top-of-the-pops/api";
import type { TotpEpisodeManifest } from "@/features/top-of-the-pops/episodeManifest";
import type { TotpRenderItem, TotpRenderPlan } from "@/features/top-of-the-pops/renderSpec";
import { resolveTotpRenderFrame } from "@/features/top-of-the-pops/renderSurfaceClock";
import { resolveTotpPresenter } from "@/features/top-of-the-pops/presenters";

interface TotpRenderInput {
  manifest: TotpEpisodeManifest;
  plan: TotpRenderPlan;
  replays: TotpBroadcastReplay[];
}

declare global {
  interface Window {
    __TOTP_RENDER_INPUT__?: TotpRenderInput;
    __TOTP_RENDER_READY__?: boolean;
    __TOTP_RENDER_FATAL__?: string | null;
    __TOTP_RENDER_SEEK__?: (ms: number) => void;
  }
}

function sourcePositionFor(item: TotpRenderItem, localMs: number, replay: TotpBroadcastReplay): number {
  if (item.kind === "performance") return Math.min(replay.duration_ms - 1, totpPerformanceStartMs(replay) + localMs);
  if (item.kind === "presenter_link") {
    const presenter = replay.payload.cues.find((cue) => cue.type === "presenter");
    if (presenter) return presenter.offsetMs + Math.min(localMs, Math.max(0, presenter.durationMs - 1));
  }
  if (item.kind === "applause") {
    const audience = [...replay.payload.cues].reverse().find((cue) => cue.type === "audience");
    if (audience) return audience.offsetMs + Math.min(localMs, Math.max(0, audience.durationMs - 1));
  }
  return Math.min(replay.duration_ms - 1, localMs);
}

function ProgrammeCard({ kind, progress, episodeNumber }: { kind: "opening" | "credits"; progress: number; episodeNumber: number }) {
  const travel = Math.round((progress * 2 - 1) * 180);
  if (kind === "opening") {
    return <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-950 text-white" data-totp-render-opening>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(217,70,239,.34),transparent_38%),radial-gradient(circle_at_25%_65%,rgba(34,211,238,.22),transparent_34%)]" />
      <div className="absolute inset-y-0 left-1/2 w-40 bg-white/5" style={{ transform: `translateX(calc(-50% + ${travel}px)) rotate(18deg)` }} />
      <div className="relative text-center"><p className="text-sm font-black tracking-[0.42em] text-cyan-200">ROCKMUNDO TELEVISION</p><h1 className="mt-5 text-8xl font-black uppercase tracking-[-0.06em]">Top of the Pops</h1><p className="mt-5 text-xl font-bold tracking-[0.22em] text-fuchsia-200">EPISODE {episodeNumber}</p><div className="mx-auto mt-8 h-1 w-[36rem] max-w-[70vw] bg-white/10"><div className="h-full bg-white" style={{ width: `${Math.max(2, progress * 100)}%` }} /></div></div>
    </div>;
  }
  return <div className="relative h-full w-full overflow-hidden bg-black text-white" data-totp-render-credits>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_110%,rgba(217,70,239,.22),transparent_48%)]" />
    <div className="absolute left-1/2 w-[70%] -translate-x-1/2 text-center" style={{ top: `${85 - progress * 100}%` }}><p className="text-lg font-black tracking-[0.3em] text-cyan-200">TOP OF THE POPS</p><p className="mt-12 text-5xl font-black">Thanks for watching</p><p className="mt-8 text-xl text-white/75">Produced inside RockMundo · London</p><p className="mt-24 text-sm uppercase tracking-[0.24em] text-white/50">Episode {episodeNumber} · End of programme</p></div>
  </div>;
}

export default function TotpRenderSurface() {
  const input = window.__TOTP_RENDER_INPUT__;
  const [programmeMs, setProgrammeMs] = useState(0);

  useEffect(() => {
    document.documentElement.style.background = "#000";
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    window.__TOTP_RENDER_SEEK__ = (ms: number) => setProgrammeMs(Math.max(0, Math.floor(ms)));
    window.__TOTP_RENDER_READY__ = Boolean(input);
    return () => {
      delete window.__TOTP_RENDER_SEEK__;
      delete window.__TOTP_RENDER_READY__;
      delete window.__TOTP_RENDER_FATAL__;
    };
  }, [input]);

  if (!input) {
    window.__TOTP_RENDER_FATAL__ = "No render payload was injected by the worker.";
    return <div className="flex h-screen w-screen items-center justify-center bg-black text-white" data-totp-render-fatal>No render payload</div>;
  }

  const selection = resolveTotpRenderFrame(input.plan, programmeMs);
  const replay = selection.item.performance_id ? input.replays.find((candidate) => candidate.performance_id === selection.item.performance_id) ?? null : null;

  if (selection.item.kind === "opening_titles") {
    window.__TOTP_RENDER_FATAL__ = null;
    return <main className="h-screen w-screen bg-black" data-totp-render-frame={selection.programmeMs}><ProgrammeCard kind="opening" progress={selection.progress} episodeNumber={input.manifest.episode_number} /></main>;
  }
  if (selection.item.kind === "end_credits") {
    window.__TOTP_RENDER_FATAL__ = null;
    return <main className="h-screen w-screen bg-black" data-totp-render-frame={selection.programmeMs}><ProgrammeCard kind="credits" progress={selection.progress} episodeNumber={input.manifest.episode_number} /></main>;
  }
  if (!replay) {
    const detail = `Missing immutable broadcast replay for ${selection.item.performance_id ?? selection.item.label}`;
    window.__TOTP_RENDER_FATAL__ = detail;
    return <div className="flex h-screen w-screen items-center justify-center bg-black text-white" data-totp-render-fatal>{detail}</div>;
  }

  window.__TOTP_RENDER_FATAL__ = null;
  const renderedReplay = archivedReplay(replay);
  const experience = archivedExperience(replay);
  const playerModels = archivedPlayerModels(replay);
  const sourceMs = sourcePositionFor(selection.item, selection.localMs, replay);
  const playback = derivePlaybackState(renderedReplay, sourceMs, false);
  const cue = activeCue(replay.payload.cues, sourceMs);
  const presenterKey = lockedPresenterKey(replay);
  const captions = buildTotpCaptionCues(replay.payload.cues, { presenterName: resolveTotpPresenter(presenterKey).displayName });

  return <main className="h-screen w-screen overflow-hidden bg-black" data-totp-render-frame={selection.programmeMs} data-totp-render-item={selection.item.kind}>
    <TotpBroadcastCanvas replay={renderedReplay} experience={experience} playbackState={playback} cue={cue} audienceReaction={lockedAudienceReaction(replay)} presenterKey={presenterKey} showVariant={lockedShowVariant(replay)} playerModelsSnapshot={playerModels} captions={captions} showCaptions className="h-full w-full" performancePreference="quality" />
  </main>;
}
