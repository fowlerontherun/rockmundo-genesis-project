import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  confirmCanonicalStageAction,
  getCanonicalStageControl,
  type CanonicalStageStatus,
} from "./service";

const commands: Record<CanonicalStageStatus | "unconfirmed", CanonicalStageStatus[]> = {
  unconfirmed: ["ready", "cancelled"],
  ready: ["starting", "delayed", "cancelled"],
  starting: ["live", "delayed", "cancelled"],
  live: ["completed", "delayed", "cancelled"],
  delayed: ["starting", "live", "cancelled"],
  completed: [],
  cancelled: [],
};

const actionLabels: Record<CanonicalStageStatus, string> = {
  ready: "Confirm stage ready",
  starting: "Confirm starting",
  live: "Confirm performing",
  delayed: "Report delay",
  completed: "Confirm completed",
  cancelled: "Cancel performance",
};

export function CanonicalStageControl({
  runtimeId,
}: {
  runtimeId: string;
}) {
  const cache = useQueryClient();
  const key = ["festival", "canonical-stage-control", runtimeId] as const;
  const query = useQuery({
    queryKey: key,
    queryFn: () => getCanonicalStageControl(runtimeId),
    refetchInterval: 10_000,
  });
  const mutation = useMutation({
    mutationFn: confirmCanonicalStageAction,
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: key });
    },
  });
  const data = query.data;
  const writable = data?.runtimeState === "live" || data?.runtimeState === "gates_open";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Official stage confirmations</CardTitle>
        <p className="text-sm text-muted-foreground">
          The published running order is not evidence of a live performance.
          Confirm actual stage changes here; they are recorded in the canonical Festival runtime.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isPending && <p role="status">Checking verified stage events…</p>}
        {query.isError && <p role="alert">Official stage control is unavailable. No live claims are being made.</p>}
        {data?.runtimeState === "paused" && (
          <p role="status">Festival paused. Stage actions are disabled until the runtime resumes.</p>
        )}
        {mutation.isError && (
          <p role="alert" className="text-destructive">
            The stage action was rejected. Refresh the stage state before retrying.
          </p>
        )}
        {data?.items.length === 0 && <p>No acts are scheduled for the current festival day.</p>}
        {data?.items.map(item => {
          const state = item.status ?? "unconfirmed";
          const allowed = commands[state];
          // The canonical server enforces the same state machine, authorization and runtime version.
          const transitions = writable
            ? allowed.filter(next => next === "ready" || data.runtimeState === "live")
            : [];
          return (
            <section key={item.scheduleItemId} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{item.artistName}</p>
                  <p className="text-sm text-muted-foreground">{item.stageName}</p>
                </div>
                <Badge variant={item.status === "live" && writable ? "default" : "outline"}>
                  {item.status && writable ? "Confirmed: " + item.status : "No current live confirmation"}
                </Badge>
              </div>
              {item.observedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Last confirmed: {item.observedAt}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {transitions.map(next => (
                  <Button
                    type="button"
                    size="sm"
                    variant={next === "cancelled" ? "destructive" : "outline"}
                    key={next}
                    disabled={mutation.isPending}
                    onClick={() => {
                      if (!window.confirm(`Confirm that ${item.artistName} is ${next} at ${item.stageName}? This records an official stage event.`)) return;
                      mutation.mutate({
                        runtimeId: data.runtimeId,
                        stageId: item.stageId,
                        scheduleItemId: item.scheduleItemId,
                        status: next,
                        expectedRuntimeVersion: data.runtimeVersion,
                        idempotencyKey: crypto.randomUUID(),
                      });
                    }}
                  >
                    {actionLabels[next]}
                  </Button>
                ))}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
