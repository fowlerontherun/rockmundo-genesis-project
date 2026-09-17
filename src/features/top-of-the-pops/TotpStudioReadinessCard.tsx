import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Clock3, MapPin, Plane, Users, XCircle } from "lucide-react";
import { getTotpStudioReadiness } from "./studioReadinessApi";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function readinessWindowLabel(opensAt: string, closesAt: string, now = new Date()) {
  const current = now.getTime();
  const opens = new Date(opensAt).getTime();
  const closes = new Date(closesAt).getTime();
  if (current < opens) return `Check-in opens ${formatDateTime(opensAt)}`;
  if (current <= closes) return `Check-in is open until ${formatDateTime(closesAt)}`;
  return `Check-in closed ${formatDateTime(closesAt)}`;
}

export interface TotpStudioReadinessCardProps {
  invitationId: string;
}

export function TotpStudioReadinessCard({ invitationId }: TotpStudioReadinessCardProps) {
  const readiness = useQuery({
    queryKey: ["totp", "studio-readiness", invitationId],
    queryFn: () => getTotpStudioReadiness(invitationId),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  if (readiness.isLoading) {
    return <Card><CardContent className="p-4 text-sm text-muted-foreground">Checking London studio readiness…</CardContent></Card>;
  }

  if (readiness.isError) {
    return <Card><CardContent className="p-4 text-sm text-destructive">{(readiness.error as Error).message}</CardContent></Card>;
  }

  const data = readiness.data;
  if (!data) return null;

  const missing = Math.max(0, data.members_required - data.members_present);

  return (
    <Card className={data.all_ready ? "border-emerald-500/35" : "border-amber-500/35"}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" /> Studio call sheet</CardTitle>
            <CardDescription className="mt-1">Live readiness for the required player-controlled band members.</CardDescription>
          </div>
          <Badge variant={data.all_ready ? "default" : "secondary"}>
            {data.members_present}/{data.members_required} ready
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock3 className="h-4 w-4" /> {readinessWindowLabel(data.check_in_opens_at, data.check_in_closes_at)}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" /> London Television Centre
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {data.members.map((member) => (
            <div key={member.profile_id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{member.display_name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant={member.is_in_london ? "outline" : "secondary"} className="text-xs">
                    <MapPin className="mr-1 h-3 w-3" /> {member.is_in_london ? "In London" : "Not in London"}
                  </Badge>
                  {member.is_traveling && (
                    <Badge variant="secondary" className="text-xs"><Plane className="mr-1 h-3 w-3" /> Travelling</Badge>
                  )}
                </div>
              </div>
              {member.ready ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-label="Ready" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-amber-500" aria-label="Not ready" />
              )}
            </div>
          ))}
        </div>

        <div className={`rounded-lg border px-3 py-2 text-sm ${data.all_ready ? "border-emerald-500/25 bg-emerald-500/5" : "border-amber-500/25 bg-amber-500/5"}`}>
          {data.all_ready
            ? "Every required band member is in London and not travelling. The band is clear to use studio check-in once the window is open."
            : `${missing} required band member${missing === 1 ? " is" : "s are"} not yet ready. Everyone must be in London and no longer travelling before check-in can succeed.`}
        </div>
      </CardContent>
    </Card>
  );
}

export default TotpStudioReadinessCard;
