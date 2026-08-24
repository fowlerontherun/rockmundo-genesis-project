import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAdminAuditEvents } from "../hooks";
import { fetchFestivalEditionAuditLog } from "../lifecycleB5";
import { asArray, asObject, text, WorkflowState } from "./workflowUtils";

export function FestivalAuditLog() {
  const [actor, setActor] = useState("");
  const [operation, setOperation] = useState("");
  const [edition, setEdition] = useState("");
  const [date, setDate] = useState("");
  const [severity, setSeverity] = useState("");
  const filters = { actor, operation, edition, date, severity };
  const legacy = useAdminAuditEvents(filters);
  const canonical = useQuery({
    queryKey: ["festivals", "admin", "canonical-edition-audit", edition],
    queryFn: () => fetchFestivalEditionAuditLog(edition.trim()),
    enabled: Boolean(edition.trim()),
  });

  const events = useMemo(() => {
    const source = edition.trim()
      ? (canonical.data ?? [])
      : asArray(asObject(legacy.data).events);
    return source.filter((event: any) => {
      const actorValue = String(event.actor_name ?? event.actor_profile_id ?? "").toLowerCase();
      const operationValue = String(event.operation ?? event.action ?? "").toLowerCase();
      const created = String(event.created_at ?? "");
      return (!actor || actorValue.includes(actor.toLowerCase()))
        && (!operation || operationValue.includes(operation.toLowerCase()))
        && (!date || created.startsWith(date));
    });
  }, [actor, operation, date, edition, canonical.data, legacy.data]);

  const loading = edition.trim() ? canonical.isLoading : legacy.isLoading;
  const error = edition.trim() ? canonical.error : legacy.error;
  if (loading) return <WorkflowState title="Loading audit" message="Loading festival audit events…" />;
  if (error) return <WorkflowState title="Audit unavailable" message={String(error)} variant="destructive" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Festival audit log</CardTitle>
        <CardDescription>
          Enter an edition ID to use the permission-checked canonical B5 audit stream. Leave it blank for the platform-wide admin view.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-5">
          <Input placeholder="Actor" value={actor} onChange={(event) => setActor(event.target.value)} />
          <Input placeholder="Operation" value={operation} onChange={(event) => setOperation(event.target.value)} />
          <Input placeholder="Edition ID" value={edition} onChange={(event) => setEdition(event.target.value)} />
          <Input placeholder="Date YYYY-MM-DD" value={date} onChange={(event) => setDate(event.target.value)} />
          <Input placeholder="Severity (platform view)" value={severity} onChange={(event) => setSeverity(event.target.value)} />
        </div>
        {edition.trim() && <Button variant="outline" size="sm" onClick={() => canonical.refetch()}>Refresh canonical audit</Button>}
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit events match the filters.</p>
        ) : events.map((event: any) => (
          <div key={event.id} className="rounded border p-3 text-sm">
            <p>{text(event.actor_name ?? event.actor_profile_id)} · {text(event.authority)} · {text(event.operation ?? event.action)} · {text(event.created_at)}</p>
            <p>Target {text(event.target_type ?? event.target_table)}:{text(event.target_id)}</p>
            <p className="text-muted-foreground">Reason {text(event.reason)}</p>
            {(event.before_snapshot || event.after_snapshot) && (
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Before / after evidence</summary>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap">{JSON.stringify({ before: event.before_snapshot, after: event.after_snapshot }, null, 2)}</pre>
              </details>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
