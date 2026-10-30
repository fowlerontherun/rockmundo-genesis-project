import { useState } from "react";
import type { FestivalPublicConfirmedAct } from "../domain/festivalLaunch";
import {
  filterPublishedFestivalTimetable,
  festivalTimetableOptions,
  publishedStageOverlapIds,
} from "../domain/festivalTimetableFilters";
import { formatFestivalEditionTime, festivalTimeZoneLabel } from "./festivalPublicDisplay";

interface Props {
  performances: FestivalPublicConfirmedAct[];
  timezone: string;
  now: number;
  cancelled: boolean;
}

const dayLabel = (day: string) => new Date(day + "T12:00:00Z").toLocaleDateString(
  "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" },
);

export function FestivalPublishedTimetable({ performances, timezone, now, cancelled }: Props) {
  const [stageName, setStageName] = useState("");
  const [festivalDate, setFestivalDate] = useState("");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [limit, setLimit] = useState(12);
  const options = festivalTimetableOptions(performances);
  const filtered = filterPublishedFestivalTimetable(performances, { stageName, festivalDate, upcomingOnly: cancelled ? false : upcomingOnly }, now);
  const conflicts = publishedStageOverlapIds(performances);
  const visible = filtered.slice(0, limit);
  const firstUpcoming = filtered.find((act) => Date.parse(act.startsAt!) > now);

  return (
    <section aria-label="Published festival performance timetable" className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Published timetable</h2>
        <p className="text-sm text-muted-foreground">
          {cancelled
            ? "This edition was cancelled. Its previously published programme is retained for reference only; none of these times are upcoming performances."
            : <>These are the announced stage times in {festivalTimeZoneLabel(timezone)}. Scheduled now does not confirm a live show.</>}
        </p>
      </div>
      {performances.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          Performance times and stages have not been published yet. See the confirmed line-up for announced acts.
        </p>
      ) : (
        <>
          <div className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-sm font-medium">
              <span>Stage</span>
              <select aria-label="Filter timetable by stage" value={stageName} onChange={(e) => { setStageName(e.target.value); setLimit(12); }} className="w-full rounded-md border bg-background px-2 py-2">
                <option value="">All stages</option>
                {options.stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>Festival day</span>
              <select aria-label="Filter timetable by festival day" value={festivalDate} onChange={(e) => { setFestivalDate(e.target.value); setLimit(12); }} className="w-full rounded-md border bg-background px-2 py-2">
                <option value="">All days</option>
                {options.days.map((day) => <option key={day} value={day}>{dayLabel(day)}</option>)}
              </select>
            </label>
            {!cancelled && <label className="flex items-center gap-2 self-end rounded-md border px-3 py-2 text-sm">
              <input type="checkbox" checked={upcomingOnly} onChange={(e) => { setUpcomingOnly(e.target.checked); setLimit(12); }} />
              Show sets still in progress or upcoming
            </label>}
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filtered.length} published set{filtered.length === 1 ? "" : "s"} match your filters.
          </p>
          {filtered.length === 0 ? (
            <div className="rounded-lg border p-4 text-sm">
              No published sets match those filters.
              <button type="button" className="ml-2 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { setStageName(""); setFestivalDate(""); setUpcomingOnly(false); setLimit(12); }}>Clear filters</button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {visible.map((entry) => {
                  const current = !cancelled && Date.parse(entry.startsAt!) <= now && now < Date.parse(entry.endsAt!);
                  const next = !cancelled && firstUpcoming?.id === entry.id;
                  const overlaps = conflicts.has(entry.id);
                  return (
                    <article key={entry.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <time dateTime={entry.startsAt!} className="min-w-24 text-sm">
                            <span className="block text-xs text-muted-foreground">{entry.festivalDate ? dayLabel(entry.festivalDate) : "Date pending"}</span>
                            <span className="block font-bold">{formatFestivalEditionTime(entry.startsAt!, timezone)}</span>
                          </time>
                          <div className="min-w-0">
                            <strong className="break-words">{entry.artistName}</strong>
                            <p className="text-sm text-muted-foreground">{entry.stageName}</p>
                          </div>
                        </div>
                        {cancelled ? <span className="rounded-full border border-amber-400/40 px-2 py-1 text-xs font-semibold">Cancelled edition · archived programme</span>
                          : current ? <span className="rounded-full border border-violet-400/40 px-2 py-1 text-xs font-semibold">Scheduled now · not live confirmed</span>
                          : next ? <span className="rounded-full border border-sky-400/40 px-2 py-1 text-xs font-semibold">Next scheduled set</span> : null}
                      </div>
                      {overlaps && (
                        <p role="note" className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                          Published times overlap with another act on this stage. The organiser may update the timetable.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
              {filtered.length > limit && (
                <button type="button" className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => setLimit((value) => value + 12)}>
                  Show more sets ({filtered.length - limit} remaining)
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
