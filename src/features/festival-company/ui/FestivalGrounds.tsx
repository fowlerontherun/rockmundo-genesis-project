import { useEffect, useState } from "react";
import { FestivalStageSchematic } from "./FestivalStageSchematic";
import { usePublicFestivalLiveStatus, usePublicFestivalLiveExperience } from "../application/useFestivalRuntime";
import type { FestivalPublicConfirmedAct, FestivalPublicStage } from "../domain/festivalLaunch";
import { festivalCrowdBandLabels, festivalCrowdMoodLabels, readPublicFestivalStageCrowds, filterPublicFestivalStageCrowdsForUniqueStages } from "../domain/publicFestivalStageCrowds";
import { stageTimetableProgress } from "../domain/stageTimetableProgress";
import { festivalLiveSnapshotFreshness } from "../domain/festivalLiveSnapshotFreshness";
import { FESTIVAL_WEATHER_STATES, type FestivalRuntimeWeatherState } from "../domain/festivalRuntime";
import { formatFestivalEditionDate, getFestivalLocalClockHour, festivalTimeZoneLabel } from "./festivalPublicDisplay";

interface FestivalGroundsProps {
  slug: string;
  festivalLaunchId: string;
  festivalEditionId: string | null;
  cancelled: boolean;
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
export function FestivalGrounds({ slug, festivalLaunchId, festivalEditionId, cancelled, stages, lineup, timezone, visitorInformation, onViewTimetable }: FestivalGroundsProps) {
  // A cancelled edition cannot have active live-stage observations. Keep the
  // historic programme while avoiding unnecessary runtime polling.
  const live = usePublicFestivalLiveStatus(cancelled ? "" : slug);
  const experience = usePublicFestivalLiveExperience(cancelled ? "" : slug);
  const raw = experience.data;
  const record = !experience.isError && raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
  const freshness = festivalLiveSnapshotFreshness(record, Date.now());
  const staleLive = freshness === "stale";
  const unverifiedLive = Boolean(record) && freshness === "unavailable";
  const suppressObservations = staleLive || unverifiedLive;
  const verified = !cancelled && !live.isError && !suppressObservations && festivalEditionId !== null &&
    record?.festivalLaunchId === festivalLaunchId && record?.editionId === festivalEditionId ? record : null;
  const verifiedLive = verified && live.data?.festivalLaunchId === festivalLaunchId ? live.data : null;
  const showRefreshAction = !cancelled && (suppressObservations || live.isError || experience.isError);
  const stageCrowds = filterPublicFestivalStageCrowdsForUniqueStages(readPublicFestivalStageCrowds(verified, festivalLaunchId), stages);
  const value = verified?.weather;
  const weather = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const weatherNames: Record<string, string> = { clear: "Clear skies", cloudy: "Cloudy", light_rain: "Light rain", heavy_rain: "Heavy rain", hot: "Hot", cold: "Cold", high_wind: "High winds", storm: "Storm" };
  const weatherIcons: Record<string, string> = { clear: "☀️", cloudy: "☁️", light_rain: "🌦️", heavy_rain: "🌧️", hot: "🌞", cold: "❄️", high_wind: "💨", storm: "⛈️" };
  const weatherState: FestivalRuntimeWeatherState | null = typeof weather?.state === "string" && (FESTIVAL_WEATHER_STATES as readonly string[]).includes(weather.state) ? weather.state as FestivalRuntimeWeatherState : null;
  const groundCondition = typeof weather?.groundCondition === "string" ? weather.groundCondition : null;
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  // Clock-based visual styling only; not astronomical sunrise/sunset or weather.
  const localHour = getFestivalLocalClockHour(currentTime, timezone);
  const selectedStage = stages.find((stage) => stage.id === selectedStageId) ?? stages[0];
  const selectedCrowd = selectedStage
    ? stageCrowds.find((item) => item.stageName.toLocaleLowerCase("en-GB") === selectedStage.name.trim().toLocaleLowerCase("en-GB"))
    : undefined;
  const acts = selectedStage
    ? lineup.filter((entry) => entry.stageName === selectedStage.name)
      .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""))
    : [];

  const schedule = stageTimetableProgress(selectedStage?.name ?? "", lineup, currentTime);
  const scheduleLabel = cancelled ? "Festival cancelled · archived programme"
    : schedule.kind === "scheduled_now" ? "Scheduled now (not live confirmed)"
    : schedule.kind === "next" ? "Next scheduled set"
    : schedule.kind === "finished" ? "Published sets finished" : "No published stage times";

  const livePerformances = verifiedLive && selectedStage
    ? verifiedLive.performances.filter((entry) => entry.stageName === selectedStage.name)
    : [];
  const livePerformance = livePerformances.find((entry) => entry.status === "live" || entry.status === "starting");
  const delayedPerformance = livePerformances.find((entry) => entry.status === "delayed");
  const cancelledPerformances = livePerformances.filter((entry) => entry.status === "cancelled");
  const liveStatus = livePerformance ?? delayedPerformance;
  const liveStatusLabel = livePerformance ? "Confirmed stage activity" : delayedPerformance ? "Performance delayed"
    : verifiedLive?.runtimeStatus === "runtime_complete" ? "Festival completed"
    : verifiedLive?.currentDay === null ? "No active festival day" : "No confirmed live performance";

  const lastRuntimeUpdate = verified && typeof verified.updatedAt === "string" && Number.isFinite(Date.parse(verified.updatedAt)) ? verified.updatedAt : null;

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
      <div className="rounded-xl border bg-card p-4" aria-label="Festival site weather">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden="true">{weatherState ? weatherIcons[weatherState] : "❔"}</span>
          <div>
            <h3 className="font-semibold">Festival site conditions</h3>
            <p className="text-sm">{weatherState ? weatherNames[weatherState] : "Weather information unavailable"}</p>
            {groundCondition && <p className="text-xs text-muted-foreground">Ground: {groundCondition.replaceAll("_", " ")}</p>}
            <p className="text-xs text-muted-foreground">Festival runtime conditions, not a live forecast.</p>
          </div>
        </div>
      </div>
      {stages.length === 0 ? (
        <p className="rounded-xl border p-5 text-muted-foreground">The festival grounds and stages have not been announced yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <FestivalStageSchematic stages={stages} lineup={lineup} now={currentTime} timezone={timezone} selectedStageId={selectedStage?.id} attendanceBand={verifiedLive?.attendanceBand} performances={live.isError ? [] : verifiedLive?.performances} stageCrowds={stageCrowds} weatherState={weatherState} localHour={localHour} cancelled={cancelled} onSelectStage={setSelectedStageId} />
          <div className="rounded-2xl border bg-card p-5" aria-live="polite">
            <h3 className="text-xl font-bold">{selectedStage?.name}</h3>
            {selectedStage && <p className="mt-1 text-sm text-muted-foreground">Stage capacity: {selectedStage.capacity.toLocaleString("en-GB")}</p>}
            <div className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3" role="status">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{scheduleLabel}</p>
              {schedule.act ? (
                <>
                  <p className="mt-1 font-bold">{schedule.act.artistName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFestivalEditionDate(schedule.act.startsAt!, timezone, { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                  {!cancelled && schedule.kind === "scheduled_now" && schedule.progressPercent !== null && (
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Published set time elapsed: {schedule.progressPercent}%</p>
                      <div role="img" aria-label={`Published set time elapsed: ${schedule.progressPercent} percent, not a confirmed live performance`} className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-violet-500" style={{ width: `${schedule.progressPercent}%` }} />
                      </div>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">{cancelled ? "These are archived planned times. The festival was cancelled; this is not a performance announcement." : "Based on published timetable, not live stage confirmation."}</p>
                </>
              ) : <p className="mt-1 text-sm text-muted-foreground">{schedule.kind === "finished" ? "All published stage sets have passed." : "Check back for programme updates."}</p>}
            </div>
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3" role="status">
              <p className="text-xs font-semibold uppercase tracking-wider">Festival live status</p>
              {cancelled ? <p className="mt-1 text-sm">This festival was cancelled. No performances are currently scheduled to take place.</p> : live.isPending || experience.isPending ? <p className="mt-1 text-sm">Checking official stage status…</p> : staleLive ? (
                <p className="mt-1 text-sm">The last festival runtime update is too old to confirm current stage activity. Published timetable information remains available.</p>
              ) : unverifiedLive ? (
                <p className="mt-1 text-sm">Official runtime freshness could not be verified. Live stage information is hidden until it can be checked.</p>
              ) : live.isError || experience.isError ? (
                <p className="mt-1 text-sm">Official live updates are unavailable. The schedule below may have changed.</p>
              ) : !verifiedLive ? <p className="mt-1 text-sm">No verified live status for this edition.</p> : (
                <>
                  <p className="mt-1 font-semibold">{liveStatusLabel}</p>
                  {liveStatus && <p className="text-sm">{liveStatus.artistName}{liveStatus.status === "delayed" ? ` · ${liveStatus.delayMinutes} minute delay` : ""}</p>}
                  {cancelledPerformances.length > 0 && <p className="mt-1 text-sm">{cancelledPerformances.length} cancelled performance{cancelledPerformances.length === 1 ? "" : "s"} reported for this stage.</p>}
                  <p className="mt-1 text-xs text-muted-foreground">Runtime: {verifiedLive.runtimeStatus.replaceAll("_", " ")} · Gates {verifiedLive.gatesStatus}</p>
                  {lastRuntimeUpdate && <p className="mt-1 text-xs text-muted-foreground">Last runtime update: {formatFestivalEditionDate(lastRuntimeUpdate, timezone, { dateStyle: "medium", timeStyle: "short" })} ({festivalTimeZoneLabel(timezone)})</p>}
                </>
              )}
              {showRefreshAction && (
                <button type="button" className="mt-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { void live.refetch(); void experience.refetch(); }}>
                  Retry live festival updates
                </button>
              )}
            </div>
            <div className="mt-4 rounded-lg border bg-muted/30 p-3">
              <h4 className="text-sm font-semibold">Stage audience snapshot</h4>
              {selectedCrowd ? (
                <>
                  <p className="mt-1 text-sm">Reported crowd: <strong>{festivalCrowdBandLabels[selectedCrowd.crowdBand]}</strong></p>
                  <p className="text-sm">Audience mood: <strong>{festivalCrowdMoodLabels[selectedCrowd.mood]}</strong></p>
                  <div className="mt-2 flex gap-1" role="img" aria-label={`Reported stage audience: ${festivalCrowdBandLabels[selectedCrowd.crowdBand]}`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <span key={index} aria-hidden="true" className={`h-2 flex-1 rounded-sm ${index < ({ quiet: 1, building: 2, busy: 3, very_busy: 4, near_capacity: 5, full: 5 }[selectedCrowd.crowdBand]) ? "bg-emerald-500" : "bg-muted"}`} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Snapshot: {formatFestivalEditionDate(selectedCrowd.lastCalculatedAt, timezone, { dateStyle: "medium", timeStyle: "short" })} ({festivalTimeZoneLabel(timezone)}).
                    Not a live headcount or queue estimate.
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">No unambiguous stage crowd snapshot is available.</p>
              )}
            </div>
            <h4 className="mt-5 font-semibold">Announced artists</h4>
            {acts.length ? (
              <ul className="mt-3 space-y-3">
                {acts.map((act) => (
                  <li key={act.id} className="rounded-lg border p-3">
                    <span className="block font-medium">{act.artistName}</span>
                    <span className="text-xs text-muted-foreground">
                      {act.startsAt
                        ? formatFestivalEditionDate(act.startsAt, timezone, { dateStyle: "medium", timeStyle: "short" })
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
      <details className="rounded-xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">About live festival updates and accessibility</summary>
        <div className="mt-3 space-y-2 text-muted-foreground">
          <p>The published timetable shows planned set times, not proof that an artist has taken the stage. Verified live indicators appear only when the festival runtime reports them.</p>
          <p>If live updates are unavailable or outdated, the timetable and stage directory remain usable. Use “Retry live festival updates” above to reconnect. No estimated crowd sizes are shown as facts.</p>
          <p>The stage pictures are illustrative. They are not a site map or walking directions. Please use the organiser’s published travel and accessibility information for your visit.</p>
          <button type="button" onClick={onViewTimetable} className="rounded-md border px-3 py-2 font-medium text-foreground hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            Open published timetable
          </button>
        </div>
      </details>
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
