import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, Flag, Lock, Users } from "lucide-react";
import {
  type BandObjective,
  useBandObjectivesAndLineups,
  useCancelBandObjective,
  useCreateBandObjective,
  useFinaliseGigLineup,
  useRequestGigLineupCorrection,
  useResolveGigLineupCorrection,
  useSetGigLineup,
} from "@/hooks/useBandObjectivesAndLineups";

interface Props { bandId: string }

const objectiveLabels: Record<BandObjective["objective_type"], string> = {
  rehearsal_sessions: "Rehearsals",
  recording_sessions: "Recording sessions",
  gigs_performed: "Gigs performed",
};

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function BandObjectivesLineupsTab({ bandId }: Props) {
  const { data, isLoading, isError, error } = useBandObjectivesAndLineups(bandId);
  const createObjective = useCreateBandObjective(bandId);
  const cancelObjective = useCancelBandObjective(bandId);
  const setLineup = useSetGigLineup(bandId);
  const finaliseLineup = useFinaliseGigLineup(bandId);
  const requestCorrection = useRequestGigLineupCorrection(bandId);
  const resolveCorrection = useResolveGigLineupCorrection(bandId);

  const [objectiveType, setObjectiveType] = useState<BandObjective["objective_type"]>("rehearsal_sessions");
  const [objectiveTarget, setObjectiveTarget] = useState(3);
  const [objectiveTitle, setObjectiveTitle] = useState("");
  const [lineupDrafts, setLineupDrafts] = useState<Record<string, string[]>>({});
  const [correctionGigId, setCorrectionGigId] = useState("");
  const [correctionProfileId, setCorrectionProfileId] = useState("");
  const [correctionAction, setCorrectionAction] = useState<"add" | "remove">("add");
  const [correctionReason, setCorrectionReason] = useState("");

  const activeGigs = useMemo(() => (data?.gigs ?? []).filter((gig) => !["completed", "cancelled", "failed"].includes(gig.status ?? "")), [data?.gigs]);
  const stateByGig = useMemo(() => new Map((data?.states ?? []).map((state) => [state.gig_id, state])), [data?.states]);

  useEffect(() => {
    if (!data) return;
    const next: Record<string, string[]> = {};
    for (const gig of data.gigs) {
      next[gig.id] = data.performers.filter((performer) => performer.gig_id === gig.id).map((performer) => performer.profile_id);
    }
    setLineupDrafts(next);
    if (!correctionGigId && data.gigs[0]?.id) setCorrectionGigId(data.gigs[0].id);
    if (!correctionProfileId && data.members[0]?.profile_id) setCorrectionProfileId(data.members[0].profile_id);
  }, [data]);

  const memberName = (profileId: string) => {
    const member = data?.members.find((item) => item.profile_id === profileId);
    return member?.profiles?.display_name || member?.profiles?.username || "Band member";
  };

  const mutationError = [createObjective, cancelObjective, setLineup, finaliseLineup, requestCorrection, resolveCorrection]
    .map((mutation) => mutation.error)
    .find(Boolean);

  if (isLoading) return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>;
  if (isError || !data) return <Card className="border-destructive/40"><CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertCircle className="h-5 w-5" /> Unable to load band authority</CardTitle><CardDescription>{error instanceof Error ? error.message : "Please try again."}</CardDescription></CardHeader></Card>;

  const permissions = data.permissions;

  return (
    <div className="space-y-6">
      {mutationError ? <Card className="border-destructive/40"><CardContent className="p-4 text-sm text-destructive">{mutationError instanceof Error ? mutationError.message : "The band operation could not be completed."}</CardContent></Card> : null}

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Flag className="h-5 w-5" /> Shared objectives</CardTitle>
            <CardDescription>Progress advances only from verified rehearsals, recording sessions, and gig performances.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {permissions.can_manage_objectives ? (
              <div className="grid gap-2 rounded-lg border p-4 md:grid-cols-[1.2fr_100px_1fr_auto]">
                <select className="h-10 rounded-md border bg-background px-3 text-sm" value={objectiveType} onChange={(event) => setObjectiveType(event.target.value as BandObjective["objective_type"])}>
                  {Object.entries(objectiveLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <Input type="number" min={1} max={100} value={objectiveTarget} onChange={(event) => setObjectiveTarget(Number(event.target.value))} aria-label="Objective target" />
                <Input placeholder="Optional title" value={objectiveTitle} onChange={(event) => setObjectiveTitle(event.target.value)} />
                <Button disabled={createObjective.isPending} onClick={() => createObjective.mutate({ objectiveType, targetValue: objectiveTarget, title: objectiveTitle || undefined })}>Add</Button>
              </div>
            ) : null}

            {data.objectives.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No shared objectives yet.</p> : data.objectives.map((objective) => {
              const percent = Math.min(100, Math.round((objective.progress_value / objective.target_value) * 100));
              return (
                <div key={objective.id} className="space-y-2 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><p className="font-semibold">{objective.title}</p><p className="text-sm text-muted-foreground">{objectiveLabels[objective.objective_type]} · {objective.progress_value}/{objective.target_value}</p></div>
                    <div className="flex items-center gap-2"><Badge variant={objective.status === "completed" ? "default" : "secondary"}>{objective.status}</Badge>{permissions.can_manage_objectives && objective.status === "active" ? <Button size="sm" variant="ghost" onClick={() => cancelObjective.mutate(objective.id)}>Cancel</Button> : null}</div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Roles & authority</CardTitle><CardDescription>Your current band role controls authoritative mutations.</CardDescription></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span>Role</span><Badge variant="outline">{permissions.role || "member"}</Badge></div>
            {[['Manage objectives', permissions.can_manage_objectives], ['Manage lineup', permissions.can_manage_lineup], ['Finalise lineup', permissions.can_finalise_lineup], ['Resolve corrections', permissions.can_resolve_lineup_corrections], ['Request correction', permissions.can_request_correction]].map(([label, allowed]) => <div key={String(label)} className="flex items-center justify-between rounded-md border p-2"><span>{label}</span>{allowed ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}</div>)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Authoritative gig lineups</CardTitle><CardDescription>Leaders can edit a draft lineup. Once finalised, changes require an auditable correction request.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          {activeGigs.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming gigs require a lineup.</p> : activeGigs.map((gig) => {
            const state = stateByGig.get(gig.id);
            const isFinal = state?.status === "finalised";
            const selected = lineupDrafts[gig.id] ?? [];
            return (
              <div key={gig.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">Gig · {formatDate(gig.scheduled_date)}</p><p className="text-xs text-muted-foreground">Lineup version {state?.version ?? 1}</p></div><Badge variant={isFinal ? "default" : "secondary"}>{isFinal ? "Finalised" : "Draft"}</Badge></div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.members.map((member) => {
                    const checked = selected.includes(member.profile_id);
                    return <label key={member.profile_id} className="flex items-center gap-2 rounded-md border p-2 text-sm"><input type="checkbox" checked={checked} disabled={!permissions.can_manage_lineup || isFinal} onChange={(event) => setLineupDrafts((current) => ({ ...current, [gig.id]: event.target.checked ? [...(current[gig.id] ?? []), member.profile_id] : (current[gig.id] ?? []).filter((id) => id !== member.profile_id) }))} /><span>{memberName(member.profile_id)}</span><span className="ml-auto text-xs text-muted-foreground">{member.instrument_role || member.role || "member"}</span></label>;
                  })}
                </div>
                {permissions.can_manage_lineup && !isFinal ? <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={setLineup.isPending || selected.length === 0} onClick={() => setLineup.mutate({ gigId: gig.id, profileIds: selected })}>Save draft</Button><Button disabled={finaliseLineup.isPending || selected.length === 0} onClick={() => finaliseLineup.mutate(gig.id)}>Finalise lineup</Button></div> : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Lineup corrections</CardTitle><CardDescription>Use this after finalisation instead of silently rewriting performer history.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {permissions.can_request_correction ? <div className="grid gap-2">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={correctionGigId} onChange={(event) => setCorrectionGigId(event.target.value)}>{data.gigs.map((gig) => <option key={gig.id} value={gig.id}>{formatDate(gig.scheduled_date)}</option>)}</select>
              <div className="grid grid-cols-2 gap-2"><select className="h-10 rounded-md border bg-background px-3 text-sm" value={correctionAction} onChange={(event) => setCorrectionAction(event.target.value as "add" | "remove")}><option value="add">Add performer</option><option value="remove">Remove performer</option></select><select className="h-10 rounded-md border bg-background px-3 text-sm" value={correctionProfileId} onChange={(event) => setCorrectionProfileId(event.target.value)}>{data.members.map((member) => <option key={member.profile_id} value={member.profile_id}>{memberName(member.profile_id)}</option>)}</select></div>
              <Input placeholder="Reason for correction" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} />
              <Button variant="outline" disabled={requestCorrection.isPending || !correctionGigId || !correctionProfileId || correctionReason.trim().length < 3} onClick={() => requestCorrection.mutate({ gigId: correctionGigId, targetProfileId: correctionProfileId, action: correctionAction, reason: correctionReason })}>Request correction</Button>
            </div> : null}
            <div className="space-y-2">{data.corrections.filter((item) => item.status === "pending").map((item) => <div key={item.id} className="rounded-md border p-3 text-sm"><div className="flex items-center justify-between gap-2"><span>{item.requested_action === "add" ? "Add" : "Remove"} {memberName(item.target_profile_id)}</span><Badge variant="secondary">pending</Badge></div><p className="mt-1 text-muted-foreground">{item.reason}</p>{permissions.can_resolve_lineup_corrections ? <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => resolveCorrection.mutate({ requestId: item.id, decision: "approved" })}>Approve</Button><Button size="sm" variant="outline" onClick={() => resolveCorrection.mutate({ requestId: item.id, decision: "rejected" })}>Reject</Button></div> : null}</div>)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Chemistry & cohesion history</CardTitle><CardDescription>Bounded changes are created once per verified band activity, so members can see why the values moved.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {data.cohesion.length === 0 ? <p className="text-sm text-muted-foreground">No verified chemistry/cohesion changes recorded yet.</p> : data.cohesion.map((event) => <div key={event.id} className="rounded-md border p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{event.explanation}</span><span className="text-xs text-muted-foreground">{formatDate(event.occurred_at)}</span></div><p className="mt-1 text-muted-foreground">Chemistry {event.chemistry_delta >= 0 ? "+" : ""}{event.chemistry_delta} · Cohesion {event.cohesion_delta >= 0 ? "+" : ""}{event.cohesion_delta}</p></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
