import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FestivalRuntimeProjection } from "./model";
import { advanceCanonicalFestivalLiveDay, type LiveDayAction, type LiveDayRequest } from "./service";

const actions: Partial<Record<FestivalRuntimeProjection["state"], Array<[LiveDayAction, string]>>> = {
  gates_open: [["start_live", "Start live programme"], ["close", "Close gates"], ["cancel", "Cancel festival"]],
  live: [["pause", "Pause"], ["close", "Close gates"], ["cancel", "Cancel festival"]],
  paused: [["resume", "Resume"], ["close", "Close gates"], ["cancel", "Cancel festival"]],
  closing: [["finish", "Confirm completion and settle"], ["cancel", "Cancel festival"]],
};

export function CanonicalLiveDayOperations({
  runtime,
  canAllocate,
  onUpdate,
}: {
  runtime: FestivalRuntimeProjection;
  canAllocate: boolean;
  onUpdate: (runtime: FestivalRuntimeProjection) => void;
}) {
  const [request, setRequest] = useState<LiveDayRequest | null>(null);
  const mutation = useMutation({
    mutationFn: advanceCanonicalFestivalLiveDay,
    onSuccess: (updated) => {
      setRequest(null);
      onUpdate(updated);
    },
  });
  const choices = actions[runtime.state];
  if (!choices) return null;

  const submit = (
    action: LiveDayAction,
    attendance?: Pick<LiveDayRequest, "arrivals" | "departures" | "stageCounts" | "otherZones">,
  ) => {
    const next = {
      runtimeId: runtime.runtimeId,
      version: runtime.version,
      requestId: crypto.randomUUID(),
      action,
      ...attendance,
    };
    setRequest(next);
    mutation.mutate(next);
  };

  function recordAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stageCounts = canAllocate
      ? Object.fromEntries(runtime.stages.map((stage) => [stage.id, Number(form.get(stage.id))]))
      : {};
    submit("tick", {
      arrivals: Number(form.get("arrivals")),
      departures: Number(form.get("departures")),
      otherZones: Number(form.get("otherZones")),
      stageCounts,
    });
  }

  return (
    <Card>
      <CardHeader><CardTitle>Live festival operations</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Record counted arrivals and departures since the last observation. Stage and other-area counts must add up to everyone currently onsite.
        </p>
        <form onSubmit={recordAttendance}>
          <fieldset disabled={mutation.isPending || request !== null} className="grid gap-3 sm:grid-cols-2">
            {canAllocate && <CountInput name="arrivals" label="Arrivals" initial={0} />}
            <CountInput name="departures" label="Departures" initial={0} />
            {canAllocate && runtime.stages.map((stage) => (
              <CountInput key={stage.id} name={stage.id} label={stage.name} />
            ))}
            <CountInput name="otherZones" label="People in other areas" />
            <Button type="submit">Record attendance</Button>
          </fieldset>
        </form>
        <div className="flex flex-wrap gap-2">
          {choices.map(([action, label]) => (
            <Button
              key={action}
              variant={action === "cancel" ? "destructive" : "outline"}
              disabled={mutation.isPending || request !== null}
              onClick={() => {
                if ((action === "cancel" || action === "finish") && !window.confirm(label + "?")) return;
                submit(action);
              }}
            >{label}</Button>
          ))}
        </div>
        {mutation.isError && request && (
          <div role="alert" className="space-y-2 text-sm">
            <p>{(mutation.error as { message?: string }).message ?? "The operation could not be confirmed."}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => mutation.mutate(request)}>Retry same request</Button>
              <Button variant="ghost" onClick={() => { setRequest(null); mutation.reset(); }}>Dismiss</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CountInput({ name, label, initial }: { name: string; label: string; initial?: number }) {
  return (
    <label className="grid gap-1.5 text-sm">
      {label}
      <Input type="number" name={name} required min={0} max={99_999_999} step={1} defaultValue={initial} />
    </label>
  );
}
