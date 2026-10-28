import { useState } from "react";
import type { FestivalPublicConfirmedAct, FestivalPublicStage } from "../domain/festivalLaunch";

interface FestivalGroundsProps {
  stages: FestivalPublicStage[];
  lineup: FestivalPublicConfirmedAct[];
  timezone: string;
  onViewTimetable: () => void;
}

/**
 * A stage discovery view, not a geographic site plan. Positions are deliberately
 * non-geographic until the published festival site plan provides coordinates.
 */
export function FestivalGrounds({ stages, lineup, timezone, onViewTimetable }: FestivalGroundsProps) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const selectedStage = stages.find((stage) => stage.id === selectedStageId) ?? stages[0];
  const acts = selectedStage
    ? lineup.filter((entry) => entry.stageName === selectedStage.name)
      .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))
    : [];

  return (
    <section aria-labelledby="festival-grounds-title" className="space-y-4">
      <div>
        <h2 id="festival-grounds-title" className="text-2xl font-bold">Explore the stages</h2>
        <p className="text-sm text-muted-foreground">
          Select a stage to discover its announced artists. This is a stage guide, not a walking map.
        </p>
      </div>
      {stages.length === 0 ? (
        <p className="rounded-xl border p-5 text-muted-foreground">The festival grounds and stages have not been announced yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-emerald-950/20 via-violet-950/15 to-amber-950/20 p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Festival stage guide</span>
              <span className="text-xs text-muted-foreground">{stages.length} stages</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {stages.map((stage, index) => (
                <button
                  key={stage.id}
                  type="button"
                  aria-pressed={selectedStage?.id === stage.id}
                  onClick={() => setSelectedStageId(stage.id)}
                  className={`min-h-32 rounded-xl border-2 p-4 text-left shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selectedStage?.id === stage.id ? "border-primary bg-primary/10" : "border-border bg-card/80 hover:border-primary/60"}`}
                >
                  <span aria-hidden="true" className="mb-3 block text-2xl">{index === 0 ? "🎸" : index % 2 ? "🎤" : "🎵"}</span>
                  <span className="block text-lg font-bold">{stage.name}</span>
                  <span className="block text-xs text-muted-foreground">Capacity {stage.capacity.toLocaleString("en-GB")}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5" aria-live="polite">
            <h3 className="text-xl font-bold">{selectedStage?.name}</h3>
            {selectedStage && <p className="mt-1 text-sm text-muted-foreground">Stage capacity: {selectedStage.capacity.toLocaleString("en-GB")}</p>}
            <h4 className="mt-5 font-semibold">Announced artists</h4>
            {acts.length ? (
              <ul className="mt-3 space-y-3">
                {acts.map((act) => (
                  <li key={act.id} className="rounded-lg border p-3">
                    <span className="block font-medium">{act.artistName}</span>
                    <span className="text-xs text-muted-foreground">
                      {act.startsAt
                        ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(act.startsAt))
                        : "Time to be announced"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted-foreground">No artists announced for this stage yet.</p>}
            <button type="button" onClick={onViewTimetable} className="mt-5 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              View full timetable
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
