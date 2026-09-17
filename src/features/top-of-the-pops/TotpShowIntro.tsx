import { useEffect, useRef, useState } from "react";
import { SkipForward, Tv2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const TOTP_INTRO_VIDEO_URL =
  (import.meta.env.VITE_TOTP_INTRO_URL as string | undefined)?.trim() || "/media/totp-intro.mp4";

export interface TotpShowIntroProps {
  playing: boolean;
  onEnded: () => void;
}

/**
 * Programme opener for full-episode playback only. The video is deliberately
 * hosted outside the application bundle; production may override the default
 * same-origin path with VITE_TOTP_INTRO_URL.
 */
export function TotpShowIntro({ playing, onEnded }: TotpShowIntroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!playing) {
      video.pause();
      return;
    }
    void video.play().catch(() => {
      // Browser autoplay policy may still block playback if the user gesture was
      // interrupted; controls remain available through Skip intro.
    });
  }, [playing]);

  return (
    <section className="overflow-hidden rounded-xl border bg-black" data-totp-show-intro>
      <div className="relative flex aspect-[4/3] max-h-[70vh] items-center justify-center bg-black">
        {!failed ? (
          <video
            ref={videoRef}
            src={TOTP_INTRO_VIDEO_URL}
            className="h-full w-full object-contain"
            playsInline
            preload="metadata"
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
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/90 to-transparent p-4 text-white">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em]">RockMundo Television</div>
            <div className="text-xs text-white/70">Programme intro · approximately 16 seconds</div>
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
