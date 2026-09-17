import { useEffect, useRef, useState } from "react";
import { Play, SkipForward, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const TOTP_INTRO_VIDEO_URL =
  (import.meta.env.VITE_TOTP_INTRO_URL as string | undefined)?.trim() || "/media/top-of-the-pops/show-intro.mp4";
export const TOTP_INTRO_DURATION_MS = 15_943;

export interface TotpShowIntroProps {
  playing: boolean;
  onEnded: () => void;
}

/**
 * Programme opener for full-episode playback and the admin studio demo. The
 * supplied source clip is an MP4 container carrying VP9 video and Opus audio.
 * Production may override the asset host/path with VITE_TOTP_INTRO_URL.
 */
export function TotpShowIntro({ playing, onEnded }: TotpShowIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);

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

  return (
    <section className="overflow-hidden rounded-xl border bg-black" data-totp-show-intro data-totp-intro-duration-ms={TOTP_INTRO_DURATION_MS}>
      <div className="relative flex aspect-[4/3] max-h-[70vh] items-center justify-center bg-black">
        {!failed ? (
          <video
            ref={videoRef}
            src={TOTP_INTRO_VIDEO_URL}
            className="h-full w-full object-contain"
            playsInline
            preload="auto"
            onEnded={onEnded}
            onError={() => setFailed(true)}
            aria-label="Top of the Pops programme intro"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 p-8 text-center text-white">
            <Tv2 className="h-10 w-10" />
            <strong>Top of the Pops</strong>
            <p className="max-w-md text-sm text-white/70">The programme intro could not be loaded from the configured media host.</p>
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
