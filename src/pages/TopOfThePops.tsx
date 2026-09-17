import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  canAttemptTotpCheckIn,
  canRespondToTotpInvitation,
  checkInToTotp,
  getTotpEpisode,
  listMyTotpInvitations,
  respondToTotpInvitation,
} from "@/features/top-of-the-pops/api";
import { CalendarDays, MapPin, Music2, Radio, Tv2 } from "lucide-react";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default function TopOfThePops() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invitations = useQuery({
    queryKey: ["totp", "my-invitations"],
    queryFn: listMyTotpInvitations,
  });

  const episode = useQuery({
    queryKey: ["totp", "episode", "current"],
    queryFn: () => getTotpEpisode(),
  });

  const respond = useMutation({
    mutationFn: ({ id, response }: { id: string; response: "accepted" | "declined" }) =>
      respondToTotpInvitation(id, response),
    onSuccess: (_result, variables) => {
      toast({
        title: variables.response === "accepted" ? "Invitation accepted" : "Invitation declined",
        description: variables.response === "accepted"
          ? "Get every active band member to London before studio check-in."
          : "The appearance has been declined.",
      });
      void queryClient.invalidateQueries({ queryKey: ["totp"] });
    },
    onError: (error: Error) => toast({ title: "Could not update invitation", description: error.message, variant: "destructive" }),
  });

  const checkIn = useMutation({
    mutationFn: checkInToTotp,
    onSuccess: () => {
      toast({ title: "Studio check-in complete", description: "Your band is checked in at the London television studio." });
      void queryClient.invalidateQueries({ queryKey: ["totp"] });
    },
    onError: (error: Error) => toast({ title: "Check-in failed", description: error.message, variant: "destructive" }),
  });

  const now = new Date();
  const currentEpisode = episode.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Tv2 className="h-4 w-4" /> RockMundo Television
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Top of the Pops</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              The fortnightly Thursday chart show. Top 40 artists are invited to London to perform the song that earned their place.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit text-sm">Every second Thursday · London</Badge>
        </div>
      </section>

      {currentEpisode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5" /> Episode #{currentEpisode.episode_number}</CardTitle>
            <CardDescription>
              Broadcast {formatDateTime(currentEpisode.broadcast_at)} · Presenter: {currentEpisode.presenter_key.replaceAll("_", " ")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentEpisode.performances.length === 0 ? (
              <p className="text-sm text-muted-foreground">The running order has not been published yet.</p>
            ) : (
              currentEpisode.performances.map((performance) => (
                <div key={`${performance.band_id}-${performance.running_order}`} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="font-medium">{performance.running_order}. {performance.band_name}</div>
                    <div className="truncate text-sm text-muted-foreground">{performance.song_title} · qualifying chart #{performance.qualifying_rank}</div>
                  </div>
                  <Badge variant="outline">{performance.stage_key.replaceAll("_", " ")}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Your invitations</h2>
          <p className="text-sm text-muted-foreground">Only the band leader can accept, decline or complete studio check-in.</p>
        </div>

        {invitations.isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading invitations…</CardContent></Card>}
        {invitations.isError && <Card><CardContent className="p-6 text-sm text-destructive">{(invitations.error as Error).message}</CardContent></Card>}
        {invitations.data?.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">No Top of the Pops invitations yet.</CardContent></Card>}

        {invitations.data?.map((invitation) => {
          const canRespond = canRespondToTotpInvitation(invitation, now);
          const canCheckIn = canAttemptTotpCheckIn(invitation, now);
          return (
            <Card key={invitation.invitation_id}>
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>{invitation.band_name}</CardTitle>
                    <CardDescription>{invitation.song_title} · UK qualifying chart #{invitation.qualifying_rank}</CardDescription>
                  </div>
                  <Badge>{invitation.status.replaceAll("_", " ")}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /> {formatDateTime(invitation.broadcast_at)}</div>
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {invitation.london_city_name}</div>
                  <div className="flex items-center gap-2"><Music2 className="h-4 w-4 text-muted-foreground" /> Studio call {formatDateTime(invitation.check_in_at)}</div>
                </div>

                {invitation.status === "accepted" && !canCheckIn && (
                  <p className="text-sm text-muted-foreground">
                    Check-in opens two hours before studio call. Every active player-controlled member must be in London and not travelling.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {canRespond && (
                    <>
                      <Button
                        onClick={() => respond.mutate({ id: invitation.invitation_id, response: "accepted" })}
                        disabled={respond.isPending}
                      >Accept invitation</Button>
                      <Button
                        variant="outline"
                        onClick={() => respond.mutate({ id: invitation.invitation_id, response: "declined" })}
                        disabled={respond.isPending}
                      >Decline</Button>
                    </>
                  )}
                  {canCheckIn && (
                    <Button onClick={() => checkIn.mutate(invitation.invitation_id)} disabled={checkIn.isPending}>
                      Check band into studio
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
