import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { derivePlaybackState } from "@/features/gig-experience/viewer/engine/PlaybackController";
import {
  activeTotpCue,
  archivedExperience,
  archivedPlayerModels,
  archivedReplay,
  lockedAudienceReaction,
  lockedPresenterKey,
  lockedShowVariant,
  totpPerformanceStartMs,
} from "@/features/top-of-the-pops/TotpArchivePlayer";
import { TotpBroadcastCanvas } from "@/features/top-of-the-pops/TotpBroadcastCanvas";
import type { TotpBroadcastReplay } from "@/features/top-of-the-pops/api";
import type { TotpBroadcastCue } from "@/features/top-of-the-pops/broadcastTimeline";
import type { TotpEpisodeManifest } from "@/features/top-of-the-pops/episodeManifest";
import type { TotpRenderItem, TotpRenderPlan } from "@/features/top-of-the-pops/renderSpec";

export interface TotpOfflineRenderPayload {
  manifest: TotpEpisodeManifest;
  plan: TotpRenderPlan;
  replays: TotpBroadcastReplay[];
}

declare global {
  interface Window {
    __TOTP_RENDER_PAYLOAD__?: TotpOfflineRenderPayload;
    __TOTP_RENDER_CLOCK__?: {
      setTime: (timeMs: number) => Promise<void>;
      getTime: () => number;
      frameReady: () => boolean;
    };
  }
}

function itemAt(plan: TotpRenderPlan, timeMs: number): TotpRenderItem {
  return plan.items.find(
    (item) => timeMs >= item.start_ms && timeMs < item.start_ms + item.duration_ms,
  ) ?? plan.items.at(-1)!;
}

function openingFrame(manifest: TotpEpisodeManifest, progress: number) {
  const episode = String(manifest.episode_number).padStart(3, "0");
  const scale = 0.96 + progress * 0.04;
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(34,211,238,.24),transparent_32%),radial-gradient(circle_at_68%_62%,rgba(217,70,239,.30),transparent_35%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_3px,rgba(255,255,255,.38)_4px)]" />
      <div className="relative text-center" style={{ transform: `scale(${scale})` }}>
        <p className="text-2xl font-black uppercase tracking-[0.5em] text-cyan-200">RockMundo Television</p>
        <h1 className="mt-7 text-8xl font-black uppercase tracking-[-0.04em]">Top of the Pops</h1>
        <div className="mx-auto mt-7 h-1 w-72 bg-gradient-to-r from-cyan-300 via-white to-fuchsia-400" />
        <p className="mt-6 text-xl font-bold uppercase tracking-[0.28em] text-white/75">
          Episode {episode} · London
        </p>
      </div>
    </div>
  );
}

