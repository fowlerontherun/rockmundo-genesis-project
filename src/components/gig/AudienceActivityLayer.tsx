/** Decorative audience layer: security pit line and crowd surfers. */
export function AudienceActivityLayer({ density, intensity, animate, big }: { density: number; intensity: number; animate: boolean; big: boolean }) {
  const fill = Math.max(0, Math.min(100, density)) / 100;
  const heat = Math.max(0, Math.min(100, intensity)) / 100;
  const guards = big ? 12 : 6;
  const surfers = heat < 0.6 || fill < 0.35 ? 0 : big ? 3 : 1;

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {/* Security line standing in the pit in front of the stage */}
      <div className="absolute inset-x-[8%] top-[68%] flex items-end justify-between">
        {Array.from({ length: guards }).map((_, i) => (
          <span key={i} className="flex h-5 w-3 flex-col items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-stone-900 ring-1 ring-black/60" />
            <span className="mt-[1px] h-3 w-3 rounded-sm bg-yellow-400/90 ring-1 ring-black/50" />
          </span>
        ))}
      </div>
      <div className="absolute inset-x-[8%] top-[67%] h-[2px] bg-yellow-300/40" />
      <div className="absolute left-[8%] top-[63%] rounded bg-black/60 px-1 text-[9px] uppercase tracking-wide text-yellow-200/80">Pit security</div>

      {/* Crowd surfers riding toward the barrier */}
      {Array.from({ length: surfers }).map((_, i) => (
        <span key={`surf-${i}`} className={`absolute h-2 w-8 rounded-full bg-white/90 ring-1 ring-black/40 ${animate ? 'animate-[pulse_1.6s_ease-in-out_infinite]' : ''}`} style={{ left: `${24 + i * 24}%`, top: `${73 + (i % 2) * 5}%`, transform: `rotate(${i % 2 === 0 ? -8 : 6}deg)` }} />
      ))}
    </div>
  );
}
