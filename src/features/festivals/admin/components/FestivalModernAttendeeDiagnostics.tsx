import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const modernEditionSchema = z.object({
  editionId: z.string(),
  festivalCompanyId: z.string(),
  festivalName: z.string().nullable().optional(),
  editionName: z.string(),
  editionYear: z.coerce.number(),
  status: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
  city: z.string().nullable().optional(),
  currencyCode: z.string().nullable().optional(),
});

const attendeeSchema = z.object({
  attendanceId: z.string(),
  profileId: z.string(),
  status: z.string(),
  createdAt: z.string().nullable().optional(),
  checkedInAt: z.string().nullable().optional(),
  leftAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  ticketId: z.string().nullable().optional(),
  ticketStatus: z.string().nullable().optional(),
  scheduleActivityId: z.string().nullable().optional(),
  scheduleStatus: z.string().nullable().optional(),
  wristbandPresent: z.boolean().default(false),
  lifecycleVersion: z.coerce.number().default(0),
  lastTransitionSource: z.string().nullable().optional(),
  lastTransitionReason: z.string().nullable().optional(),
  lastTransitionAt: z.string().nullable().optional(),
  eventCount: z.coerce.number().default(0),
  issues: z.array(z.string()).default([]),
});

const diagnosticsSchema = z.object({
  festivalEditionId: z.string(),
  festivalCompanyId: z.string(),
  editionName: z.string(),
  editionStatus: z.string(),
  launchId: z.string().nullable().optional(),
  attendance: z.array(attendeeSchema).default([]),
  summary: z.object({
    total: z.coerce.number().default(0),
    attentionRequired: z.coerce.number().default(0),
    attending: z.coerce.number().default(0),
    completed: z.coerce.number().default(0),
  }),
});

type ModernEdition = z.infer<typeof modernEditionSchema>;
type Attendee = z.infer<typeof attendeeSchema>;

async function callRpc<T>(
  name: string,
  args: Record<string, unknown> | undefined,
  schema: z.ZodType<T>,
): Promise<T> {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new Error(`Invalid ${name} response`);
  return parsed.data;
}

async function fetchModernEditions(): Promise<ModernEdition[]> {
  return callRpc(
    "admin_modern_festival_editions",
    undefined,
    z.array(modernEditionSchema),
  );
}

async function fetchDiagnostics(editionId: string) {
  return callRpc(
    "admin_festival_attendee_diagnostics",
    { p_edition_id: editionId },
    diagnosticsSchema,
  );
}

async function reconcileAttendance(input: {
  editionId: string;
  attendanceId: string;
  reason: string;
}) {
  return callRpc(
    "admin_reconcile_festival_attendance",
    {
      p_edition_id: input.editionId,
      p_attendance_id: input.attendanceId,
      p_reason: input.reason,
      p_idempotency_key: `admin-attendance:${input.attendanceId}:${Date.now()}`,
    },
    z.record(z.unknown()),
  );
}

function issueLabel(issue: string) {
  switch (issue) {
    case "attending_ticket_not_used":
      return "Ticket not marked used";
    case "attending_missing_wristband":
      return "Missing wristband";
    case "attending_schedule_not_active":
      return "Schedule lock missing";
    case "terminal_attendance_has_active_schedule":
      return "Terminal visit still blocks schedule";
    default:
      return issue.replaceAll("_", " ");
  }
}