function creditsFrame(payload: TotpOfflineRenderPayload, progress: number) {
  const presenter = payload.replays[0]?.payload.presenterDisplayName ?? payload.manifest.presenter_key;
  const acts = payload.manifest.segments.map((segment) => `${segment.band_name} — "${segment.song_title}"`);
  const lines = [
    `Presented by ${presenter}`,
    "Tonight's line-up",
    ...acts,
    "Studio audience · RockMundo Television Centre, London",
    "Chart data · UK Streaming and Digital Sales",
    "A RockMundo Television production",
  ];
  const travel = 120 - progress * 180;
  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(217,70,239,.22),transparent_55%)]" />
      <p className="absolute inset-x-0 top-12 text-center text-sm font-black uppercase tracking-[0.35em] text-cyan-200">
        Top of the Pops
      </p>
      <div
        className="absolute inset-x-0 flex flex-col items-center gap-6 px-20 text-center"
        style={{ top: `${travel}%` }}
      >
        {lines.map((line, index) => (
          <p
            key={`${line}-${index}`}
            className={index === 0 || line === "Tonight's line-up"
              ? "text-2xl font-black uppercase tracking-[0.18em] text-cyan-200"
              : "text-xl font-semibold text-white/85"}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function cueForItem(
  payload: TotpOfflineRenderPayload,
  item: TotpRenderItem,
  source: TotpBroadcastReplay,
  elapsedMs: number,
): { cue: TotpBroadcastCue | null; sourcePositionMs: number } {
  const segment = payload.manifest.segments.find((entry) => entry.performance_id === item.performance_id);
  const stage = source.stage_key as TotpBroadcastCue["stage"];

  if (item.kind === "presenter_link") {
    return {
      sourcePositionMs: Math.min(elapsedMs, Math.max(0, totpPerformanceStartMs(source) - 1)),
      cue: {
        id: `offline-presenter-${item.index}`,
        type: "presenter",
        offsetMs: 0,
        durationMs: item.duration_ms,
        cameraShot: "presenter_wide",
        stage,
        presenterText: segment?.presenter_intro ?? source.payload.cues.find((entry) => entry.type === "presenter")?.presenterText,
      },
    };
  }

  const performanceStart = totpPerformanceStartMs(source);
  if (item.kind === "performance") {
    const sourcePositionMs = performanceStart + Math.min(elapsedMs, Math.max(0, item.duration_ms - 1));
    return { sourcePositionMs, cue: activeTotpCue(source.payload.cues, sourcePositionMs) };
  }

  const sourcePositionMs = performanceStart + source.payload.performanceDurationMs + Math.min(elapsedMs, Math.max(0, item.duration_ms - 1));
  return {
    sourcePositionMs,
    cue: activeTotpCue(source.payload.cues, sourcePositionMs) ?? {
      id: `offline-applause-${item.index}`,
      type: "audience",
      offsetMs: sourcePositionMs,
      durationMs: item.duration_ms,
      cameraShot: "finale_wide",
      stage,
    },
  };
}

export default function TotpRenderFrame() {
  const payload = window.__TOTP_RENDER_PAYLOAD__;
  const [timeMs, setTimeMs] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!payload) return;
    let live = true;
    window.__TOTP_RENDER_CLOCK__ = {
      setTime: async (nextMs: number) => {
        const clamped = Math.max(0, Math.min(payload.plan.total_duration_ms - 1, Math.round(nextMs)));
        flushSync(() => setTimeMs(clamped));
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      },
      getTime: () => timeMs,
      frameReady: () => ready,
    };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (live) setReady(true);
    }));
    return () => {
      live = false;
      delete window.__TOTP_RENDER_CLOCK__;
    };
  }, [payload, ready, timeMs]);

  const replaysByPerformance = useMemo(
    () => new Map((payload?.replays ?? []).map((replay) => [replay.performance_id, replay])),
    [payload],
  );

  if (!payload) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-black text-white" data-totp-offline-render-error>
        Missing offline render payload.
      </main>
    );
  }

  const item = itemAt(payload.plan, timeMs);
  const elapsedMs = timeMs - item.start_ms;
  const progress = Math.max(0, Math.min(1, elapsedMs / Math.max(1, item.duration_ms)));

  let picture: React.ReactNode;
  if (item.kind === "opening_titles") {
    picture = openingFrame(payload.manifest, progress);
  } else if (item.kind === "end_credits") {
    picture = creditsFrame(payload, progress);
  } else {
    const source = item.performance_id ? replaysByPerformance.get(item.performance_id) ?? null : null;
    if (!source) {
      picture = (
        <div className="flex h-full w-full items-center justify-center bg-slate-950 text-2xl font-black text-white">
          Programme picture unavailable
        </div>
      );
    } else {
      const replay = archivedReplay(source);
      const experience = archivedExperience(source);
      const models = archivedPlayerModels(source);
      const frame = cueForItem(payload, item, source, elapsedMs);
      const playbackState = derivePlaybackState(replay, frame.sourcePositionMs, false);
      picture = (
        <TotpBroadcastCanvas
          replay={replay}
          experience={experience}
          playbackState={playbackState}
          cue={frame.cue}
          audienceReaction={lockedAudienceReaction(source)}
          presenterKey={lockedPresenterKey(source)}
          showVariant={lockedShowVariant(source)}
          playerModelsSnapshot={models}
          captions={[]}
          showCaptions={false}
          className="h-full w-full"
        />
      );
    }
  }

  return (
    <main
      className="h-[1080px] w-[1920px] overflow-hidden bg-black"
      data-totp-offline-render-ready={ready ? "true" : "false"}
      data-totp-render-time={timeMs}
      data-totp-render-item={item.kind}
    >
      <style>{`
        html, body, #root { width: 1920px !important; height: 1080px !important; margin: 0 !important; overflow: hidden !important; background: black !important; }
        *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
      `}</style>
      {picture}
    </main>
  );
}
