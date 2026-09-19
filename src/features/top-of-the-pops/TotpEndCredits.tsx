import { useEffect, useMemo, useState } from "react";
import type { TotpBroadcastReplay } from "./api";
import { resolveTotpPresenter } from "./presenters";

export interface TotpEndCreditsProps {
  replays: TotpBroadcastReplay[];
  autoPlay?: boolean;
  onEnded?: () => void;
  durationMs?: number;
}

export function buildTotpCreditLines(replays: TotpBroadcastReplay[]): string[] {
  const presenterName = resolveTotpPresenter(String(replays[0]?.payload.presenterKey ?? replays[0]?.presenter_key ?? "alex_rayne")).displayName;
  const acts = replays.map((replay) => `${replay.payload.band.name} — "${replay.payload.song.title}"`);
  return [
    `Presented by ${presenterName}`,
    ...(acts.length ? ["Tonight's line-up", ...acts] : []),
    "Studio audience: RockMundo Television Centre, London",
    "Chart data: UK Streaming and Digital Sales",
    "A RockMundo Television production",
  ];
}

export function TotpEndCredits({ replays, autoPlay = true, onEnded, durationMs = 14_000 }: TotpEndCreditsProps) {
  const lines = useMemo(() => buildTotpCreditLines(replays), [replays]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!autoPlay || finished) return;
    const timer = window.setTimeout(() => {
      setFinished(true);
      onEnded?.();
    }, Math.max(4_000, durationMs));
    return () => window.clearTimeout(timer);
  }, [autoPlay, durationMs, finished, onEnded]);

  return (
    <div className="relative mx-auto aspect-video w-full max-w-5xl overflow-hidden rounded-lg bg-black ring-1 ring-white/10" data-totp-end-credits>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(217,70,239,.22),transparent_60%)]" />
      <div className="absolute inset-x-0 top-6 text-center">
        <p className="text-xs font-black tracking-[0.3em] text-cyan-200">TOP OF THE POPS</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 top-16 overflow-hidden">
        <div
          className="flex flex-col items-center gap-3 px-6 text-center text-white"
          style={{ animation: `totp-credit-roll ${Math.max(4, durationMs / 1000)}s linear forwards` }}
        >
          {lines.map((line, index) => (
            <p key={`${line}-${index}`} className={index === 0 || line === "Tonight's line-up" ? "text-sm font-black uppercase tracking-[0.18em] text-cyan-200" : "text-sm font-semibold text-white/85"}>
              {line}
            </p>
          ))}
          <p className="pt-4 text-[11px] font-semibold tracking-[0.2em] text-white/60">ARCHIVE PLAYBACK · NO REWARDS AWARDED</p>
        </div>
      </div>
      <style>{"@keyframes totp-credit-roll{from{transform:translateY(100%)}to{transform:translateY(-100%)}}"}</style>
    </div>
  );
}

export default TotpEndCredits;
