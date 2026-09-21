import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  canAttemptTotpCheckIn,
  canRespondToTotpInvitation,
  checkInToTotp,
  getTotpBroadcastArchive,
  getTotpEpisode,
  getTotpPublicHistory,
  listMyTotpInvitations,
  respondToTotpInvitation,
} from "@/features/top-of-the-pops/api";
import { getTotpChartRundown } from "@/features/top-of-the-pops/chartRundownApi";
import { resolveTotpPresenter, totpVariantLabel } from "@/features/top-of-the-pops/presenters";
import { TotpArchivePlayer } from "@/features/top-of-the-pops/TotpArchivePlayer";
import { TotpBroadcastStatusCard } from "@/features/top-of-the-pops/TotpBroadcastStatusCard";
import { TotpFullEpisodePlayer } from "@/features/top-of-the-pops/TotpFullEpisodePlayer";
import { TotpBackstageInterviewCard } from "@/features/top-of-the-pops/TotpBackstageInterviewCard";
import { TotpLiveTvExtrasCard } from "@/features/top-of-the-pops/TotpLiveTvExtrasCard";
import { TotpStudioReadinessCard } from "@/features/top-of-the-pops/TotpStudioReadinessCard";
import { TotpProgrammePlaceholder } from "@/features/top-of-the-pops/TotpProgrammePlaceholder";
import { Archive, CalendarDays, Clock3, History, MapPin, Music2, Play, Radio, Tv2 } from "lucide-react";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" }).format(new Date(`${value}T12:00:00Z`));
}

