import { Music2, Star, Trophy } from 'lucide-react';
import { getConfirmedScenePosterStage } from './sceneRules';

export interface ScenePosterProps {
  cityName: string;
  campaignTitle: string;
  monthLabel: string;
  earnedPoints: number;
  targetPoints: number;
  unlockedMilestones?: readonly number[];
  archived?: boolean;
}

/**
 * Asset-free baseline scene poster. Designed to be replaced by city artwork
 * without changing progress/reveal semantics. Safe for missing avatar images.
 */
export function ScenePoster({
  cityName,
  campaignTitle,
  monthLabel,
  earnedPoints,
  targetPoints,
  unlockedMilestones,
  archived = false,
}: ScenePosterProps) {
  const stage = getConfirmedScenePosterStage(unlockedMilestones, earnedPoints, targetPoints);
  const progress = targetPoints > 0
    ? Math.max(0, Math.min(100, Math.floor(100 * earnedPoints / targetPoints)))
    : 0;

  return (
    <section
      aria-label={`${cityName} monthly music scene poster`}
      className="relative isolate overflow-hidden rounded-2xl border border-purple-400/30 bg-[#191426] text-white shadow-lg"
    >
      <div className="absolute inset-0 opacity-70" aria-hidden="true"
        style={{ background: 'radial-gradient(circle at 86% 16%, #b970e4 0%, transparent 35%), linear-gradient(135deg, #241736 0%, #11131f 100%)' }} />
      <div className="absolute inset-0 opacity-30" aria-hidden="true"
        style={{ backgroundImage: 'repeating-linear-gradient(120deg, transparent 0px, transparent 29px, #eabfff 30px, transparent 31px)' }} />

      {/* The revealed artwork follows server-persisted milestone unlocks. */}
      <div className="absolute inset-y-0 left-0 overflow-hidden" aria-hidden="true"
        style={{ width: `${stage}%` }}>
        <div className="absolute inset-y-0 left-0 w-[100vw] max-w-none bg-gradient-to-tr from-fuchsia-900 via-violet-700 to-orange-500 opacity-50" />
        <div className="absolute -bottom-20 left-8 h-56 w-56 rounded-full border-[28px] border-amber-400/30" />
        <div className="absolute right-8 top-8 rotate-12 text-amber-300/70">
          <Star size={88} strokeWidth={1} />
        </div>
      </div>

      <div className="relative flex min-h-[260px] flex-col justify-between gap-8 p-5 sm:min-h-[300px] sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-purple-200">{cityName} • {monthLabel}</p>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
              City Scene Challenges
            </p>
          </div>
          <Music2 className="h-8 w-8 shrink-0 text-amber-200" aria-hidden="true" />
        </div>

        <div>
          <h2 className="max-w-[22ch] text-3xl font-black uppercase leading-none tracking-tight drop-shadow-md sm:text-5xl">
            {campaignTitle}
          </h2>
          <p className="mt-3 text-sm text-purple-100">
            {stage === 100 ? 'Scene complete — this poster belongs to your city!' : archived ? 'A lasting record of the music your city created together.' : 'Make music. Support artists. Reveal your city poster.'}
          </p>
        </div>

        <div className="rounded-xl border border-white/20 bg-black/40 p-3 backdrop-blur-sm">
          <div className="mb-2 flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Trophy className="h-4 w-4 text-amber-300" aria-hidden="true" />
              Mural revealed: {stage}%
            </span>
            <span className="tabular-nums">{Math.max(0, earnedPoints).toLocaleString()} / {Math.max(0, targetPoints).toLocaleString()} points</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/20" role="progressbar"
            aria-label="City scene progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-gradient-to-r from-purple-400 to-amber-300 transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-purple-100">Poster milestones at 25%, 50%, 75% and 100%.</p>
        </div>
      </div>
    </section>
  );
}
