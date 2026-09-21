import { useMemo } from "react";
import { derivePlaybackState } from "@/features/gig-experience/viewer/engine/PlaybackController";
import {
  activeTotpCue,
  archivedExperience,
  archivedPlayerModels,
  archivedReplay,
  totpPerformanceStartMs,
} from "@/features/top-of-the-pops/TotpArchivePlayer";
import { TotpBroadcastCanvas } from "@/features/top-of-the-pops/TotpBroadcastCanvas";
import { buildTotpCaptionCues } from "@/features/top-of-the-pops/broadcastCaptions";
import { resolveTotpPresenter } from "@/features/top-of-the-pops/presenters";
import type { TotpBroadcastReplay } from "@/features/top-of-the-pops/api";
import type { TotpRenderPlan, TotpRenderItem } from "@/features/top-of-the-pops/renderSpec";

export interface TotpOfflineRenderPayload {
  plan: TotpRenderPlan;
  replays: TotpBroadcastReplay[];
}

export interface TotpOfflineRenderFrame {
  itemIndex: number;
  localMs: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function OpeningTitles({ localMs, durationMs }: { localMs: number; durationMs: number }) {
  const progress = clamp(localMs / Math.max(1, durationMs), 0, 1);
  const scale = 0.9 + Math.sin(progress * Math.PI) * 0.1;
  const flareX = 10 + progress * 80;
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black text-white" data-totp-offline-opening>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_24%,rgba(217,70,239,.38),transparent_30%),radial-gradient(circle_at_76%_68%,rgba(34,211,238,.30),transparent_32%),linear-gradient(135deg,#05050a,#111827_55%,#07111d)]" />
      <div className="absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(108deg,transparent_0,transparent_52px,rgba(255,255,255,.08)_53px,transparent_54px)]" />
      <div className="absolute top-[18%] h-[2px] w-80 bg-white/80 shadow-[0_0_30px_rgba(255,255,255,.8)]" style={{ left: `${flareX}%` }} />
      <div className="relative text-center" style={{ transform: `scale(${scale})` }}>
        <div className="text-2xl font-black uppercase tracking-[0.48em] text-cyan-200">RockMundo Television</div>
        <div className="mt-8 text-[126px] font-black uppercase leading-[.88] tracking-[-0.06em]">Top of<br />the Pops</div>
        <div className="mx-auto mt-10 h-2 w-[520px] bg-gradient-to-r from-fuchsia-500 via-amber-300 to-cyan-400" />
        <div className="mt-7 text-xl font-bold uppercase tracking-[0.38em] text-white/75">Live from London</div>
      </div>
    </div>
  );
}

