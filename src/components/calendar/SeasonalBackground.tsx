import { useMemo } from "react";
import type { Season } from "@/utils/gameCalendar";

interface SeasonalBackgroundProps {
  season: Season;
  enabled?: boolean;
}

export function SeasonalBackground({ season, enabled = true }: SeasonalBackgroundProps) {
  const particles = useMemo(() => {
    const count = season === "winter" ? 50 : season === "autumn" ? 30 : 20;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 10,
      duration: 8 + Math.random() * 8,
      size: 8 + Math.random() * 16,
      rotation: Math.random() * 360,
    }));
  }, [season]);

  if (!enabled) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Season-specific background gradient */}
      <div
        className={`absolute inset-0 opacity-20 transition-colors duration-1000 ${
          season === "summer"
            ? "bg-gradient-to-b from-amber-500/20 via-transparent to-transparent"
            : season === "autumn"
            ? "bg-gradient-to-b from-orange-600/20 via-transparent to-transparent"
            : season === "winter"
            ? "bg-gradient-to-b from-blue-300/20 via-transparent to-transparent"
            : "bg-gradient-to-b from-pink-300/20 via-transparent to-transparent"
        }`}
      />

      {/* Animated particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className={`absolute ${getParticleClass(season)}`}
          style={{
            left: `${p.left}%`,
            top: "-20px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        >
          {getParticleContent(season)}
        </div>
      ))}

      {/* Season-specific decorations */}
      {season === "spring" && <SpringDecorations />}
      {season === "summer" && <SummerDecorations />}
      {season === "autumn" && <AutumnDecorations />}
      {season === "winter" && <WinterDecorations />}
    </div>
  );
}

function getParticleClass(season: Season): string {
  switch (season) {
    case "winter":
      return "animate-snowfall text-blue-100/60";
    case "autumn":
      return "animate-leaf-fall text-orange-400/70";
    case "spring":
      return "animate-blossom-float text-pink-300/60";
    case "summer":
      return "animate-float text-yellow-300/40";
  }
}

function getParticleContent(season: Season): React.ReactNode {
  switch (season) {
    case "winter":
      return <span className="text-xl">❄</span>;
    case "autumn":
      return <span className="text-xl">🍂</span>;
    case "spring":
      return <span className="text-xl">🌸</span>;
    case "summer":
      return <span className="text-xl">✨</span>;
  }
}

function SpringDecorations() {
  return (
    <>
      <div className="absolute bottom-0 left-8 text-5xl opacity-10">🌷</div>
      <div className="absolute bottom-0 right-12 text-4xl opacity-10">🦋</div>
      <div className="absolute top-20 right-4 w-64 h-64 opacity-10">
        <div className="absolute inset-0 bg-gradient-radial from-pink-300 to-transparent animate-pulse-slow" />
      </div>
    </>
  );
}

function SummerDecorations() {
  return (
    <>
      {/* Sun rays effect */}
      <div className="absolute top-0 right-0 w-96 h-96 opacity-10">
        <div className="absolute inset-0 bg-gradient-radial from-yellow-400 to-transparent animate-pulse-slow" />
      </div>
      {/* Palm tree silhouettes */}
      <div className="absolute bottom-0 left-4 text-6xl opacity-10">🌴</div>
      <div className="absolute bottom-0 right-8 text-5xl opacity-10">🌴</div>
    </>
  );
}

function AutumnDecorations() {
  return (
    <>
      <div className="absolute bottom-0 left-6 text-5xl opacity-10">🍁</div>
      <div className="absolute bottom-0 right-10 text-4xl opacity-10">🎃</div>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-orange-900/10 to-transparent" />
    </>
  );
}

function WinterDecorations() {
  return (
    <>
      {/* Frost effect on edges */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-blue-200/10 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-blue-200/5 to-transparent" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-blue-200/5 to-transparent" />
    </>
  );
}
