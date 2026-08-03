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

      {has('mountains') ? (
        <div className="absolute inset-x-0 top-[26%] flex h-[26%] items-end">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex-1 bg-slate-700/80 [clip-path:polygon(50%_0,100%_100%,0_100%)]" style={{ height: `${55 + ((i * 31) % 45)}%` }} />)}
        </div>
      ) : null}
      {has('snow_caps') ? (
        <div className="absolute inset-x-0 top-[26%] flex h-[26%] items-end opacity-80">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="flex-1 bg-white/60 [clip-path:polygon(50%_0,62%_22%,38%_22%)]" style={{ height: `${55 + ((i * 31) % 45)}%` }} />)}
        </div>
      ) : null}
      {has('sand_dunes') ? (
        <>
          <div className="absolute inset-x-[-10%] top-[40%] h-[20%] rounded-[100%] bg-amber-600/70" />
          <div className="absolute inset-x-[-20%] top-[46%] h-[20%] rounded-[100%] bg-amber-800/70" />
        </>
      ) : null}
      {has('vine_rows') ? (
        <div className="absolute inset-x-0 top-[44%] flex h-[16%] items-end gap-2 px-4 opacity-70">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="flex-1 rounded-sm bg-lime-800" style={{ height: `${40 + ((i * 23) % 60)}%` }} />)}
        </div>
      ) : null}
      {has('forest_canopy') ? (
        <div className="absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-emerald-950 via-emerald-900/60 to-transparent [mask-image:radial-gradient(circle_at_50%_0,transparent_20%,black_70%)]" />
      ) : null}
      {has('river') ? <div className="absolute inset-x-0 bottom-[26%] h-[14%] bg-gradient-to-b from-sky-700/50 to-indigo-950/70" /> : null}
      {has('hangar') ? <div className="absolute left-[8%] right-[8%] top-[22%] h-[16%] rounded-t-[50%] border border-white/15 bg-zinc-800/70" /> : null}
      {has('city_lights') ? (
        <div className="absolute inset-x-0 top-[30%] h-[20%]">
          {Array.from({ length: 60 }).map((_, i) => <span key={i} className="absolute h-1 w-1 rounded-sm bg-amber-200/80" style={{ left: `${(i * 17) % 100}%`, top: `${(i * 43) % 100}%`, opacity: 0.3 + ((i % 4) / 6) }} />)}
        </div>
      ) : null}
      {has('street_lamps') ? (
        <>
          <div className="absolute bottom-[24%] left-[8%] top-[30%] w-1 bg-slate-600" />
          <div className={`absolute left-[6%] top-[28%] h-4 w-4 rounded-full bg-amber-200/80 blur-[2px] ${animate ? 'animate-pulse' : ''}`} />
          <div className="absolute bottom-[24%] right-[8%] top-[30%] w-1 bg-slate-600" />
          <div className={`absolute right-[6%] top-[28%] h-4 w-4 rounded-full bg-amber-200/80 blur-[2px] ${animate ? 'animate-pulse' : ''}`} />
        </>
      ) : null}
      {has('rooftop_railing') ? <div className="absolute inset-x-0 bottom-[28%] h-6 border-y border-white/25 [background-image:repeating-linear-gradient(90deg,transparent_0_14px,rgba(255,255,255,.25)_14px_16px)]" /> : null}
      {has('stained_glass') ? (
        <div className="absolute inset-x-[16%] top-[8%] flex h-[24%] gap-2 opacity-70">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="flex-1 rounded-t-full border border-amber-200/30" style={{ background: ['linear-gradient(#f472b6,#6366f1)', 'linear-gradient(#facc15,#f97316)', 'linear-gradient(#34d399,#0ea5e9)'][i] }} />)}
        </div>
      ) : null}
      {has('chandeliers') ? (
        <div className="absolute inset-x-[18%] top-[6%] flex justify-between">
          {Array.from({ length: 3 }).map((_, i) => <span key={i} className={`h-8 w-8 rounded-full bg-amber-100/40 blur-[3px] ${animate ? 'animate-pulse' : ''}`} />)}
        </div>
      ) : null}
      {has('disco_ball') ? (
        <div className={`absolute left-1/2 top-[8%] h-10 w-10 -translate-x-1/2 rounded-full bg-gradient-to-br from-white/80 via-slate-300/50 to-slate-600/60 ring-1 ring-white/40 ${animate ? 'animate-[spin_9s_linear_infinite]' : ''}`} />
      ) : null}
      {has('slot_machines') ? (
        <div className="absolute inset-x-0 bottom-[28%] flex h-10 items-end gap-2 px-4 opacity-60">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className={`h-8 flex-1 rounded-t bg-gradient-to-b from-yellow-300/60 to-red-900/60 ${animate && i % 3 === 0 ? 'animate-pulse' : ''}`} />)}
        </div>
      ) : null}
      {has('neon_signs') ? (
        <>
          <div className={`absolute left-[8%] top-[22%] h-6 w-20 rounded bg-fuchsia-500/30 ring-1 ring-fuchsia-300/60 blur-[1px] ${animate ? 'animate-pulse' : ''}`} />
          <div className={`absolute right-[8%] top-[30%] h-6 w-16 rounded bg-cyan-500/30 ring-1 ring-cyan-300/60 blur-[1px] ${animate ? 'animate-pulse' : ''}`} />
        </>
      ) : null}
      {has('wall_posters') ? (
        <div className="absolute inset-x-[6%] top-[24%] flex justify-between opacity-50">
          {Array.from({ length: 5 }).map((_, i) => <span key={i} className="h-8 w-6 rotate-1 rounded-sm" style={{ background: ['#f87171', '#fbbf24', '#a3e635', '#60a5fa', '#e879f9'][i % 5], opacity: 0.55 }} />)}
        </div>
      ) : null}
      {has('sports_lines') ? <div className="absolute inset-x-0 bottom-0 h-[30%] opacity-30 [background-image:repeating-linear-gradient(90deg,transparent_0_58px,rgba(255,255,255,.5)_58px_60px)]" /> : null}
      {has('ice_surface') ? <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-b from-sky-200/40 to-sky-100/10" /> : null}
      {has('lanterns') ? (
        <div className="absolute inset-x-[8%] top-[18%] flex justify-between">
          {Array.from({ length: 8 }).map((_, i) => <span key={i} className={`h-4 w-4 rounded-full bg-amber-300/60 blur-[1px] ${animate && i % 2 === 0 ? 'animate-pulse' : ''}`} />)}
        </div>
      ) : null}

      {has('seating_bowl') ? (
        <>
          {[0, 1, 2].map((ring) => (
            <div key={ring} className="absolute rounded-[46%] border border-white/15 bg-slate-900/70" style={{ inset: `${3 + ring * 5}% ${2 + ring * 4}% ${16 + ring * 6}%`, boxShadow: 'inset 0 0 20px rgba(0,0,0,.6)' }}>
              <div className="absolute inset-x-2 top-1 flex justify-between opacity-70">
                {Array.from({ length: 26 }).map((_, i) => <span key={i} className="h-1 w-1 rounded-sm" style={{ background: ['#38bdf8', '#f472b6', '#fbbf24'][(i + ring) % 3], opacity: 0.65 }} />)}
              </div>
              <div className="absolute inset-y-2 left-1 flex flex-col justify-between opacity-60">
                {Array.from({ length: 10 }).map((_, i) => <span key={i} className="h-1 w-1 rounded-sm bg-white/60" />)}
              </div>
              <div className="absolute inset-y-2 right-1 flex flex-col justify-between opacity-60">
                {Array.from({ length: 10 }).map((_, i) => <span key={i} className="h-1 w-1 rounded-sm bg-white/60" />)}
              </div>
            </div>
          ))}
        </>
      ) : null}
      {has('upper_tier') ? (
        <div className="absolute inset-x-[1%] top-[2%] flex h-[7%] items-end justify-between rounded-t-[40%] border-b border-white/20 bg-black/50 px-2 text-[8px] font-semibold uppercase tracking-[0.3em] text-white/40">
          <span>Upper tier</span><span>Upper tier</span>
        </div>
      ) : null}
      {has('pitch_ring') ? <div className="absolute inset-x-[14%] bottom-[6%] top-[42%] rounded-[50%] border-2 border-white/20" /> : null}
      {has('tent_stripes') ? (
        <div className="absolute inset-x-[2%] top-[8%] flex h-[28%] overflow-hidden rounded-b-[46%] rounded-t-[60%] opacity-70">
          {Array.from({ length: 14 }).map((_, i) => <span key={i} className="flex-1" style={{ background: i % 2 === 0 ? 'rgba(250,250,249,.35)' : 'rgba(217,70,239,.28)' }} />)}
        </div>
      ) : null}
      {has('tent_pennants') ? (
        <div className="absolute inset-x-[4%] top-[6%] flex justify-between">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className={`h-4 w-2 origin-top ${animate ? 'animate-pulse' : ''}`} style={{ background: ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#e879f9'][i % 5], clipPath: 'polygon(0 0,100% 0,50% 100%)', opacity: 0.8 }} />
          ))}
        </div>
      ) : null}
      {has('stall_seating') ? (
        <div className="absolute inset-x-[10%] bottom-[4%] grid h-[22%] grid-cols-12 gap-[3px] opacity-45">
          {Array.from({ length: 60 }).map((_, i) => <span key={i} className="rounded-sm bg-white/25" />)}
        </div>
      ) : null}

      <div className={`absolute inset-x-0 bottom-0 h-[30%] ${scenery.groundClass} opacity-80`} />
      {scenery.atmosphere !== 'clear' ? <div className={`absolute inset-0 ${scenery.atmosphere === 'smoky' ? 'bg-slate-500/15' : scenery.atmosphere === 'dusty' ? 'bg-amber-700/15' : scenery.atmosphere === 'humid' ? 'bg-teal-400/10' : scenery.atmosphere === 'breezy' ? 'bg-sky-300/5' : 'bg-white/5'}`} /> : null}
    </div>
  );
}
