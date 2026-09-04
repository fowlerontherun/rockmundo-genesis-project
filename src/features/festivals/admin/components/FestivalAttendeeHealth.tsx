import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useFestivalAttendeeDiagnostics,
  useRepairFestivalAttendee,
} from "../hooks";

const issueLabels: Record<string, string> = {
  attendance_ticket_missing: "Admission ticket is missing",
  ticket_attendance_mismatch: "Ticket ownership or Festival does not match",
  inactive_ticket_active_attendance:
    "Cancelled, transferred or refunded ticket remains active",
  attending_ticket_not_used: "Checked-in ticket was not consumed",
  ticket_used_without_check_in: "Ticket was consumed without check-in evidence",
  checked_in_without_wristband: "Checked-in attendee has no wristband",
  duplicate_wristbands: "More than one wristband exists",
  active_schedule_lock_missing: "Festival calendar reservation is missing",
  duplicate_active_schedule_locks:
    "Duplicate Festival calendar reservations exist",
  terminal_schedule_lock_open: "Completed attendance still blocks the calendar",
  expired_attendance_still_active:
    "Festival has ended but attendance is still active",
  terminal_timestamp_inconsistent:
    "Lifecycle timestamp evidence is inconsistent",
  lifecycle_event_gap:
    "Lifecycle event history does not match the current version",
};

type RepairTarget = {
  attendanceId: string;
  lifecycleVersion: number;
  repairCode: string;
  ticketReference: string | null;
  idempotencyKey: string;
};

export function FestivalAttendeeHealth({ editionId }: { editionId: string }) {
  const diagnostics = useFestivalAttendeeDiagnostics(editionId);
  const repair = useRepairFestivalAttendee(editionId);
  const [filter, setFilter] = useState<"all" | "repairable" | "blocked">("all");
  const [target, setTarget] = useState<RepairTarget | null>(null);
  const [reason, setReason] = useState("");
  const [previewed, setPreviewed] = useState(false);
  const rows = useMemo(() => {
    const all = diagnostics.data?.rows ?? [];
    return filter === "all" ? all : all.filter((row) => row.health === filter);
  }, [diagnostics.data, filter]);

  if (diagnostics.isLoading)
    return (
      <Card>
        <CardContent className="p-6">
          Checking attendee and ticket health…
        </CardContent>
      </Card>
    );
  if (diagnostics.error || !diagnostics.data)
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Attendee diagnostics unavailable</CardTitle>
          <CardDescription>
            The admin-only lifecycle diagnostic could not be loaded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => void diagnostics.refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  const { summary } = diagnostics.data;
  const submit = (apply: boolean) => {
    if (!target) return;
    repair.mutate(
      {
        ...target,
        expectedLifecycleVersion: target.lifecycleVersion,
        reason,
        idempotencyKey: target.idempotencyKey,
        apply,
      },
      {
        onSuccess: () => {
          setPreviewed(true);
          if (apply) {
            setTarget(null);
            setReason("");
            setPreviewed(false);
          }
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          Attendee & ticket health
        </CardTitle>
        <CardDescription>
          Server-authoritative checks across admission, attendance, wristband
          and calendar state.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <button
            className="rounded border p-3 text-left"
            onClick={() => setFilter("all")}
          >
            <span className="text-sm text-muted-foreground">Total</span>
            <p className="text-2xl font-semibold">{summary.total}</p>
          </button>
          <button
            className="rounded border p-3 text-left"
            onClick={() => setFilter("all")}
          >
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Healthy
            </span>
            <p className="text-2xl font-semibold">{summary.healthy}</p>
          </button>
          <button
            className="rounded border border-amber-400/60 p-3 text-left"
            onClick={() => setFilter("repairable")}
          >
            <span className="text-sm text-muted-foreground">
              Safely repairable
            </span>
            <p className="text-2xl font-semibold">{summary.repairable}</p>
          </button>
          <button
            className="rounded border border-destructive/50 p-3 text-left"
            onClick={() => setFilter("blocked")}
          >
            <span className="text-sm text-muted-foreground">
              Investigation required
            </span>
            <p className="text-2xl font-semibold">{summary.blocked}</p>
          </button>
        </div>
        {diagnostics.data.orphanTickets.map((ticket) => (
          <div
            key={ticket.ticketId}
            className="rounded border border-destructive/50 p-3 text-sm"
          >
            <AlertTriangle className="mr-2 inline h-4 w-4 text-destructive" />
            Ticket {ticket.ticketReference ?? ticket.ticketId} has no attendee
            lifecycle. Manual investigation is required.
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No attendee records match this filter.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.attendanceId} className="rounded border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      Ticket {row.ticketReference ?? row.ticketId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Attendance {row.attendanceStatus} · ticket{" "}
                      {row.ticketStatus ?? "missing"} · lifecycle v
                      {row.lifecycleVersion}
                    </p>
                  </div>
                  <Badge
                    variant={
                      row.health === "healthy"
                        ? "secondary"
                        : row.health === "blocked"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {row.health}
                  </Badge>
                </div>
                {row.issues.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {row.issues.map((issue) => (
                      <li key={issue.code}>
                        • {issueLabels[issue.code] ?? issue.code}
                      </li>
                    ))}
                  </ul>
                )}
                {row.health === "repairable" && row.recommendedRepair && (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTarget({
                        attendanceId: row.attendanceId,
                        lifecycleVersion: row.lifecycleVersion,
                        repairCode: row.recommendedRepair!,
                        ticketReference: row.ticketReference,
                        idempotencyKey: crypto.randomUUID(),
                      });
                      setPreviewed(false);
                    }}
                  >
                    <Wrench className="mr-2 h-4 w-4" />
                    Preview recovery
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <Dialog
          open={Boolean(target)}
          onOpenChange={(open) => !open && setTarget(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recover Festival attendee</DialogTitle>
            </DialogHeader>
            <p className="text-sm">
              This applies only the recommended one-way repair for ticket{" "}
              {target?.ticketReference ?? target?.attendanceId}. It cannot
              restore a used ticket or manufacture check-in.
            </p>
            <Input
              aria-label="Recovery reason"
              placeholder="Support reason (at least 8 characters)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            {repair.error && (
              <p className="text-sm text-destructive">{String(repair.error)}</p>
            )}
            {previewed && (
              <p className="rounded border border-amber-400/60 p-2 text-sm">
                Preview passed against the current lifecycle version. Review the
                reason, then apply.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={repair.isPending}
                onClick={() => submit(false)}
              >
                Refresh preview
              </Button>
              <Button
                disabled={
                  !previewed || reason.trim().length < 8 || repair.isPending
                }
                onClick={() => submit(true)}
              >
                Apply audited recovery
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
