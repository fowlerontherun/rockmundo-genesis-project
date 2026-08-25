import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FestivalPlayerAttendance } from "./festivalAttendance";
import { FestivalConditionPanel } from "./FestivalConditionPanel";
import {
  useChooseFestivalMomentOption,
  useMyFestivalMoments,
  useResolveFestivalMomentOutcome,
  useTriggerFestivalMoment,
} from "./useFestivalMoments";

const readableError = (error: Error) => error.message.replaceAll("_", " ");

export const FestivalModeMoments = ({ attendance }: { attendance: FestivalPlayerAttendance }) => {
  const { data, isLoading, isError } = useMyFestivalMoments(attendance.id);
  const trigger = useTriggerFestivalMoment(attendance.id);
  const choose = useChooseFestivalMomentOption(attendance.id);
  const resolve = useResolveFestivalMomentOutcome(attendance.id);
  const serverNow = data ? Date.parse(data.serverNow) : Date.now();
  const pending = data?.items.some((item) => item.status === "pending" || item.status === "choice_made") ?? false;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card p-5 md:p-7">
        <Badge variant="secondary">Festival Mode</Badge>
        <h1 className="mt-3 text-3xl font-black">Festival moments</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Discover small encounters and choices shaped by what you have been doing around the festival. Social moments respect player blocks and never create friendships automatically.
        </p>
        <Button
          className="mt-4"
          type="button"
          disabled={trigger.isPending || pending}
          onClick={() => trigger.mutate({ idempotencyKey: crypto.randomUUID() })}
        >
          {trigger.isPending ? "Looking…" : pending ? "Finish your current moment" : "Find a moment"}
        </Button>
        {trigger.isError && <p className="mt-2 text-sm text-destructive" role="alert">{readableError(trigger.error)}</p>}
      </section>

      <FestivalConditionPanel attendanceId={attendance.id} />

      <Card>
        <CardHeader><CardTitle className="text-base">Recent moments</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground" role="status">Loading Festival moments…</p>
          ) : isError || !data ? (
            <p className="text-sm text-destructive" role="alert">Festival moments could not be loaded.</p>
          ) : data.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No moments yet. Find one when you have some free time.</p>
          ) : data.items.map((moment) => {
            const due = moment.outcomeDueAt ? Date.parse(moment.outcomeDueAt) <= serverNow : false;
            return (
              <article key={moment.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">{moment.category.replaceAll("_", " ")}</Badge>
                  <Badge variant={moment.status === "resolved" ? "default" : "secondary"} className="capitalize">{moment.status.replaceAll("_", " ")}</Badge>
                </div>
                <h2 className="mt-3 font-semibold">{moment.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{moment.body}</p>

                {moment.status === "pending" && (
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    {moment.options.map((option) => (
                      <Button
                        key={option.id}
                        type="button"
                        variant="outline"
                        className="h-auto items-start justify-start whitespace-normal py-3 text-left"
                        disabled={choose.isPending}
                        onClick={() => choose.mutate({ momentId: moment.id, optionId: option.id })}
                      >
                        <span><strong>{option.label}</strong><span className="mt-1 block text-xs font-normal text-muted-foreground">{option.description}</span></span>
                      </Button>
                    ))}
                  </div>
                )}

                {moment.status === "choice_made" && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      {due ? "The outcome is ready." : "Your choice has been locked in. This outcome will unfold shortly."}
                    </p>
                    {due && (
                      <Button className="mt-2" size="sm" disabled={resolve.isPending} onClick={() => resolve.mutate({ momentId: moment.id })}>
                        {resolve.isPending ? "Resolving…" : "See what happens"}
                      </Button>
                    )}
                  </div>
                )}

                {moment.status === "resolved" && moment.outcome && (
                  <p className="mt-3 text-sm text-emerald-600">Moment resolved. Any bounded Festival-condition effects have been applied.</p>
                )}
              </article>
            );
          })}

          {choose.isError && <p className="text-sm text-destructive" role="alert">{readableError(choose.error)}</p>}
          {resolve.isError && <p className="text-sm text-destructive" role="alert">{readableError(resolve.error)}</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default FestivalModeMoments;
