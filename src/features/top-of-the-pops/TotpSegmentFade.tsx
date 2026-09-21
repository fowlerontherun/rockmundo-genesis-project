import type { ReactNode } from "react";

export interface TotpSegmentFadeProps {
  /** Changes whenever a new programme segment takes over the screen. */
  segmentKey: string;
  children: ReactNode;
}

type SegmentTransition = "soft" | "studio" | "chart" | "credits" | "performance";

function transitionForSegment(segmentKey: string): SegmentTransition {
  if (segmentKey.startsWith("chart")) return "chart";
  if (segmentKey.startsWith("credits")) return "credits";
  if (segmentKey.startsWith("continuity") || segmentKey === "intro" || segmentKey === "clock") return "studio";
  if (segmentKey.startsWith("act") || segmentKey.startsWith("transition")) return "performance";
  return "soft";
}

/**
 * Broadcast-style hand-off between programme sections. Each content family gets
 * a different but restrained transition so the episode feels edited rather
 * than like a set of React components snapping in and out.
 */
export function TotpSegmentFade({ segmentKey, children }: TotpSegmentFadeProps) {
  const transition = transitionForSegment(segmentKey);
  const animationName = {
    soft: "totp-segment-soft",
    studio: "totp-segment-studio",
    chart: "totp-segment-chart",
    credits: "totp-segment-credits",
    performance: "totp-segment-performance",
  }[transition];

  return (
    <div
      key={segmentKey}
      className="relative overflow-hidden motion-reduce:animate-none"
      style={{ animation: `${animationName} 620ms cubic-bezier(.2,.8,.2,1) both` }}
      data-totp-segment={segmentKey}
      data-totp-transition={transition}
    >
      {transition !== "soft" ? (
        <div
          className="pointer-events-none absolute inset-0 z-50"
          style={{
            animation: "totp-transition-overlay 700ms ease-out both",
            background: transition === "chart"
              ? "linear-gradient(100deg, transparent 0%, rgba(34,211,238,.28) 42%, rgba(255,255,255,.38) 50%, rgba(217,70,239,.25) 58%, transparent 100%)"
              : transition === "credits"
                ? "radial-gradient(circle at center, transparent 28%, rgba(0,0,0,.72) 100%)"
                : transition === "performance"
                  ? "linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent)"
                  : "linear-gradient(115deg, transparent 25%, rgba(217,70,239,.18) 48%, rgba(34,211,238,.16) 54%, transparent 78%)",
          }}
        />
      ) : null}
      <div className="relative z-0">{children}</div>
      <style>{`
        @keyframes totp-segment-soft {
          from { opacity: 0; transform: scale(.996); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes totp-segment-studio {
          from { opacity: 0; transform: scale(1.018); filter: brightness(1.35) blur(2px); }
          to { opacity: 1; transform: scale(1); filter: brightness(1) blur(0); }
        }
        @keyframes totp-segment-chart {
          from { opacity: 0; transform: translateX(22px) scale(.994); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes totp-segment-credits {
          from { opacity: 0; transform: scale(.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes totp-segment-performance {
          from { opacity: 0; transform: scale(1.012); filter: saturate(1.25); }
          to { opacity: 1; transform: scale(1); filter: saturate(1); }
        }
        @keyframes totp-transition-overlay {
          0% { opacity: 0; transform: translateX(-18%); }
          28% { opacity: 1; }
          100% { opacity: 0; transform: translateX(18%); }
        }
      `}</style>
    </div>
  );
}

export default TotpSegmentFade;
