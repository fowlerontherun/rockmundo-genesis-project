import { useEffect, useRef, useState } from "react";
import { Play, SkipForward, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TOTP_MEDIA_PATHS, totpMediaPublicUrl } from "./totpMedia";

const configuredIntroUrl = (import.meta.env.VITE_TOTP_INTRO_URL as string | undefined)?.trim();

export const TOTP_INTRO_VIDEO_URL =
  configuredIntroUrl || totpMediaPublicUrl(TOTP_MEDIA_PATHS.programmeIntro);
export const TOTP_INTRO_DURATION_MS = 15_943;

export interface TotpShowIntroProps {
  playing: boolean;
  onEnded: () => void;
}

/**
 * Programme opener for full-episode playback only. The supplied source clip is
 * WebM/VP9+Opus, so the same-origin default uses a .webm filename. Production
 * may override the asset host/path with VITE_TOTP_INTRO_URL.
 */
export function TotpShowIntro({ playing, onEnded }: TotpShowIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const introSources = Array.from(new Set([
    configuredIntroUrl,
    totpMediaPublicUrl(TOTP_MEDIA_PATHS.programmeIntro),
    "/media/top-of-the-pops/show-intro.webm",
    "/media/totp-intro.mp4",
  ].filter((value): value is string => !!value)));
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [fallbackElapsed, setFallbackElapsed] = useState(0);
  const source = introSources[sourceIndex] ?? "";

  const playIntro = () => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!playing) {
      video.pause();
      return;
    }
    void video.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  }, [playing]);

  useEffect(() => {
    if (!playing || !failed) {
      setFallbackElapsed(0);
      return;
    }
    const started = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.min(4_500, performance.now() - started);
      setFallbackElapsed(elapsed);
      if (elapsed >= 4_500) {
        window.clearInterval(timer);
        queueMicrotask(onEnded);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [failed, playing, onEnded]);

  return (
    <section className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border bg-black" data-totp-show-intro data-totp-intro-duration-ms={TOTP_INTRO_DURATION_MS}>
      <div className="relative flex aspect-video items-center justify-center bg-black">
        {!failed ? (
          <video
            ref={videoRef}
            src={source}
            className="h-full w-full object-contain"
            playsInline
            preload="auto"
            onEnded={onEnded}
            onError={() => {
              if (sourceIndex < introSources.length - 1) {
                setSourceIndex((index) => index + 1);
                setBlocked(false);
              } else {
                setFailed(true);
              }
            }}
            aria-label="Top of the Pops programme intro"
          />
        ) : (
          <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden p-8 text-center text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(217,70,239,0.42),transparent_28%),radial-gradient(circle_at_75%_65%,rgba(34,211,238,0.28),transparent_30%),linear-gradient(135deg,#09090b,#111827_55%,#0f172a)]" />
            <div className="absolute inset-0 opacity-35 [background-image:repeating-linear-gradient(105deg,transparent_0,transparent_34px,rgba(255,255,255,0.08)_35px,transparent_36px)]" />
            <div className="relative animate-in zoom-in-75 fade-in duration-700">
              <Tv2 className="mx-auto h-12 w-12 text-fuchsia-300" />
              <div className="mt-4 text-xs font-black uppercase tracking-[0.45em] text-cyan-200">RockMundo Television</div>
              <div className="mt-3 text-5xl font-black uppercase tracking-tight sm:text-7xl">Top of the Pops</div>
              <div className="mx-auto mt-5 h-1 w-40 bg-gradient-to-r from-fuchsia-500 via-amber-300 to-cyan-400" />
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.25em] text-white/70">Live from London</p>
              <div className="mx-auto mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-white/80 transition-[width] duration-100" style={{ width: `${Math.min(100, fallbackElapsed / 4_500 * 100)}%` }} />
              </div>
            </div>
          </div>
        )}
        {blocked && !failed && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55">
            <Button size="lg" onClick={playIntro}>
              <Play className="mr-2 h-5 w-5" /> Start intro
            </Button>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/90 to-transparent p-4 text-white">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em]">RockMundo Television</div>
            <div className="text-xs text-white/70">Programme intro · 15.94 seconds</div>
          </div>
          <Button size="sm" variant="secondary" onClick={onEnded}>
            Skip intro <SkipForward className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}

export default TotpShowIntro;
