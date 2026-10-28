import { useEffect, useState } from "react";
import { FestivalStageSchematic } from "./FestivalStageSchematic";
import { usePublicFestivalLiveStatus, usePublicFestivalLiveExperience } from "../application/useFestivalRuntime";
import { FESTIVAL_STAGE_CROWD_BANDS, FESTIVAL_STAGE_CROWD_MOODS, getFestivalPublicStageCrowds } from "../domain/festivalPublicStageCrowds";
import type { FestivalPublicConfirmedAct, FestivalPublicStage } from "../domain/festivalLaunch";

interface FestivalGroundsProps {
  slug: string;
  festivalLaunchId: string;
  stages: FestivalPublicStage[];
  lineup: FestivalPublicConfirmedAct[];
  timezone: string;
  visitorInformation: {
    travel: string | null;
    camping: string | null;
    accessibility: string | null;
    foodAndDrink: string | null;
  };
  onViewTimetable: () => void;
}

/**
 * A stage discovery view, not a geographic site plan. Positions are deliberately
 * non-geographic until the published festival site plan provides coordinates.
 */
export function FestivalGrounds({ slug, festivalLaunchId, stages, lineup, timezone, visitorInformation, onViewTimetable }: FestivalGroundsProps) {
  const live = usePublicFestivalLiveStatus(slug);
  const experience = usePublicFestivalLiveExperience(slug);
  const stageCrowds = getFestivalPublicStageCrowds(
    experience.isError || experience.isPending ? null : experience.data,
    festivalLaunchId,
    stages,
  );
  const verifiedLive = live.data?.festivalLaunchId === festivalLaunchId ? live.data : null;
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  // Clock-based visual styling only; not astronomical sunrise/sunset or weather.
  const hourPart = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: timezone }).formatToParts(new Date(currentTime)).find((part) => part.type === "hour");
  const localHour = hourPart ? Number(hourPart.value) : undefined;
    const selectedStage = stages.find((stage) => stage.id === selectedStageId) ?? stages[0];
  const selectedCrowd = selectedStage ? stageCrowds[selectedStage.id] : undefined;
  const acts = selectedStage
    ? lineup.filter((entry) => entry.stageName === selectedStage.name)
      .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))
    : [];

  const publishedActs = acts.filter((act) => act.startsAt && act.endsAt && Number.isFinite(Date.parse(act.startsAt)) && Number.isFinite(Date.parse(act.endsAt)));
  const scheduledNow = publishedActs.find((act) => Date.parse(act.startsAt!) <= currentTime && currentTime < Date.parse(act.endsAt!));
  const scheduledNext = publishedActs.find((act) => Date.parse(act.startsAt!) > currentTime);
  const scheduleLabel = scheduledNow ? "Scheduled now" : scheduledNext ? "Next scheduled set" : "No further published sets";

  const livePerformances = verifiedLive && selectedStage
    ? verifiedLive.performances.filter((entry) => entry.stageName === selectedStage.name)
    : [];
  const livePerformance = livePerformances.find((entry) => entry.status === "live" || entry.status === "starting");
  const delayedPerformance = livePerformances.find((entry) => entry.status === "delayed");
  const cancelledPerformances = livePerformances.filter((entry) => entry.status === "cancelled");
  const liveStatus = livePerformance ?? delayedPerformance;
  const liveStatusLabel = livePerformance ? "Confirmed stage activity" : delayedPerformance ? "Performance delayed" : "No confirmed live performance";

  const facilities = [
    { label: "Travel & arrival", icon: "🚌", details: visitorInformation.travel },
    { label: "Camping", icon: "⛺", details: visitorInformation.camping },
    { label: "Food & drink", icon: "🍲", details: visitorInformation.foodAndDrink },
    { label: "Accessibility", icon: "♿", details: visitorInformation.accessibility },
  ].filter((facility) => facility.details?.trim());

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
          <FestivalStageSchematic stages={stages} selectedStageId={selectedStage?.id} attendanceBand={verifiedLive?.attendanceBand} performances={live.isError ? [] : verifiedLive?.performances} stageCrowds={stageCrowds} localHour={localHour} onSelectStage={setSelectedStageId} />
          <div className="rounded-2xl border bg-card p-5" aria-live="polite">
            <h3 className="text-xl font-bold">{selectedStage?.name}</h3>
            {selectedStage && <p className="mt-1 text-sm text-muted-foreground">Stage capacity: {selectedStage.capacity.toLocaleString("en-GB")}</p>}
            <div className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3" role="status">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{scheduleLabel}</p>
              {scheduledNow || scheduledNext ? (
                <>
                  <p className="mt-1 font-bold">{(scheduledNow ?? scheduledNext)!.artistName}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date((scheduledNow ?? scheduledNext)!.startsAt!))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Based on published timetable, not live stage confirmation.</p>
                </>
              ) : <p className="mt-1 text-sm text-muted-foreground">Check back for programme updates.</p>}
            </div>
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3" role="status">
              <p className="text-xs font-semibold uppercase tracking-wider">Festival live status</p>
              {live.isPending ? <p className="mt-1 text-sm">Checking official stage status…</p> : live.isError ? (
                <p className="mt-1 text-sm">Official live updates are unavailable. The schedule below may have changed.</p>
              ) : !verifiedLive ? <p className="mt-1 text-sm">No verified live status for this edition.</p> : (
                <>
                  <p className="mt-1 font-semibold">{liveStatusLabel}</p>
                  {liveStatus && <p className="text-sm">{liveStatus.artistName}{liveStatus.status === "delayed" ? ` · ${liveStatus.delayMinutes} minute delay` : ""}</p>}
                  {cancelledPerformances.length > 0 && <p className="mt-1 text-sm">{cancelledPerformances.length} cancelled performance{cancelledPerformances.length === 1 ? "" : "s"} reported for this stage.</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Runtime: {verifiedLive.runtimeStatus.replaceAll("_", " ")} · Gates {verifiedLive.gatesStatus}</p>
                </>
              )}
            </div>
            <div className="mt-4 rounded-lg border bg-muted/30 p-3">
              <h4 className="text-sm font-semibold">Crowd at this stage</h4>
              {selectedCrowd ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>{FESTIVAL_STAGE_CROWD_BANDS[selectedCrowd.crowdBand].label}</span>
                    <span>Mood: {FESTIVAL_STAGE_CROWD_MOODS[selectedCrowd.mood]}</span>
                  </div>
                  <div className="mt-2 flex gap-1" role="img" aria-label={`Stage crowd density: ${FESTIVAL_STAGE_CROWD_BANDS[selectedCrowd.crowdBand].label}`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <span key={index} aria-hidden="true" className={`h-2 flex-1 rounded-sm ${index < FESTIVAL_STAGE_CROWD_BANDS[selectedCrowd.crowdBand].intensity ? "bg-emerald-500" : "bg-muted"}`} />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Reported in-game stage crowd band and mood, not a headcount or safety assessment.</p>
                </>
              ) : <p className="mt-2 text-sm text-muted-foreground">{experience.isPending ? "Checking stage crowd updates…" : "No verified crowd update for this stage."}</p>}
            </div>
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
      <section aria-labelledby="festival-visitor-facilities-title" className="space-y-3">
        <h3 id="festival-visitor-facilities-title" className="text-xl font-bold">Plan your festival visit</h3>
        {facilities.length === 0 ? (
          <p className="rounded-xl border p-4 text-sm text-muted-foreground">Visitor facilities and travel information have not been published yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {facilities.map((facility) => (
              <article key={facility.label} className="rounded-xl border bg-card p-4">
                <h4 className="font-semibold"><span aria-hidden="true">{facility.icon}</span> {facility.label}</h4>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{facility.details}</p>
              </article>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Locations and walking routes will appear only when the organiser publishes a verified site layout.</p>
      </section>
    </section>
  );
}
