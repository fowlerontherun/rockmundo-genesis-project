import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Radio, Tv, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { TotpBroadcastReplay } from "./api";
import { resolveTotpPresenter, totpVariantLabel } from "./presenters";
import { playTotpPresenterLine } from "./presenterVoice";
import { TOTP_MEDIA_PATHS, totpMediaPublicUrl, type TotpPresenterAudioSlot } from "./totpMedia";
import {
  buildTotpContinuityCopy,
  buildTotpProgrammeRundown,
  totpContinuitySpeech,
  type TotpContinuityKind,
} from "./programmeContinuity";

const CONTINUITY_DURATION_MS: Record<TotpContinuityKind, number> = {
  opening: 5_800,
  between: 4_800,
  closing: 6_200,
};

export interface TotpProgrammeContinuityProps {
  kind: TotpContinuityKind;
  replays: TotpBroadcastReplay[];
  currentIndex?: number;
  autoPlay?: boolean;
  recordedUrl?: string | null;
  onEnded?: () => void;
}

export function TotpProgrammeContinuity({
  kind,
  replays,
  currentIndex = 0,
  autoPlay = false,
  recordedUrl = null,
  onEnded,
}: TotpProgrammeContinuityProps) {
  const orderedFirst = replays[0] ?? null;
  const copy = useMemo(() => buildTotpContinuityCopy(kind, replays, currentIndex), [kind, replays, currentIndex]);
  const rundown = useMemo(() => buildTotpProgrammeRundown(replays), [replays]);
  const presenter = resolveTotpPresenter(orderedFirst?.payload.presenterKey ?? orderedFirst?.presenter_key ?? "alex_rayne");
  const variantLabel = totpVariantLabel(orderedFirst?.payload.showVariant ?? "regular");
  const durationMs = CONTINUITY_DURATION_MS[kind];
  const [elapsedMs, setElapsedMs] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [visualComplete, setVisualComplete] = useState(false);
  const [narrationComplete, setNarrationComplete] = useState(false);
  const endedRef = useRef(false);

  useEffect(() => {
    setElapsedMs(0);
    setVisualComplete(false);
    setNarrationComplete(false);
    endedRef.current = false;
  }, [autoPlay, currentIndex, kind]);

  useEffect(() => {
    if (!autoPlay || typeof window === "undefined") return;
    const speech = totpContinuitySpeech(copy);
    const slot: TotpPresenterAudioSlot = kind === "opening" ? "opening" : kind === "closing" ? "closing" : "between";
    const line = playTotpPresenterLine({
      text: speech,
      presenterKey: presenter.key,
      recordedUrl: recordedUrl || totpMediaPublicUrl(TOTP_MEDIA_PATHS.presenter(presenter.key, slot)),
      volume: 0.95,
      onSpeakingChange: setSpeaking,
      onEnded: () => setNarrationComplete(true),
    });
    const safety = window.setTimeout(() => setNarrationComplete(true), 20_000);

    return () => {
      window.clearTimeout(safety);
      line.stop();
      setSpeaking(false);
    };
  }, [autoPlay, copy.body, copy.headline, currentIndex, kind, presenter.key, recordedUrl]);

  useEffect(() => {
    if (!autoPlay) return;

    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const nextElapsed = Math.min(durationMs, performance.now() - startedAt);
      setElapsedMs(nextElapsed);
      if (nextElapsed >= durationMs) {
        window.clearInterval(timer);
        setVisualComplete(true);
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [autoPlay, durationMs, kind, currentIndex]);

  useEffect(() => {
    if (!autoPlay || !visualComplete || !narrationComplete || endedRef.current) return;
    endedRef.current = true;
    queueMicrotask(() => onEnded?.());
  }, [autoPlay, narrationComplete, onEnded, visualComplete]);

  const progress = Math.min(100, elapsedMs / Math.max(1, durationMs) * 100);
  const showRundown = kind === "opening" || kind === "closing";

  return (
    <section
      className="overflow-hidden rounded-xl border border-fuchsia-500/25 bg-slate-950 text-white shadow-2xl"
      data-totp-programme-continuity={kind}
    >
      <div className="relative min-h-[28rem] bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_32%)] p-5 md:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-500 via-amber-300 to-cyan-400" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-white/15 bg-white/10 p-2">
              <Tv className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-[0.22em]">Top of the Pops</div>
              <div className="text-xs text-white/65">RockMundo Television Centre · London</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">{presenter.displayName}</Badge>
            {variantLabel ? <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/10">{variantLabel}</Badge> : null}
            <Badge className="border-red-400/30 bg-red-500/15 text-red-100 hover:bg-red-500/15"><Radio className="mr-1 h-3 w-3" /> On air</Badge>
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-fuchsia-200">{copy.eyebrow}</p>
          <h3 className="mt-3 max-w-4xl text-3xl font-black tracking-tight md:text-5xl">{copy.headline}</h3>
          <div className="mt-5 max-w-3xl rounded-2xl border border-white/15 bg-black/35 p-4 shadow-xl backdrop-blur">
            <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">
              <Volume2 className={`h-4 w-4 ${speaking ? "animate-pulse" : ""}`} /> {presenter.displayName}
              {speaking ? (
                <span className="flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[10px] tracking-[0.22em] text-white" data-totp-continuity-mic>
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> MIC LIVE
                </span>
              ) : null}
            </div>
            <p className="text-sm leading-6 text-white/85 md:text-base">{copy.body}</p>
          </div>

          {copy.nextAct ? (
            <div className="mt-7 inline-flex max-w-full items-center gap-3 rounded-lg border border-white/15 bg-black/25 px-4 py-3">
              <ChevronRight className="h-5 w-5 shrink-0 text-fuchsia-300" />
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50">{kind === "opening" ? "First on stage" : "Coming up"}</div>
                <div className="truncate font-semibold">#{copy.nextAct.chartRank} · {copy.nextAct.bandName} — {copy.nextAct.songTitle}</div>
              </div>
            </div>
          ) : null}

          {showRundown ? (
            <div className="mt-8 rounded-xl border border-white/10 bg-black/25 p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/55">Tonight's charting performers</div>
              <div className="grid gap-2 md:grid-cols-2">
                {rundown.map((item) => (
                  <div key={item.replayId} className="flex items-center gap-3 rounded-lg bg-white/[0.06] px-3 py-2">
                    <div className="w-10 shrink-0 text-xl font-black tabular-nums text-amber-200">#{item.chartRank}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{item.bandName}</div>
                      <div className="truncate text-xs text-white/55">{item.songTitle}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-black/40 px-4 py-3">
        <Progress value={progress} className="h-1.5 min-w-40 flex-1 bg-white/10" />
        {!autoPlay ? (
          <Button size="sm" variant="secondary" onClick={onEnded}>
            Continue <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <span className="text-xs text-white/50">Programme continuity</span>
        )}
      </div>
    </section>
  );
}

export default TotpProgrammeContinuity;
