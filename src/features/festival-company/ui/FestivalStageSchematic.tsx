import type { FestivalPublicStage } from "../domain/festivalLaunch";
import type { AttendanceBand, FestivalPublicLiveStatus } from "../domain/festivalRuntime";

interface FestivalStageSchematicProps {
  stages: FestivalPublicStage[];
  selectedStageId: string | undefined;
  attendanceBand?: AttendanceBand | null;
  performances?: FestivalPublicLiveStatus["performances"];
  localHour?: number;
  onSelectStage: (id: string) => void;
}

/**
 * A visual *directory*, not an actual site map. Coordinates are deliberately
 * derived from list order and may never be used for wayfinding or travel times.
 */
const atmosphereBands: Record<AttendanceBand, { label: string; intensity: number }> = {
  quiet: { label: "Quiet", intensity: 1 },
  building: { label: "Crowds building", intensity: 2 },
  busy: { label: "Busy", intensity: 3 },
  very_busy: { label: "Very busy", intensity: 4 },
  near_capacity: { label: "Near capacity", intensity: 5 },
  full: { label: "At capacity", intensity: 5 },
};

export function FestivalStageSchematic({ stages, selectedStageId, attendanceBand, performances = [], localHour, onSelectStage }: FestivalStageSchematicProps) {
  const atmosphere = attendanceBand ? atmosphereBands[attendanceBand] : null;
  const afterDark = localHour !== undefined && (localHour >= 20 || localHour < 6);
  const lightingLabel = localHour === undefined ? "Local time unavailable" : afterDark ? "Night-time stage lighting" : "Daytime stage lighting";
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-emerald-500/20 p-4 sm:p-6 ${afterDark ? "bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950" : "bg-gradient-to-br from-sky-900/20 via-emerald-900/15 to-amber-900/15"}`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50" style={{
        backgroundImage: "radial-gradient(circle at 16% 20%, rgba(52,211,153,.16) 0 7%, transparent 8%), radial-gradient(circle at 84% 76%, rgba(251,191,36,.14) 0 9%, transparent 10%), repeating-linear-gradient(135deg, transparent 0 38px, rgba(255,255,255,.025) 39px 42px)",
      }} />
      <div className="relative mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Festival grounds · visual stage directory</p>
          <p className="text-xs text-muted-foreground">Illustrative arrangement only — not a walking map</p>
          <p className="mt-1 text-xs font-medium" role="status">{lightingLabel} · Fixed clock-based effect, not actual sunrise or weather</p>
        </div>
        <span className="rounded-full border bg-background/80 px-3 py-1 text-xs">{stages.length} stages</span>
      </div>
      <div className="relative mb-5 rounded-xl border bg-background/75 p-3" role="status">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">Festival-wide crowd atmosphere</span>
          <span className="text-sm">{atmosphere ? atmosphere.label : "Attendance not available"}</span>
        </div>
        {atmosphere ? (
          <div className="mt-2 flex gap-1" role="img" aria-label={`Reported festival attendance: ${atmosphere.label}`}>
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} aria-hidden="true" className={`h-3 flex-1 rounded-sm ${index < atmosphere.intensity ? "bg-emerald-500/80" : "bg-muted"}`} />
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">Festival-wide reported attendance band. This does not show individual stage crowd sizes.</p>
      </div>
      <div className="relative grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="group" aria-label="Select a festival stage">
        {stages.map((stage, index) => {
          const current = performances.find((entry) => entry.stageName === stage.name && (entry.status === "live" || entry.status === "starting"));
          const delayed = performances.find((entry) => entry.stageName === stage.name && entry.status === "delayed");
          const activeLighting = Boolean(current) && afterDark;
          return (
          <button
            key={stage.id}
            type="button"
            onClick={() => onSelectStage(stage.id)}
            aria-pressed={selectedStageId === stage.id}
            className={`group relative min-h-44 overflow-hidden rounded-xl border-2 bg-card/90 p-4 text-center shadow-lg transition-transform motion-safe:hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selectedStageId === stage.id ? "border-primary ring-2 ring-primary/30" : "border-border/70 hover:border-primary/60"}`}
          >
            <div aria-hidden="true" className={`mx-auto mb-3 flex h-20 max-w-52 flex-col overflow-hidden rounded-t-2xl border-x-4 border-t-4 border-slate-700 ${activeLighting ? "bg-gradient-to-b from-fuchsia-700 via-indigo-600 to-slate-950 shadow-[0_0_24px_rgba(217,70,239,.45)]" : "bg-gradient-to-b from-violet-800 via-fuchsia-700 to-slate-950 shadow-xl"}`}>
              <div className="h-3 bg-slate-900/80" />
              <div className="flex flex-1 items-center justify-center gap-2">
                <span className="h-10 w-1 rotate-12 bg-amber-300/70 shadow-[0_0_15px_rgba(252,211,77,.6)]" />
                <span className="text-2xl">{index === 0 ? "🎸" : index % 2 ? "🎤" : "🎵"}</span>
                <span className="h-10 w-1 -rotate-12 bg-cyan-300/70 shadow-[0_0_15px_rgba(103,232,249,.6)]" />
              </div>
              <div className="h-2 bg-slate-950" />
            </div>
            <span className="block text-base font-bold">{stage.name}</span>
            {current ? (
              <span className="mt-2 block rounded-full bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Live · {current.artistName}</span>
            ) : delayed ? (
              <span className="mt-2 block rounded-full bg-amber-600 px-2 py-1 text-xs font-semibold text-white">Delayed · {delayed.artistName}</span>
            ) : null}
            <span className="block text-xs text-muted-foreground">{stage.capacity.toLocaleString("en-GB")} capacity</span>
          </button>
          );
        })}
      </div>
      <p className="relative mt-5 text-xs text-muted-foreground">Stage order is for discovery only. Routes, entrances and facilities require an organiser-published layout.</p>
    </div>
  );
}
