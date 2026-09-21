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
import { buildTotpContinuityCopy, orderTotpProgrammeReplays } from "@/features/top-of-the-pops/programmeContinuity";
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


function ProgrammeContinuityFrame({
  item,
  replays,
}: {
  item: TotpRenderItem;
  replays: TotpBroadcastReplay[];
}) {
  const kind = item.dialogue_kind === "closing" ? "closing" : item.dialogue_kind === "between" ? "between" : "opening";
  const ordered = orderTotpProgrammeReplays(replays);
  const index = Math.max(0, Math.min(ordered.length - 1, Number(item.continuity_index ?? 0)));
  const copy = buildTotpContinuityCopy(kind, ordered, index);
  const presenter = resolveTotpPresenter(String(ordered[0]?.payload.presenterKey ?? ordered[0]?.presenter_key ?? "alex_rayne"));

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-slate-950 text-white" data-totp-offline-continuity={kind}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,.28),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,.22),transparent_34%),linear-gradient(135deg,#05050a,#101827_58%,#07111d)]" />
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-fuchsia-500 via-amber-300 to-cyan-400" />
      <div className="relative mx-auto flex w-[1500px] flex-col justify-center py-24">
        <div className="flex items-center justify-between text-xl font-black uppercase tracking-[0.28em] text-cyan-200">
          <span>Top of the Pops</span>
          <span>{presenter.displayName} · London</span>
        </div>
        <p className="mt-16 text-2xl font-black uppercase tracking-[0.25em] text-fuchsia-200">{copy.eyebrow}</p>
        <h2 className="mt-5 max-w-[1350px] text-[78px] font-black leading-[.95] tracking-[-0.04em]">{copy.headline}</h2>
        <div className="mt-10 max-w-[1200px] rounded-3xl border border-white/15 bg-black/35 p-8 shadow-2xl">
          <p className="text-[30px] leading-[1.4] text-white/90">{copy.body}</p>
        </div>
        {copy.nextAct ? (
          <div className="mt-10 inline-flex max-w-[1050px] items-center gap-5 rounded-2xl border border-white/15 bg-white/[.07] px-7 py-5">
            <div className="text-5xl font-black text-amber-200">#{copy.nextAct.chartRank}</div>
            <div>
              <div className="text-lg font-black uppercase tracking-[0.18em] text-white/50">{kind === "opening" ? "First on stage" : "Coming up"}</div>
              <div className="mt-1 text-3xl font-bold">{copy.nextAct.bandName} — {copy.nextAct.songTitle}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChartRundownFrame({ item }: { item: TotpRenderItem }) {
  const page = item.chart_page;
  if (!page) return <div className="h-full w-full bg-black" />;
  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 text-white" data-totp-offline-chart={page.chartType}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.24),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(217,70,239,.24),transparent_30%)]" />
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-cyan-400 via-white to-fuchsia-500" />
      <div className="relative mx-auto w-[1600px] py-20">
        <div className="flex items-start justify-between gap-10">
          <div>
            <div className="text-xl font-black uppercase tracking-[0.3em] text-cyan-200">Top of the Pops chart rundown</div>
            <h2 className="mt-4 text-[72px] font-black tracking-[-0.04em]">{page.chartLabel}</h2>
            <p className="mt-2 text-2xl text-white/55">Positions {page.rangeLabel} · frozen UK chart snapshot</p>
          </div>
          <div className="rounded-full border border-white/15 bg-white/10 px-6 py-3 text-xl font-black">{page.sourceCount} real positions</div>
        </div>
        <div className="mt-12 grid gap-3">
          {page.entries.map((entry) => (
            <div key={`${page.id}:${entry.rank}:${entry.song_id ?? entry.song_title}`} className={`grid grid-cols-[100px_minmax(0,1fr)_220px] items-center gap-5 rounded-2xl border px-7 py-4 ${entry.rank === 1 ? "border-amber-300/45 bg-amber-300/10" : "border-white/10 bg-white/[.06]"}`}>
              <div className={`text-5xl font-black tabular-nums ${entry.rank === 1 ? "text-amber-200" : "text-white"}`}>#{entry.rank}</div>
              <div className="min-w-0">
                <div className="truncate text-3xl font-bold">{entry.artist_name}</div>
                <div className="mt-1 truncate text-xl text-white/55">{entry.song_title}</div>
              </div>
              <div className="text-right text-xl text-white/50">{entry.trend === "new" ? "NEW" : entry.trend_change ? `${entry.trend_change > 0 ? "▲" : "▼"} ${Math.abs(entry.trend_change)}` : "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function transitionStyle(item: TotpRenderItem): "camera_sweep" | "neon_wipe" | "audience_cutaway" | "spotlight_reset" {
  const styles = ["camera_sweep", "neon_wipe", "audience_cutaway", "spotlight_reset"] as const;
  const key = `${item.from_performance_id ?? ""}:${item.to_performance_id ?? ""}`;
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return styles[(hash >>> 0) % styles.length];
}

function StageTransitionFrame({
  item,
  localMs,
  replays,
}: {
  item: TotpRenderItem;
  localMs: number;
  replays: TotpBroadcastReplay[];
}) {
  const from = replays.find((row) => row.performance_id === item.from_performance_id) ?? null;
  const to = replays.find((row) => row.performance_id === item.to_performance_id) ?? null;
  const progress = clamp(localMs / Math.max(1, item.duration_ms), 0, 1);
  const style = transitionStyle(item);
  const fromName = from?.payload.band.name ?? "previous act";
  const toName = to?.payload.band.name ?? "next act";
  const fromStage = from?.payload.stage?.replaceAll("_", " ") ?? "stage";
  const toStage = to?.payload.stage?.replaceAll("_", " ") ?? "stage";

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-950 text-white" data-totp-offline-transition={style}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(34,211,238,.22),transparent_35%),radial-gradient(circle_at_80%_50%,rgba(244,114,182,.22),transparent_35%)]" />
      {style === "camera_sweep" ? <div className="absolute inset-y-0 w-[38%] -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-cyan-200/10" style={{ left: `${-38 + progress * 150}%` }} /> : null}
      {style === "neon_wipe" ? <div className="absolute inset-y-0 w-[30%] bg-gradient-to-r from-fuchsia-500/10 via-white/35 to-cyan-400/10 blur-xl" style={{ left: `${-30 + progress * 145}%` }} /> : null}
      {style === "spotlight_reset" ? <>
        <div className="absolute left-[18%] top-[-18%] h-[85%] w-[20%] rotate-[18deg] bg-gradient-to-b from-amber-200/30 to-transparent blur-md" style={{ opacity: .35 + progress * .65 }} />
        <div className="absolute right-[18%] top-[-18%] h-[85%] w-[20%] rotate-[-18deg] bg-gradient-to-b from-cyan-200/25 to-transparent blur-md" style={{ opacity: .35 + progress * .65 }} />
      </> : null}
      {style === "audience_cutaway" ? <div className="absolute inset-x-[10%] bottom-[15%] flex justify-around opacity-40">
        {Array.from({ length: 18 }).map((_, index) => <div key={index} className="h-20 w-10 rounded-t-full bg-white/25" style={{ transform: `translateY(${Math.sin(index + progress * Math.PI * 4) * 14}px)` }} />)}
      </div> : null}
      <div className="relative text-center">
        <div className="text-2xl font-black uppercase tracking-[0.34em] text-cyan-200">Top of the Pops · studio reset</div>
        <h2 className="mt-7 text-[82px] font-black tracking-[-0.04em]">{fromName} → {toName}</h2>
        <p className="mt-5 text-3xl text-white/60">{fromStage} → {toStage}</p>
        <div className="mx-auto mt-10 h-2 w-[700px] overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-white/85" style={{ width: `${progress * 100}%` }} />
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
        <ProgrammeContinuityFrame item={item} replays={payload.replays} />
      ) : item.kind === "chart_rundown" ? (
        <ChartRundownFrame item={item} />
      ) : item.kind === "studio_transition" ? (
        <StageTransitionFrame item={item} localMs={frame.localMs} replays={payload.replays} />
      ) : item.kind === "end_credits" ? (
        <EndCredits replays={payload.replays} localMs={frame.localMs} durationMs={item.duration_ms} />
      ) : (
        <BroadcastItem item={item} localMs={frame.localMs} replays={payload.replays} />
      )}
    </main>
  );
}

export default TotpRenderSurface;