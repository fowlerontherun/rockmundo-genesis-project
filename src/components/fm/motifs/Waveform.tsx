import { cn } from "@/lib/utils";

/**
 * Waveform — a static audio-clip strip. Pure CSS (no canvas/JS) so it's
 * cheap to render hundreds of times. Colour follows --fm-accent.
 */
export const Waveform = ({
  className,
  height = 16,
}: {
  className?: string;
  height?: number;
}) => (
  <div
    aria-hidden
    className={cn("rm-waveform w-full", className)}
    style={{ height }}
  />
);

export default Waveform;
