import { ArtworkImage } from './GameArtwork';
import { recordingProgress } from './progressionModel';

export function RecordingProgressScene({ status, start, end, now }: { status: string; start: string | null; end: string | null; now: number }) {
  const progress = recordingProgress(status, start, end, now);
  return <div className="relative mt-3 overflow-hidden rounded-lg border bg-slate-950 text-white">
    <ArtworkImage src="/hub-tiles/recording-studio.png" className="absolute inset-0 h-full w-full object-cover opacity-25" />
    <div className="relative space-y-3 bg-gradient-to-r from-slate-950/90 to-slate-950/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><strong>{progress.label}</strong>{progress.percent !== null && status !== 'completed' && <span>{progress.percent}% of booked time elapsed</span>}</div>
      <ol className="grid grid-cols-4 gap-2 text-[10px] sm:text-xs">
        {['Booked', 'Recording', 'Finalise', 'Complete'].map((label, index) => <li key={label} aria-current={index === progress.step ? 'step' : undefined}>
          <div aria-hidden="true" className={`mb-2 h-1 rounded ${index <= progress.step ? 'bg-amber-300' : 'bg-white/20'}`} />
          <span className={index === progress.step ? 'font-semibold text-amber-200' : 'text-slate-300'}>{label}</span>
        </li>)}
      </ol>
    </div>
  </div>;
}