function EndCredits({ replays, localMs, durationMs }: { replays: TotpBroadcastReplay[]; localMs: number; durationMs: number }) {
  const presenter = resolveTotpPresenter(String(replays[0]?.payload.presenterKey ?? "alex_rayne")).displayName;
  const lines = [
    `Presented by ${presenter}`,
    "Tonight's line-up",
    ...replays.map((row) => `${row.payload.band.name} — “${row.payload.song.title}”`),
    "Studio audience · RockMundo Television Centre, London",
    "Chart data · UK Streaming and Digital Sales",
    "A RockMundo Television production",
  ];
  const progress = clamp(localMs / Math.max(1, durationMs), 0, 1);
  const translate = 92 - progress * 184;
  return (
    <div className="relative h-full w-full overflow-hidden bg-black text-white" data-totp-offline-credits>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(217,70,239,.20),transparent_58%)]" />
      <div className="absolute inset-x-0 top-12 text-center text-xl font-black tracking-[0.42em] text-cyan-200">TOP OF THE POPS</div>
      <div className="absolute inset-x-0 top-32 flex flex-col items-center gap-7 px-20 text-center" style={{ transform: `translateY(${translate}vh)` }}>
        {lines.map((line, index) => (
          <p key={`${line}-${index}`} className={index === 0 || line === "Tonight's line-up" ? "text-3xl font-black uppercase tracking-[0.16em] text-cyan-200" : "text-2xl font-semibold text-white/90"}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function ProgrammeContinuityFrame({ item, localMs }: { item: TotpRenderItem; localMs: number }) {
  const progress = clamp(localMs / Math.max(1, item.duration_ms), 0, 1);
  const kind = item.continuity_kind ?? "between";
  const eyebrow = kind === "opening" ? "Tonight on Top of the Pops" : kind === "closing" ? "What a show" : "Back in the studio";
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-950 px-28 text-white" data-totp-offline-continuity={kind}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,.26),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,.22),transparent_32%)]" />
      <div className="relative max-w-6xl text-center" style={{ opacity: Math.min(1, progress * 4) }}>
        <div className="text-xl font-black uppercase tracking-[0.35em] text-fuchsia-200">{eyebrow}</div>
        <div className="mx-auto mt-7 h-1.5 w-72 bg-gradient-to-r from-fuchsia-500 via-amber-300 to-cyan-400" />
        <p className="mt-10 text-5xl font-black leading-tight tracking-tight">{item.continuity_text ?? "Top of the Pops"}</p>
        <div className="mt-10 text-sm font-bold uppercase tracking-[0.28em] text-white/50">RockMundo Television Centre · London</div>
      </div>
    </div>
  );
}

function StageTransitionFrame({ item, localMs, replays }: { item: TotpRenderItem; localMs: number; replays: TotpBroadcastReplay[] }) {
  const progress = clamp(localMs / Math.max(1, item.duration_ms), 0, 1);
  const from = replays.find((row) => row.performance_id === item.from_performance_id) ?? null;
  const to = replays.find((row) => row.performance_id === item.to_performance_id) ?? null;
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black text-white" data-totp-offline-stage-transition>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(34,211,238,.22),transparent_35%),radial-gradient(circle_at_80%_50%,rgba(244,114,182,.22),transparent_35%)]" />
      <div className="absolute inset-y-0 left-[-35%] w-[42%] -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-cyan-200/20" style={{ transform: `translateX(${progress * 410}%) skewX(-12deg)` }} />
      <div className="relative text-center">
        <div className="text-xl font-black uppercase tracking-[0.32em] text-cyan-200">Across the studio</div>
        <div className="mt-5 text-7xl font-black tracking-tight">TOP OF THE POPS</div>
        <div className="mt-7 text-3xl font-semibold">{from?.payload.band.name ?? "Previous act"} → {to?.payload.band.name ?? "Next act"}</div>
        <div className="mt-3 text-lg uppercase tracking-[0.2em] text-white/55">{from?.payload.stage?.replaceAll("_", " ") ?? "stage"} → {to?.payload.stage?.replaceAll("_", " ") ?? "stage"}</div>
      </div>
    </div>
  );
}

function ChartRundownFrame({ item }: { item: TotpRenderItem }) {
  const page = item.chart_page;
  if (!page) return <div className="flex h-full w-full items-center justify-center bg-slate-950 text-4xl font-black text-white">CHART DATA UNAVAILABLE</div>;
  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 px-24 py-20 text-white" data-totp-offline-chart={page.chartType}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(217,70,239,.22),transparent_30%)]" />
      <div className="relative">
        <div className="text-lg font-black uppercase tracking-[0.3em] text-cyan-200">Top of the Pops chart rundown</div>
        <div className="mt-3 text-6xl font-black tracking-tight">{page.chartLabel}</div>
        <div className="mt-2 text-xl text-white/60">Positions {page.rangeLabel}</div>
        <div className="mt-10 grid gap-3">
          {page.entries.map((entry) => (
            <div key={`${page.chartType}:${entry.rank}:${entry.song_id ?? entry.song_title}`} className="grid grid-cols-[110px_1fr_210px] items-center rounded-xl border border-white/10 bg-white/[.06] px-6 py-4">
              <div className={`text-5xl font-black tabular-nums ${entry.rank === 1 ? "text-amber-200" : "text-white"}`}>#{entry.rank}</div>
              <div className="min-w-0">
                <div className="truncate text-3xl font-bold">{entry.artist_name}</div>
                <div className="truncate text-xl text-white/55">{entry.song_title}</div>
              </div>
              <div className="text-right text-lg text-white/55">{Number(entry.weekly_plays ?? 0).toLocaleString("en-GB")} weekly</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function replayForItem(item: TotpRenderItem, replays: TotpBroadcastReplay[]) {
  return replays.find((row) => row.performance_id === item.performance_id) ?? null;
}

function BroadcastReplayItem({ item, localMs, source }: { item: TotpRenderItem; localMs: number; source: TotpBroadcastReplay }) {
  const replay = useMemo(() => archivedReplay(source), [source]);
  const experience = useMemo(() => archivedExperience(source), [source]);
  const models = useMemo(() => archivedPlayerModels(source), [source]);
  const presenter = resolveTotpPresenter(String(source.payload.presenterKey ?? source.presenter_key ?? "alex_rayne"));
  const captions = useMemo(() => buildTotpCaptionCues(source.payload.cues, { presenterName: presenter.displayName }), [source.payload.cues, presenter.displayName]);
  const performanceStart = totpPerformanceStartMs(source);
  const presenterCue = source.payload.cues.find((cue) => cue.type === "presenter") ?? source.payload.cues[0] ?? null;
  const applauseCue = [...source.payload.cues].reverse().find((cue) => cue.type === "audience") ?? null;

  let positionMs = performanceStart;
  let cue = null as ReturnType<typeof activeTotpCue>;
  if (item.kind === "presenter_link") {
    cue = presenterCue;
    positionMs = presenterCue
      ? clamp(presenterCue.offsetMs + localMs, 0, Math.max(0, source.payload.totalDurationMs - 1))
      : clamp(localMs, 0, Math.max(0, source.payload.totalDurationMs - 1));
  } else if (item.kind === "applause") {
    cue = applauseCue;
    positionMs = applauseCue
      ? clamp(applauseCue.offsetMs + localMs, 0, Math.max(0, source.payload.totalDurationMs - 1))
      : clamp(performanceStart + source.payload.performanceDurationMs + localMs, 0, Math.max(0, source.payload.totalDurationMs - 1));
  } else {
    positionMs = performanceStart + clamp(localMs, 0, Math.max(0, source.payload.performanceDurationMs - 1));
    cue = activeTotpCue(source.payload.cues, positionMs);
  }

  const playback = derivePlaybackState(replay, positionMs, false);
  const audienceReaction = Number(source.payload.liveTv?.audienceReaction ?? 0);

  return (
    <TotpBroadcastCanvas
      replay={replay}
      experience={experience}
      playbackState={playback}
      cue={cue}
      audienceReaction={audienceReaction}
      presenterKey={String(source.payload.presenterKey ?? source.presenter_key ?? "alex_rayne")}
      showVariant={String(source.payload.showVariant ?? "regular")}
      reducedMotion={false}
      performancePreference="high"
      className="relative h-full w-full overflow-hidden bg-slate-950"
      playerModelsSnapshot={models}
      captions={captions}
      showCaptions
      showSafeAreaGuides={false}

    />
  );
}

function BroadcastItem({ item, localMs, replays }: { item: TotpRenderItem; localMs: number; replays: TotpBroadcastReplay[] }) {
  const source = replayForItem(item, replays);
  return source
    ? <BroadcastReplayItem item={item} localMs={localMs} source={source} />
    : <div className="flex h-full w-full items-center justify-center bg-black text-4xl font-black text-white">PROGRAMME MATERIAL UNAVAILABLE</div>;
}

export function TotpRenderSurface({ payload, frame }: { payload: TotpOfflineRenderPayload; frame: TotpOfflineRenderFrame }) {
  const item = payload.plan.items[frame.itemIndex] ?? payload.plan.items[0];
  if (!item) return <div className="h-full w-full bg-black" />;

  return (
    <main
      className="h-[1080px] w-[1920px] overflow-hidden bg-black"
      data-totp-offline-render
      data-totp-render-item={item.kind}
      data-totp-render-index={frame.itemIndex}
      data-totp-render-local-ms={Math.round(frame.localMs)}
    >
      {item.kind === "opening_titles" ? (
        <OpeningTitles localMs={frame.localMs} durationMs={item.duration_ms} />
      ) : item.kind === "programme_continuity" ? (
        <ProgrammeContinuityFrame item={item} localMs={frame.localMs} />
      ) : item.kind === "stage_transition" ? (
        <StageTransitionFrame item={item} localMs={frame.localMs} replays={payload.replays} />
      ) : item.kind === "chart_rundown" ? (
        <ChartRundownFrame item={item} />
      ) : item.kind === "end_credits" ? (
        <EndCredits replays={payload.replays} localMs={frame.localMs} durationMs={item.duration_ms} />
      ) : (
        <BroadcastItem item={item} localMs={frame.localMs} replays={payload.replays} />
      )}
    </main>
  );
}

export default TotpRenderSurface;