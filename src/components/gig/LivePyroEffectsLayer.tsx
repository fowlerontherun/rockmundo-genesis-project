type PyroKind = 'flame_jet' | 'sparkler' | 'co2' | 'firework' | 'confetti' | 'laser' | 'smoke' | 'strobe' | 'generic';

const classify = (effect: string): PyroKind => {
  const value = effect.toLowerCase();
  if (/flame|pyro|fire(?!work)/.test(value)) return 'flame_jet';
  if (/spark|fountain|gerb/.test(value)) return 'sparkler';
  if (/co2|cryo|jet/.test(value)) return 'co2';
  if (/firework|shell|aerial/.test(value)) return 'firework';
  if (/confetti|streamer|burst/.test(value)) return 'confetti';
  if (/laser/.test(value)) return 'laser';
  if (/smoke|haze|fog/.test(value)) return 'smoke';
  if (/strobe|flash/.test(value)) return 'strobe';
  return 'generic';
};

interface Props {
  effects: string[];
  animate: boolean;
  intensity: number;
  outdoor: boolean;
}

/** Renders the production plan's active effects as actual stage visuals instead of plain text labels. */
export function LivePyroEffectsLayer({ effects, animate, intensity, outdoor }: Props) {
  if (!effects.length) return null;
  const hot = intensity > 60;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {effects.map((effect, index) => {
        const kind = classify(effect);
        const left = 12 + (index * 76) / Math.max(1, effects.length);

        if (kind === 'flame_jet') {
          return (
            <div key={effect} className="absolute bottom-0" style={{ left: `${left}%` }}>
              <div className={`h-24 w-3 rounded-t-full bg-gradient-to-t from-amber-500 via-orange-400 to-transparent blur-[2px] ${animate ? 'animate-pulse' : ''}`} style={{ height: hot ? '7rem' : '5rem' }} />
            </div>
          );
        }
        if (kind === 'sparkler') {
          return (
            <div key={effect} className="absolute bottom-0" style={{ left: `${left}%` }}>
              <div className={`h-16 w-6 rounded-t-full bg-gradient-to-t from-yellow-200/90 via-yellow-100/50 to-transparent blur-[1px] ${animate ? 'animate-pulse' : ''}`} />
            </div>
          );
        }
        if (kind === 'co2') {
          return (
            <div key={effect} className="absolute bottom-2" style={{ left: `${left}%` }}>
              <div className={`h-20 w-10 rounded-full bg-gradient-to-t from-white/70 via-white/25 to-transparent blur-md ${animate ? 'animate-pulse' : ''}`} />
            </div>
          );
        }
        if (kind === 'firework') {
          return (
            <div key={effect} className="absolute" style={{ left: `${left}%`, top: outdoor ? '8%' : '14%' }}>
              <div className={`h-16 w-16 rounded-full border border-white/40 bg-[radial-gradient(circle,rgba(255,240,180,0.85),rgba(255,120,60,0.25),transparent_70%)] blur-[1px] ${animate ? 'animate-ping' : ''}`} />
            </div>
          );
        }
        if (kind === 'confetti') {
          return (
            <div key={effect} className="absolute inset-x-0 top-0 flex justify-around" style={{ opacity: 0.9 }}>
              {Array.from({ length: 14 }).map((_, dot) => (
                <span
                  key={dot}
                  className={`block h-3 w-1 rounded-sm ${dot % 3 === 0 ? 'bg-pink-300' : dot % 3 === 1 ? 'bg-amber-200' : 'bg-cyan-200'} ${animate ? 'animate-bounce' : ''}`}
                  style={{ marginTop: `${(dot % 5) * 18}px`, animationDelay: `${dot * 90}ms` }}
                />
              ))}
            </div>
          );
        }
        if (kind === 'laser') {
          return (
            <div key={effect} className="absolute inset-0" style={{ opacity: hot ? 0.5 : 0.3 }}>
              <div className="absolute left-[10%] top-[30%] h-[2px] w-[80%] rotate-6 bg-emerald-300/70 blur-[1px]" />
              <div className="absolute left-[10%] top-[46%] h-[2px] w-[80%] -rotate-6 bg-emerald-200/60 blur-[1px]" />
            </div>
          );
        }
        if (kind === 'smoke') {
          return <div key={effect} className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-slate-200/25 to-transparent blur-xl" />;
        }
        if (kind === 'strobe') {
          return <div key={effect} className={`absolute inset-0 bg-white/10 ${animate ? 'animate-pulse' : ''}`} />;
        }
        return (
          <div key={effect} className="absolute rounded-full bg-white/10 blur-md" style={{ left: `${left}%`, bottom: '10%', height: '3rem', width: '3rem' }} />
        );
      })}
    </div>
  );
}
