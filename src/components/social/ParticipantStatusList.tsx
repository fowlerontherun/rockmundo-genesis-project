import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Users } from "lucide-react";
import { getGigLineupStatusDisplay, getRehearsalParticipantStatusDisplay } from "@/lib/participationStatus";
import { useGigPerformers, useRehearsalParticipants, type GigPerformer, type RehearsalParticipant } from "@/hooks/useParticipationDetails";

type Kind = "rehearsal" | "gig";

function nameFor(row: { profiles: { display_name: string | null; username: string | null } | null }) {
  return row.profiles?.display_name || row.profiles?.username || "Unknown player";
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function ParticipantRow({ row, kind }: { row: RehearsalParticipant | GigPerformer; kind: Kind }) {
  const status = kind === "rehearsal"
    ? getRehearsalParticipantStatusDisplay((row as RehearsalParticipant).participation_status)
    : getGigLineupStatusDisplay((row as GigPerformer).lineup_status);
  const name = nameFor(row);
  const role = kind === "gig" ? (row as GigPerformer).role_or_instrument : null;

  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarImage src={row.profiles?.avatar_url ?? undefined} alt="" />
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="break-words font-medium">{name}</p>
          {role ? <p className="break-words text-sm text-muted-foreground">{role}</p> : null}
        </div>
      </div>
      <Badge variant={status.badgeVariant} aria-label={`${name} status: ${status.label}`}>
        {status.label}
      </Badge>
    </li>
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
}: {
  title: string;
  description: string;
  rows: Array<RehearsalParticipant | GigPerformer>;
  kind: Kind;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  unavailableWhenEmpty?: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-36 w-full" aria-label={`Loading ${title.toLowerCase()}`} />;
  }

  if (isError) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive"><AlertCircle className="h-5 w-5" /> Unable to load {title.toLowerCase()}</CardTitle>
          <CardDescription>{error instanceof Error ? error.message : "Please try again later."}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {unavailableWhenEmpty ? `${kind === "rehearsal" ? "Participant" : "Lineup"} details are unavailable for this older event.` : kind === "rehearsal" ? "No participant rows are recorded for this rehearsal yet." : "No lineup rows are recorded for this gig yet."}
          </p>
        ) : (
          <ul className="space-y-2" aria-label={title}>
            {rows.map((row) => <ParticipantRow key={row.id} row={row} kind={kind} />)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function RehearsalParticipantsSection({ rehearsalId, completed }: { rehearsalId: string; completed?: boolean }) {
  const query = useRehearsalParticipants(rehearsalId);
  return (
    <ParticipantStatusCard
      title="Rehearsal attendance"
      description={completed ? "Final attendance is read-only and based on recorded participant rows." : "Band members are currently included automatically."}
      rows={query.data ?? []}
      kind="rehearsal"
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      unavailableWhenEmpty={completed}
    />
  );
}

export function GigPerformersSection({ gigId, completedOrCancelled }: { gigId: string; completedOrCancelled?: boolean }) {
  const query = useGigPerformers(gigId);
  return (
    <ParticipantStatusCard
      title="Lineup"
      description={completedOrCancelled ? "Final lineup history is read-only and based on recorded performer rows." : "Lineup is currently generated from active performing members."}
      rows={query.data ?? []}
      kind="gig"
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      unavailableWhenEmpty={completedOrCancelled}
    />
  );
}
