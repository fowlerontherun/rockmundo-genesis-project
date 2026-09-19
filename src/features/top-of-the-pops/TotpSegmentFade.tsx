import type { ReactNode } from "react";

export interface TotpSegmentFadeProps {
  /** Changes whenever a new programme segment takes over the screen. */
  segmentKey: string;
  children: ReactNode;
}

/**
 * Wraps each programme segment so cuts between the clock, intro, acts,
 * presenter links, chart rundown and credits dissolve instead of snapping.
 */
export function TotpSegmentFade({ segmentKey, children }: TotpSegmentFadeProps) {
  return (
    <div
      key={segmentKey}
      className="animate-in fade-in zoom-in-[0.995] duration-500 ease-out motion-reduce:animate-none"
      data-totp-segment={segmentKey}
    >
      {children}
    </div>
  );
}

export default TotpSegmentFade;
