import { useEffect, useRef, useState } from "react";
import { formatTotpCountdown, TOTP_CLOCK_LEADER_MS, totpCountdownRemainingMs, totpCountdownSeconds } from "./broadcastCountdown";

export interface TotpCountdownClockProps {
  /** Total countdown length in milliseconds. */
  durationMs?: number;
  playing?: boolean;
  label?: string;
  onEnded?: () => void;
}

/**
 * Classic studio clock leader: a real ticking countdown shown before the
 * programme intro, so the episode starts on a proper on-air cue.
 */
export function TotpCountdownClock({
  durationMs = TOTP_CLOCK_LEADER_MS,
  playing = true,
  label = "On air in",
  onEnded,
}: TotpCountdownClockProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const endedRef = useRef(false);

  useEffect(() => {
    setElapsedMs(0);
    endedRef.current = false;
    if (!playing || typeof window === "undefined") return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = now - previous;
      previous = now;
      setElapsedMs((current) => {
        const next = Math.min(durationMs, current + delta);
        if (next >= durationMs && !endedRef.current) {
          endedRef.current = true;
          queueMicrotask(() => onEnded?.());
        }
        return next;
      });
      if (!endedRef.current) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, onEnded, playing]);

  const remainingMs = totpCountdownRemainingMs(durationMs, elapsedMs);
  const seconds = totpCountdownSeconds(remainingMs);
  const sweep = 1 - remainingMs / Math.max(1, durationMs);
  const announcement = seconds <= 10
    ? `${label} ${Math.max(1, seconds)} second${seconds === 1 ? "" : "s"}`
    : seconds % 30 === 0
      ? `${label} ${formatTotpCountdown(remainingMs)}`
      : "";

  return (
    <section
      className="relative flex aspect-video min-h-[18rem] items-center justify-center overflow-hidden rounded-xl border bg-black text-white"
      data-totp-countdown-clock
      data-totp-countdown-seconds={seconds}
      role="timer"
      aria-label={`${label} ${formatTotpCountdown(remainingMs)}`}
    >
      <span className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</span>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.14),transparent_55%)]" />
      <div className="absolute inset-0 opacity-[0.05] [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_2px,rgba(255,255,255,.4)_3px)]" />
      <div className="relative flex flex-col items-center">
        <div className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-200">{label}</div>
        <div className="relative mt-4 flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(rgba(34,211,238,.85) ${sweep * 360}deg, rgba(255,255,255,.08) ${sweep * 360}deg)`,
            }}
          />
          <div className="absolute inset-[6px] rounded-full bg-black" />
          <div className="absolute inset-[6px] rounded-full ring-1 ring-white/20" />
          <span
            key={seconds}
            className="relative animate-in zoom-in-75 fade-in text-6xl font-black tabular-nums duration-200 sm:text-7xl"
            data-totp-countdown-value
            aria-hidden="true"
          >
            {Math.max(1, seconds)}
          </span>
        </div>
        <div className="mt-5 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">
          Top of the Pops · {formatTotpCountdown(remainingMs)}
        </div>
      </div>
    </section>
  );
}

export default TotpCountdownClock;
