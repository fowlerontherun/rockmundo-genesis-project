/** Decorative audience layer: security pit line, mosh pit circles, crowd surfers, flags and banners. */
export function AudienceActivityLayer({ density, intensity, animate, big }: { density: number; intensity: number; animate: boolean; big: boolean }) {
  const fill = Math.max(0, Math.min(100, density)) / 100;
  const heat = Math.max(0, Math.min(100, intensity)) / 100;
  const guards = big ? 12 : 6;
  const pits = heat < 0.45 || fill < 0.25 ? 0 : big ? 3 : 1;
  const flags = fill < 0.15 ? 0 : big ? 9 : 4;
  const banners = fill < 0.2 ? 0 : big ? 3 : 1;
  const surfers = heat < 0.6 || fill < 0.35 ? 0 : big ? 3 : 1;
  const bannerText = ['ONE MORE SONG', 'WE LOVE YOU', 'PLAY THE HITS'];

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

      {/* Mosh / pit circles */}
      {Array.from({ length: pits }).map((_, i) => (
        <div
          key={`pit-${i}`}
          className={`absolute rounded-full border-2 border-rose-400/50 bg-slate-950/30 ${animate ? 'animate-[spin_6s_linear_infinite]' : ''}`}
          style={{ left: `${16 + i * 26}%`, top: `${76 + (i % 2) * 6}%`, width: big ? 62 : 46, height: big ? 26 : 20 }}
        >
          {Array.from({ length: 6 }).map((_, k) => (
            <span key={k} className="absolute h-1.5 w-1.5 rounded-full bg-rose-200/80" style={{ left: `${50 + Math.cos((k / 6) * Math.PI * 2) * 42}%`, top: `${50 + Math.sin((k / 6) * Math.PI * 2) * 42}%` }} />
          ))}
        </div>
      ))}

      {/* Flags on poles */}
      {Array.from({ length: flags }).map((_, i) => (
        <span key={`flag-${i}`} className="absolute w-px bg-white/50" style={{ left: `${9 + i * (82 / Math.max(1, flags))}%`, top: `${74 + ((i * 7) % 12)}%`, height: big ? 26 : 18 }}>
          <span className={`absolute -top-0 left-px block h-3 w-4 ${animate ? 'animate-pulse' : ''}`} style={{ background: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#e879f9', '#22d3ee'][i % 6], clipPath: 'polygon(0 0,100% 25%,0 60%)', opacity: 0.9 }} />
        </span>
      ))}

      {/* Fan banners */}
      {Array.from({ length: banners }).map((_, i) => (
        <span key={`banner-${i}`} className="absolute rounded-sm px-1 text-[7px] font-bold uppercase text-slate-900 ring-1 ring-black/40" style={{ left: `${18 + i * 28}%`, top: `${72 + (i % 2) * 8}%`, background: ['#fde047', '#fca5a5', '#a5f3fc'][i % 3], opacity: 0.92 }}>
          {bannerText[i % bannerText.length]}
        </span>
      ))}

      {/* Crowd surfers riding toward the barrier */}
      {Array.from({ length: surfers }).map((_, i) => (
        <span key={`surf-${i}`} className={`absolute h-2 w-8 rounded-full bg-white/90 ring-1 ring-black/40 ${animate ? 'animate-[pulse_1.6s_ease-in-out_infinite]' : ''}`} style={{ left: `${24 + i * 24}%`, top: `${73 + (i % 2) * 5}%`, transform: `rotate(${i % 2 === 0 ? -8 : 6}deg)` }} />
      ))}
    </div>
  );
}