function AttendeeRow({
  attendee,
  editionId,
}: {
  attendee: Attendee;
  editionId: string;
}) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      reconcileAttendance({
        editionId,
        attendanceId: attendee.attendanceId,
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setReason("");
      qc.invalidateQueries({ queryKey: ["festival-admin-attendees", editionId] });
    },
  });
  const needsAttention = attendee.issues.length > 0;

  return (
    <Card className={needsAttention ? "border-amber-500/50" : undefined}>
      <CardContent className="space-y-3 p-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium">Character {attendee.profileId.slice(0, 8)}</p>
            <p className="text-xs text-muted-foreground">
              Attendance {attendee.attendanceId.slice(0, 8)} · {attendee.eventCount} lifecycle events
            </p>
          </div>
          <Badge variant={needsAttention ? "destructive" : "secondary"}>
            {attendee.status}
          </Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <p><span className="text-muted-foreground">Ticket:</span> {attendee.ticketStatus ?? "none"}</p>
          <p><span className="text-muted-foreground">Schedule:</span> {attendee.scheduleStatus ?? "none"}</p>
          <p><span className="text-muted-foreground">Wristband:</span> {attendee.wristbandPresent ? "present" : "missing"}</p>
        </div>

        {needsAttention ? (
          <div className="space-y-2 rounded-md border border-amber-500/30 p-3">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Recovery checks found {attendee.issues.length} issue{attendee.issues.length === 1 ? "" : "s"}
            </div>
            <div className="flex flex-wrap gap-2">
              {attendee.issues.map((issue) => (
                <Badge key={issue} variant="outline">{issueLabel(issue)}</Badge>
              ))}
            </div>
            <Label htmlFor={`reason-${attendee.attendanceId}`}>Admin recovery reason</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id={`reason-${attendee.attendanceId}`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why is this reconciliation required?"
              />
              <Button
                disabled={!reason.trim() || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {mutation.isPending ? "Reconciling…" : "Reconcile safely"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This does not force a lifecycle status. It only re-runs the existing server recovery checks and records an audited before/after snapshot.
            </p>
            {mutation.error && <p className="text-destructive">{String(mutation.error)}</p>}
          </div>
        ) : (
          <p className="text-muted-foreground">No lifecycle inconsistencies detected.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function FestivalModernAttendeeDiagnostics() {
  const editionsQuery = useQuery({
    queryKey: ["festival-admin-modern-editions"],
    queryFn: fetchModernEditions,
  });
  const editions = editionsQuery.data ?? [];
  const [selectedEditionId, setSelectedEditionId] = useState("");
  const effectiveEditionId = useMemo(
    () => selectedEditionId || editions[0]?.editionId || "",
    [editions, selectedEditionId],
  );
  const selectedEdition = editions.find((edition) => edition.editionId === effectiveEditionId);
  const diagnosticsQuery = useQuery({
    queryKey: ["festival-admin-attendees", effectiveEditionId],
    queryFn: () => fetchDiagnostics(effectiveEditionId),
    enabled: Boolean(effectiveEditionId),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modern attendee lifecycle diagnostics</CardTitle>
        <CardDescription>
          Inspect simplified Festival ticket, check-in, wristband and schedule state without mixing legacy edition identifiers into the modern attendance system.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {editionsQuery.isLoading ? (
          <p>Loading modern Festival editions…</p>
        ) : editionsQuery.error ? (
          <p className="text-destructive">Modern Festival editions could not be loaded: {String(editionsQuery.error)}</p>
        ) : editions.length === 0 ? (
          <p className="text-muted-foreground">No modern Festival editions exist.</p>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label>Modern Festival edition</Label>
                <Select value={effectiveEditionId} onValueChange={setSelectedEditionId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {editions.map((edition) => (
                      <SelectItem key={edition.editionId} value={edition.editionId}>
                        {edition.festivalName ?? edition.editionName} · {edition.editionYear} · {edition.status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                disabled={!effectiveEditionId || diagnosticsQuery.isFetching}
                onClick={() => void diagnosticsQuery.refetch()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>

            {selectedEdition && (
              <p className="text-sm text-muted-foreground">
                {selectedEdition.city ?? "City not set"} · {selectedEdition.startsOn} → {selectedEdition.endsOn}
              </p>
            )}

            {diagnosticsQuery.isLoading ? (
              <p>Loading attendee lifecycle state…</p>
            ) : diagnosticsQuery.error ? (
              <p className="text-destructive">Attendee diagnostics failed: {String(diagnosticsQuery.error)}</p>
            ) : diagnosticsQuery.data ? (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Ticket holders</p><p className="text-2xl font-semibold">{diagnosticsQuery.data.summary.total}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Attending</p><p className="text-2xl font-semibold">{diagnosticsQuery.data.summary.attending}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Completed</p><p className="text-2xl font-semibold">{diagnosticsQuery.data.summary.completed}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Needs attention</p><p className="text-2xl font-semibold">{diagnosticsQuery.data.summary.attentionRequired}</p></div>
                </div>
                {diagnosticsQuery.data.attendance.length === 0 ? (
                  <p className="rounded-md border p-4 text-muted-foreground">No attendee lifecycle rows exist for this edition yet.</p>
                ) : (
                  <div className="space-y-3">
                    {diagnosticsQuery.data.attendance.map((attendee) => (
                      <AttendeeRow key={attendee.attendanceId} attendee={attendee} editionId={effectiveEditionId} />
                    ))}
                  </div>
                )}
              </>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