export default function TopOfThePops() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedReplayId, setSelectedReplayId] = useState<string | null>(null);

  const invitations = useQuery({
    queryKey: ["totp", "my-invitations"],
    queryFn: listMyTotpInvitations,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const episode = useQuery({
    queryKey: ["totp", "episode", "current"],
    queryFn: () => getTotpEpisode(),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const history = useQuery({
    queryKey: ["totp", "history", "public"],
    queryFn: () => getTotpPublicHistory(null, 30),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const currentEpisodeId = episode.data?.id ?? null;
  const archive = useQuery({
    queryKey: ["totp", "archive", currentEpisodeId],
    queryFn: () => getTotpBroadcastArchive(currentEpisodeId),
    enabled: !!currentEpisodeId,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const chartRundown = useQuery({
    queryKey: ["totp", "chart-rundown", currentEpisodeId],
    queryFn: () => getTotpChartRundown(currentEpisodeId),
    enabled: !!currentEpisodeId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const respond = useMutation({
    mutationFn: ({ id, response }: { id: string; response: "accepted" | "declined" }) =>
      respondToTotpInvitation(id, response),
    onSuccess: (result, variables) => {
      if (result === "expired") {
        toast({
          title: "Invitation expired",
          description: "The response deadline has passed, so this appearance can no longer be accepted or declined.",
          variant: "destructive",
        });
      } else {
        toast({
          title: variables.response === "accepted" ? "Invitation accepted" : "Invitation declined",
          description: variables.response === "accepted"
            ? "Get every active band member to London before studio check-in."
            : "The appearance has been declined.",
        });
      }
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
  const currentPresenter = currentEpisode ? resolveTotpPresenter((currentEpisode as any).presenter_key) : null;
  const currentVariantLabel = currentEpisode ? totpVariantLabel((currentEpisode as any).show_variant) : null;
  const archiveReplays = archive.data?.replays ?? [];
  const isLiveBroadcast = currentEpisode?.status === "broadcast";
  const liveReplay = archiveReplays.length > 0 ? archiveReplays[archiveReplays.length - 1] : null;
  const selectedReplay = archiveReplays.find((replay) => replay.id === selectedReplayId) ?? archiveReplays[0] ?? null;
  const recentHistory = history.data ?? [];

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

      {episode.isLoading && <TotpProgrammePlaceholder label="Loading the next broadcast" />}
      {currentEpisode && <TotpBroadcastStatusCard episode={currentEpisode} archiveReady={archiveReplays.length > 0} />}

      {currentEpisode && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5" /> Episode #{currentEpisode.episode_number}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{currentEpisode.status.replaceAll("_", " ")}</Badge>
                {currentVariantLabel && <Badge variant="secondary">{currentVariantLabel}</Badge>}
              </div>
            </div>
            <CardDescription>
              Broadcast {formatDateTime(currentEpisode.broadcast_at)} · London time · Presenter: {currentPresenter?.displayName ?? "Alex Rayne"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentEpisode.performances.length === 0 ? (
              <p className="text-sm text-muted-foreground">The running order has not been published yet.</p>
            ) : (
              currentEpisode.performances.map((performance) => (
                <div key={performance.performance_id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
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

      {isLiveBroadcast && archive.isLoading && (
        <TotpProgrammePlaceholder label="Opening the live studio feed" />
      )}

      {isLiveBroadcast && liveReplay && (
        <section className="space-y-3" data-totp-live-studio-feed>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Radio className="h-5 w-5" /> Live studio feed</h2>
              <p className="text-sm text-muted-foreground">Future acts stay locked until their scheduled airtime. The feed advances automatically as the programme progresses.</p>
            </div>
            <Badge>On air · act {liveReplay.payload.runningOrder}</Badge>
          </div>
          <TotpArchivePlayer key={`live:${liveReplay.id}`} replay={liveReplay} autoPlay />
        </section>
      )}

      {!isLiveBroadcast && archiveReplays.length > 0 && (
        <section className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold"><Archive className="h-5 w-5" /> Broadcast archive</h2>
              <p className="text-sm text-muted-foreground">Watch the immutable television replay as it originally aired. Replays never award fame, XP or money.</p>
            </div>
            <Badge variant="secondary">{archiveReplays.length} archived performance{archiveReplays.length === 1 ? "" : "s"}</Badge>
          </div>

          <TotpFullEpisodePlayer replays={archiveReplays} chartRundown={chartRundown.data} />

          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">Or jump directly to an individual performance</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {archiveReplays.map((replay) => (
                <Button
                  key={replay.id}
                  variant={selectedReplay?.id === replay.id ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                  onClick={() => setSelectedReplayId(replay.id)}
                >
                  <Play className="mr-2 h-3.5 w-3.5" />
                  {replay.payload.runningOrder}. {replay.payload.band.name} — {replay.payload.song.title}
                </Button>
              ))}
            </div>

            {selectedReplay && <div className="mt-3"><TotpArchivePlayer replay={selectedReplay} /></div>}
          </div>
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Top of the Pops history</CardTitle>
          <CardDescription>Completed appearances are permanent career history. Fame is shown exactly as it was settled at broadcast completion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.isLoading && <p className="text-sm text-muted-foreground">Loading appearance history…</p>}
          {history.isError && <p className="text-sm text-destructive">{(history.error as Error).message}</p>}
          {!history.isLoading && recentHistory.length === 0 && <p className="text-sm text-muted-foreground">No completed Top of the Pops appearances yet.</p>}
          {recentHistory.map((appearance) => (
            <div key={appearance.performance_id} className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <div className="font-semibold">{appearance.band_name} — {appearance.song_title}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Episode #{appearance.episode_number} · {formatDate(appearance.episode_date)} · appearance #{appearance.appearance_number} · chart #{appearance.qualifying_rank}
                </div>
                {appearance.presenter_intro && <div className="mt-2 truncate text-sm italic text-muted-foreground">“{appearance.presenter_intro}”</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Badge variant="outline">{appearance.stage_key.replaceAll("_", " ")}</Badge>
                <Badge>+{appearance.fame_awarded.toLocaleString()} fame</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="space-y-3" id="invitations">
        <div>
          <h2 className="text-xl font-semibold">Your invitations</h2>
          <p className="text-sm text-muted-foreground">Only the band leader can accept, decline, complete studio check-in or make the band's on-air choices.</p>
        </div>

        {invitations.isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading invitations…</CardContent></Card>}
        {invitations.isError && <Card><CardContent className="p-6 text-sm text-destructive">{(invitations.error as Error).message}</CardContent></Card>}
        {invitations.data?.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">No Top of the Pops invitations yet.</CardContent></Card>}

        {invitations.data?.map((invitation) => {
          const canRespond = canRespondToTotpInvitation(invitation, now);
          const canCheckIn = canAttemptTotpCheckIn(invitation, now);
          const showReadiness = invitation.status === "accepted" || invitation.status === "checked_in";
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
                {invitation.status === "invited" && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="font-semibold">Top of the Pops booking offer — response required</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {invitation.band_name} has been invited to perform {invitation.song_title}, currently #{invitation.qualifying_rank} in the qualifying UK chart.
                      Only the band leader can accept or decline. If accepted, every active band member must travel to {invitation.london_city_name} and be ready for studio check-in.
                    </p>
                  </div>
                )}

                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    Broadcast {formatDateTime(invitation.broadcast_at)} · London time
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" /> {invitation.london_city_name}
                  </div>
                  <div className="flex items-center gap-2">
                    <Music2 className="h-4 w-4 text-muted-foreground" />
                    Studio call {formatDateTime(invitation.check_in_at)} · London time
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                    Reply by {formatDateTime(invitation.response_deadline)} · London time
                  </div>
                </div>

                {showReadiness && <TotpStudioReadinessCard invitationId={invitation.invitation_id} />}

                {invitation.status === "accepted" && !canCheckIn && (
                  <p className="text-sm text-muted-foreground">
                    Check-in opens two hours before studio call. Every active player-controlled member must be in London and not travelling.
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {canRespond && (
                    <>
                      <Button onClick={() => respond.mutate({ id: invitation.invitation_id, response: "accepted" })} disabled={respond.isPending}>Accept invitation</Button>
                      <Button variant="outline" onClick={() => respond.mutate({ id: invitation.invitation_id, response: "declined" })} disabled={respond.isPending}>Decline</Button>
                    </>
                  )}
                  {canCheckIn && (
                    <Button onClick={() => checkIn.mutate(invitation.invitation_id)} disabled={checkIn.isPending}>Check band into studio</Button>
                  )}
                </div>

                {(invitation.status === "checked_in" || invitation.status === "performed") && (
                  <>
                    <TotpBackstageInterviewCard invitationId={invitation.invitation_id} />
                    <TotpLiveTvExtrasCard invitationId={invitation.invitation_id} />
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
