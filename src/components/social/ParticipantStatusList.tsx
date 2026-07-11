import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Users } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  getGigLineupStatusDisplay,
  getRehearsalParticipantStatusDisplay,
} from "@/lib/participationStatus";
import {
  getRehearsalRsvpDeadline,
  isRehearsalRsvpOpen,
  REHEARSAL_RSVP_LOCK_MINUTES,
} from "@/lib/rehearsalRsvp";
import { useToast } from "@/hooks/use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import {
  useGigPerformers,
  useRehearsalParticipants,
  type GigPerformer,
  type RehearsalParticipant,
} from "@/hooks/useParticipationDetails";

type Kind = "rehearsal" | "gig";

function nameFor(row: {
  profiles: { display_name: string | null; username: string | null } | null;
}) {
  return (
    row.profiles?.display_name || row.profiles?.username || "Unknown player"
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ParticipantRow({
  row,
  kind,
  activeProfileId,
  rehearsalStatus,
  scheduledStart,
}: {
  row: RehearsalParticipant | GigPerformer;
  kind: Kind;
  activeProfileId?: string | null;
  rehearsalStatus?: string;
  scheduledStart?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = useState<string | null>(null);
  const status =
    kind === "rehearsal"
      ? getRehearsalParticipantStatusDisplay(
          (row as RehearsalParticipant).participation_status,
        )
      : getGigLineupStatusDisplay((row as GigPerformer).lineup_status);
  const name = nameFor(row);
  const role = kind === "gig" ? (row as GigPerformer).role_or_instrument : null;
  const isOwnRehearsalRow =
    kind === "rehearsal" &&
    activeProfileId === (row as RehearsalParticipant).profile_id;
  const deadline = scheduledStart
    ? getRehearsalRsvpDeadline(scheduledStart)
    : null;
  const canRespond =
    isOwnRehearsalRow &&
    scheduledStart &&
    isRehearsalRsvpOpen(
      rehearsalStatus,
      (row as RehearsalParticipant).participation_status,
      scheduledStart,
    );

  const mutation = useMutation({
    mutationFn: async (response: "confirmed" | "declined") => {
      const { data, error } = await (supabase as any).rpc(
        "respond_to_rehearsal_invitation",
        { participant_id: row.id, response },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, response) => {
      setMessage(`Response saved: ${response}.`);
      toast({
        title: "Rehearsal response saved",
        description:
          response === "confirmed"
            ? "You confirmed this rehearsal."
            : "You declined this rehearsal.",
      });
      queryClient.invalidateQueries({
        queryKey: [
          "rehearsal-participants",
          (row as RehearsalParticipant).rehearsal_id,
        ],
      });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
    },
    onError: (error: any) => {
      const description = error?.message || "Please try again later.";
      setMessage(description);
      toast({
        title: "Unable to save response",
        description,
        variant: "destructive",
      });
    },
  });

  return (
    <li
      className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label={isOwnRehearsalRow ? `${name}, your rehearsal row` : undefined}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={row.profiles?.avatar_url ?? undefined} alt="" />
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="break-words font-medium">
            {name}
            {isOwnRehearsalRow ? " (you)" : ""}
          </p>
          {role ? (
            <p className="break-words text-sm text-muted-foreground">{role}</p>
          ) : null}
          {isOwnRehearsalRow && deadline ? (
            <p className="text-xs text-muted-foreground">
              Respond by {deadline.toLocaleString()}. Responses are locked{" "}
              {REHEARSAL_RSVP_LOCK_MINUTES / 60} hour before rehearsal.
            </p>
          ) : null}
          {message ? (
            <p
              className="text-xs text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <Badge
          variant={status.badgeVariant}
          aria-label={`${name} status: ${status.label}`}
        >
          {status.label}
        </Badge>
        {canRespond ? (
          <div
            className="flex flex-col gap-2 sm:flex-row"
            aria-busy={mutation.isPending}
          >
            <Button
              size="sm"
              onClick={() => mutation.mutate("confirmed")}
              disabled={
                mutation.isPending ||
                (row as RehearsalParticipant).participation_status ===
                  "confirmed"
              }
            >
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => mutation.mutate("declined")}
              disabled={
                mutation.isPending ||
                (row as RehearsalParticipant).participation_status ===
                  "declined"
              }
            >
              Decline
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

const FINAL_REHEARSAL_STATUSES = new Set(["attended", "missed"]);
const EDITABLE_REHEARSAL_STATUSES = new Set(["invited", "confirmed"]);

function canFinaliseRehearsalAttendance(
  status?: string,
  scheduledStart?: string,
  scheduledEnd?: string,
) {
  if (!scheduledStart || status === "cancelled") return false;
  const now = Date.now();
  const start = new Date(scheduledStart).getTime();
  const end = scheduledEnd ? new Date(scheduledEnd).getTime() : Number.NaN;
  return (
    status === "completed" || (Number.isFinite(end) ? now >= end : now >= start)
  );
}

function ManagerAttendanceFinalisation({
  rehearsalId,
  status,
  scheduledStart,
  scheduledEnd,
  rows,
}: {
  rehearsalId: string;
  status?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  rows: RehearsalParticipant[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selections, setSelections] = useState<
    Record<string, "attended" | "missed">
  >({});
  const [message, setMessage] = useState<string | null>(null);
  const eligibleRows = rows.filter((row) =>
    EDITABLE_REHEARSAL_STATUSES.has(row.participation_status),
  );
  const declinedCount = rows.filter(
    (row) => row.participation_status === "declined",
  ).length;
  const finalCount = rows.filter((row) =>
    FINAL_REHEARSAL_STATUSES.has(row.participation_status),
  ).length;
  const eligible = canFinaliseRehearsalAttendance(
    status,
    scheduledStart,
    scheduledEnd,
  );

  const selectedEntries = eligibleRows
    .map((row) => ({ participant_id: row.id, status: selections[row.id] }))
    .filter(
      (row): row is { participant_id: string; status: "attended" | "missed" } =>
        row.status === "attended" || row.status === "missed",
    );
  const attendedCount = selectedEntries.filter(
    (row) => row.status === "attended",
  ).length;
  const missedCount = selectedEntries.filter(
    (row) => row.status === "missed",
  ).length;

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc(
        "finalise_rehearsal_attendance",
        { rehearsal_id: rehearsalId, attendance: selectedEntries },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any[]) => {
      const changed = Array.isArray(data)
        ? data.filter((row) => row.changed).length
        : selectedEntries.length;
      setMessage(
        `Attendance finalised. ${changed} row${changed === 1 ? "" : "s"} updated.`,
      );
      setSelections({});
      toast({
        title: "Attendance finalised",
        description: "Rehearsal attendance history was updated.",
      });
      queryClient.invalidateQueries({
        queryKey: ["rehearsal-participants", rehearsalId],
      });
      queryClient.invalidateQueries({ queryKey: ["band-contribution-events"] });
    },
    onError: (error: any) => {
      const description =
        error?.message || "Please review the attendance rows and try again.";
      setMessage(description);
      toast({
        title: "Unable to finalise attendance",
        description,
        variant: "destructive",
      });
    },
  });

  if (!eligible && status !== "cancelled") {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Manager finalisation opens after rehearsal end or when the rehearsal is
        completed.
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Cancelled rehearsals cannot be finalised.
      </div>
    );
  }

  if (eligibleRows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        No provisional invited or confirmed participant rows remain to finalise.
      </div>
    );
  }

  return (
    <section
      className="space-y-3 rounded-lg border p-3"
      aria-label="Manager attendance finalisation"
      aria-busy={mutation.isPending}
    >
      <div className="space-y-1">
        <h4 className="font-medium">Finalise attendance</h4>
        <p className="text-sm text-muted-foreground">
          Managers can mark invited or confirmed rows as attended or missed.
          Declined and final rows stay read-only.
        </p>
        <p className="text-xs text-muted-foreground">
          Review counts: {attendedCount} attended, {missedCount} missed,{" "}
          {declinedCount} declined, {finalCount} already final.
        </p>
      </div>
      <ul className="space-y-2">
        {eligibleRows.map((row) => {
          const name = nameFor(row);
          return (
            <li
              key={row.id}
              className="flex flex-col gap-2 rounded-md bg-muted/30 p-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{name}</p>
                <p className="text-xs text-muted-foreground">
                  Current status:{" "}
                  {
                    getRehearsalParticipantStatusDisplay(
                      row.participation_status,
                    ).label
                  }
                </p>
              </div>
              <RadioGroup
                className="flex gap-4"
                value={selections[row.id] ?? ""}
                onValueChange={(value) =>
                  setSelections((current) => ({
                    ...current,
                    [row.id]: value as "attended" | "missed",
                  }))
                }
                aria-label={`Final attendance for ${name}`}
                disabled={mutation.isPending}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id={`${row.id}-attended`} value="attended" />
                  <Label htmlFor={`${row.id}-attended`}>Attended</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id={`${row.id}-missed`} value="missed" />
                  <Label htmlFor={`${row.id}-missed`}>Missed</Label>
                </div>
              </RadioGroup>
            </li>
          );
        })}
      </ul>
      {message ? (
        <p
          className="text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button disabled={mutation.isPending || selectedEntries.length === 0}>
            Finalise selected attendance
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalise rehearsal attendance?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark {attendedCount} attended and {missedCount} missed.
              Declined rows remain declined and final rows cannot be reversed in
              this PR.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              Review again
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                mutation.mutate();
              }}
            >
              Finalise attendance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ParticipantStatusCard({
  title,
  description,
  rows,
  kind,
  isLoading,
  isError,
  error,
  unavailableWhenEmpty,
  activeProfileId,
  rehearsalStatus,
  scheduledStart,
  scheduledEnd,
  isManager,
}: {
  title: string;
  description: string;
  rows: Array<RehearsalParticipant | GigPerformer>;
  kind: Kind;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  unavailableWhenEmpty?: boolean;
  activeProfileId?: string | null;
  rehearsalStatus?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  isManager?: boolean;
}) {
  if (isLoading)
    return (
      <Skeleton
        className="h-36 w-full"
        aria-label={`Loading ${title.toLowerCase()}`}
      />
    );
  if (isError)
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" /> Unable to load{" "}
            {title.toLowerCase()}
          </CardTitle>
          <CardDescription>
            {error instanceof Error ? error.message : "Please try again later."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {unavailableWhenEmpty
              ? `${kind === "rehearsal" ? "Participant" : "Lineup"} details are unavailable for this older event.`
              : kind === "rehearsal"
                ? "No participant rows are recorded for this rehearsal yet."
                : "No lineup rows are recorded for this gig yet."}
          </p>
        ) : (
          <ul className="space-y-2" aria-label={title}>
            {rows.map((row) => (
              <ParticipantRow
                key={row.id}
                row={row}
                kind={kind}
                activeProfileId={activeProfileId}
                rehearsalStatus={rehearsalStatus}
                scheduledStart={scheduledStart}
              />
            ))}
          </ul>
        )}
        {kind === "rehearsal" && isManager ? (
          <ManagerAttendanceFinalisation
            rehearsalId={
              (rows[0] as RehearsalParticipant | undefined)?.rehearsal_id ?? ""
            }
            status={rehearsalStatus}
            scheduledStart={scheduledStart}
            scheduledEnd={scheduledEnd}
            rows={rows as RehearsalParticipant[]}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

export function RehearsalParticipantsSection({
  rehearsalId,
  completed,
  status,
  scheduledStart,
  scheduledEnd,
  isManager,
}: {
  rehearsalId: string;
  completed?: boolean;
  status?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  isManager?: boolean;
}) {
  const query = useRehearsalParticipants(rehearsalId);
  const { profileId } = useActiveProfile();
  return (
    <ParticipantStatusCard
      title="Rehearsal attendance"
      description={
        completed
          ? "Final attendance is read-only and based on recorded participant rows."
          : "Invited members can confirm or decline their own rehearsal participation before the RSVP deadline."
      }
      rows={query.data ?? []}
      kind="rehearsal"
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      unavailableWhenEmpty={completed}
      activeProfileId={profileId}
      rehearsalStatus={status}
      scheduledStart={scheduledStart}
      scheduledEnd={scheduledEnd}
      isManager={isManager}
    />
  );
}

export function GigPerformersSection({
  gigId,
  completedOrCancelled,
}: {
  gigId: string;
  completedOrCancelled?: boolean;
}) {
  const query = useGigPerformers(gigId);
  return (
    <ParticipantStatusCard
      title="Lineup"
      description={
        completedOrCancelled
          ? "Final lineup history is read-only and based on recorded performer rows."
          : "Lineup is currently generated from active performing members."
      }
      rows={query.data ?? []}
      kind="gig"
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      unavailableWhenEmpty={completedOrCancelled}
    />
  );
}
