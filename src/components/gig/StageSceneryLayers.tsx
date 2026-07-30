import type { StageScenery } from '@/utils/gigStageScenery';

/** Purely decorative backdrop layers for the live gig viewer. */
export function StageSceneryLayers({ scenery, animate }: { scenery: StageScenery; animate: boolean }) {
  const has = (p: StageScenery['props'][number]) => scenery.props.includes(p);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className={`absolute inset-0 ${scenery.skyClass}`} />

      {has('stars') ? (
        <div className="absolute inset-x-0 top-0 h-1/2">
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i} className={`absolute rounded-full bg-white/70 ${animate && i % 5 === 0 ? 'animate-pulse' : ''}`} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 90}%`, width: i % 4 === 0 ? 3 : 2, height: i % 4 === 0 ? 3 : 2, opacity: 0.25 + ((i % 5) / 8) }} />
          ))}
        </div>
      ) : null}

      {has('sun') ? <div className={`absolute right-[14%] top-[8%] h-16 w-16 rounded-full bg-yellow-200/80 blur-[2px] ${animate ? 'animate-pulse' : ''}`} /> : null}
      {has('sea') ? <div className="absolute inset-x-0 top-[38%] h-[16%] bg-gradient-to-b from-cyan-500/60 to-blue-800/70" /> : null}
      {has('hills') ? <div className="absolute inset-x-0 top-[34%] h-[22%] rounded-[100%] bg-emerald-900/70 blur-[1px]" /> : null}

      {has('skyline') ? (
        <div className="absolute inset-x-0 top-[30%] flex h-[18%] items-end gap-1 px-2 opacity-50">
          {Array.from({ length: 22 }).map((_, i) => <div key={i} className="flex-1 rounded-t-sm bg-slate-800" style={{ height: `${30 + ((i * 29) % 70)}%` }} />)}
        </div>
      ) : null}

      {has('treeline') ? (
        <div className="absolute inset-x-0 top-[40%] flex h-[14%] items-end gap-[2px] opacity-70">
          {Array.from({ length: 30 }).map((_, i) => <div key={i} className="flex-1 rounded-t-full bg-emerald-950" style={{ height: `${45 + ((i * 41) % 55)}%` }} />)}
        </div>
      ) : null}

      {has('ferris_wheel') ? (
        <div className={`absolute left-[6%] top-[12%] h-24 w-24 rounded-full border-2 border-fuchsia-200/40 ${animate ? 'animate-[spin_18s_linear_infinite]' : ''}`}>
          {Array.from({ length: 8 }).map((_, i) => <span key={i} className="absolute left-1/2 top-1/2 h-12 w-px origin-top bg-fuchsia-200/30" style={{ transform: `rotate(${i * 45}deg)` }} />)}
        </div>
      ) : null}

      {has('food_stalls') ? (
        <div className="absolute inset-x-0 bottom-[26%] flex h-8 items-end gap-3 px-6 opacity-60">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-5 flex-1 rounded-t-sm bg-gradient-to-b from-rose-400/70 to-amber-200/40" />)}
        </div>
      ) : null}

      {has('canopy') ? <div className="absolute inset-x-[2%] top-[10%] h-[26%] rounded-b-[46%] rounded-t-[60%] border-b-4 border-white/20 bg-gradient-to-b from-white/25 via-fuchsia-200/10 to-transparent" /> : null}
      {has('tent_poles') ? <><div className="absolute bottom-[24%] left-[6%] top-[24%] w-1 bg-white/25" /><div className="absolute bottom-[24%] right-[6%] top-[24%] w-1 bg-white/25" /></> : null}

      {has('trusses') ? (
        <>
          <div className="absolute left-[6%] right-[6%] top-[20%] h-2 border-y border-white/25 bg-white/10" />
          <div className="absolute bottom-[28%] left-[6%] top-[20%] w-2 border-x border-white/25 bg-white/10" />
          <div className="absolute bottom-[28%] right-[6%] top-[20%] w-2 border-x border-white/25 bg-white/10" />
        </>
      ) : null}

      {has('led_wall') ? <div className={`absolute left-[20%] right-[20%] top-[24%] h-[18%] rounded border border-cyan-200/30 bg-gradient-to-br from-cyan-500/20 via-fuchsia-500/20 to-indigo-500/20 ${animate ? 'animate-pulse' : ''}`} /> : null}
      {has('pa_towers') ? <><div className="absolute bottom-[28%] left-[3%] top-[26%] w-6 rounded bg-black/70 ring-1 ring-white/15" /><div className="absolute bottom-[28%] right-[3%] top-[26%] w-6 rounded bg-black/70 ring-1 ring-white/15" /></> : null}
      {has('floodlights') ? <><div className="absolute left-[10%] top-[6%] h-4 w-4 rounded-full bg-white/70 blur-[3px]" /><div className="absolute right-[10%] top-[6%] h-4 w-4 rounded-full bg-white/70 blur-[3px]" /></> : null}

      {has('brick_wall') ? <div className="absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(0deg,transparent_0_11px,rgba(255,255,255,.18)_11px_12px),repeating-linear-gradient(90deg,transparent_0_26px,rgba(255,255,255,.18)_26px_27px)]" /> : null}
      {has('curtains') ? <><div className="absolute bottom-[28%] left-0 top-0 w-[10%] bg-gradient-to-r from-red-950 to-red-900/40" /><div className="absolute bottom-[28%] right-0 top-0 w-[10%] bg-gradient-to-l from-red-950 to-red-900/40" /></> : null}
      {has('balconies') ? <div className="absolute inset-x-0 top-[16%] h-3 border-y border-white/15 bg-black/40" /> : null}
      {has('flags') ? (
        <div className="absolute inset-x-[8%] top-[14%] flex justify-between">
          {Array.from({ length: 6 }).map((_, i) => <span key={i} className={`h-6 w-3 origin-top rounded-b bg-white/25 ${animate ? 'animate-pulse' : ''}`} />)}
        </div>
      ) : null}
      {has('bunting') ? (
        <div className="absolute inset-x-[4%] top-[16%] flex justify-between">
          {Array.from({ length: 14 }).map((_, i) => <span key={i} className="h-3 w-3 rotate-45 rounded-sm" style={{ background: ['#f87171', '#fbbf24', '#34d399', '#60a5fa'][i % 4], opacity: 0.7 }} />)}
        </div>
      ) : null}

      <div className={`absolute inset-x-0 bottom-0 h-[30%] ${scenery.groundClass} opacity-80`} />
      {scenery.atmosphere !== 'clear' ? <div className={`absolute inset-0 ${scenery.atmosphere === 'smoky' ? 'bg-slate-500/15' : scenery.atmosphere === 'dusty' ? 'bg-amber-700/15' : scenery.atmosphere === 'humid' ? 'bg-teal-400/10' : scenery.atmosphere === 'breezy' ? 'bg-sky-300/5' : 'bg-white/5'}`} /> : null}
    </div>
  );
}
