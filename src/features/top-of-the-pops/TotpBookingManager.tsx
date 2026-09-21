import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Clock3, Music2, Search, Send, TicketCheck, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  adminBookTotpBand,
  getTotpAdminBookingCatalog,
  type TotpAdminBookingCandidate,
  type TotpAdminBookingSong,
} from "./bookingApi";

function formatDate(value?: string | null) {
  if (!value) return "not available";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeZone: "Europe/London",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDeadline(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function invitationBadge(status?: string | null) {
  switch (status) {
    case "accepted":
      return <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Accepted</Badge>;
    case "checked_in":
      return <Badge className="gap-1"><TicketCheck className="h-3 w-3" /> Checked in</Badge>;
    case "performed":
      return <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Performed</Badge>;
    case "declined":
      return <Badge variant="destructive">Declined</Badge>;
    case "expired":
      return <Badge variant="outline">Expired</Badge>;
    case "invited":
      return <Badge variant="secondary" className="gap-1"><Clock3 className="h-3 w-3" /> Awaiting reply</Badge>;
    default:
      return null;
  }
}

function chartLabel(song: TotpAdminBookingSong) {
  if (song.qualifying_chart === "both") return "Streaming + Digital Sales";
  if (song.qualifying_chart === "digital_sales") return "Digital Sales";
  if (song.qualifying_chart === "streaming") return "Streaming";
  return song.qualifying_chart.replaceAll("_", " ");
}

function CandidateCard({
  candidate,
  availableSlots,
  canBookEpisode,
  onBook,
  pendingKey,
}: {
  candidate: TotpAdminBookingCandidate;
  availableSlots: number;
  canBookEpisode: boolean;
  onBook: (candidate: TotpAdminBookingCandidate, song: TotpAdminBookingSong) => void;
  pendingKey: string | null;
}) {
  const invite = candidate.invitation;
  return (
    <div className="rounded-xl border bg-card p-4" data-totp-booking-band={candidate.band_id}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-lg font-semibold">{candidate.band_name}</div>
            <Badge variant="outline">Best #{candidate.best_rank}</Badge>
            <Badge variant="secondary">{candidate.genre || "Unknown genre"}</Badge>
            {invite ? invitationBadge(invite.status) : null}
          </div>
          {candidate.previous_episode_performer ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
              <Ban className="h-4 w-4" />
              Performed on the previous Top of the Pops — consecutive appearances are blocked.
            </div>
          ) : null}
          {invite?.response_deadline ? (
            <div className="mt-2 text-xs text-muted-foreground">
              Response deadline: {formatDeadline(invite.response_deadline)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {candidate.songs.map((song) => {
          const key = `${candidate.band_id}:${song.song_id}`;
          const bookedSong = invite?.song_id === song.song_id;
          const disabled =
            !canBookEpisode
            || !candidate.eligible
            || availableSlots <= 0
            || !!invite
            || pendingKey !== null;

          return (
            <div
              key={song.song_id}
              className="flex flex-col gap-3 rounded-lg border bg-muted/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  <Music2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{song.song_title}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  UK #{song.qualifying_rank} · {chartLabel(song)}
                </div>
              </div>
              {bookedSong ? (
                <Badge className="w-fit">Selected song</Badge>
              ) : (
                <Button
                  size="sm"
                  onClick={() => onBook(candidate, song)}
                  disabled={disabled}
                  className="shrink-0"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {pendingKey === key ? "Sending…" : "Book & invite"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TotpBookingManager({ episodeId }: { episodeId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const catalog = useQuery({
    queryKey: ["totp", "admin-bookings", episodeId],
    queryFn: () => getTotpAdminBookingCatalog(episodeId),
    enabled: !!episodeId,
    staleTime: 20_000,
  });

  const bookBand = useMutation({
    mutationFn: ({ candidate, song }: { candidate: TotpAdminBookingCandidate; song: TotpAdminBookingSong }) =>
      adminBookTotpBand(episodeId, candidate.band_id, song.song_id),
    onMutate: ({ candidate, song }) => setPendingKey(`${candidate.band_id}:${song.song_id}`),
    onSuccess: (result) => {
      toast({
        title: result.status === "already_booked" ? "Band already booked" : "Top of the Pops invitation sent",
        description: result.band_name && result.song_title
          ? `${result.band_name} · ${result.song_title} · chart #${result.qualifying_rank}`
          : `Chart #${result.qualifying_rank} invitation is now in the player workflow.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["totp"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not book band",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => setPendingKey(null),
  });

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const candidates = catalog.data?.candidates ?? [];
    if (!needle) return candidates;
    return candidates.filter((candidate) =>
      candidate.band_name.toLowerCase().includes(needle)
      || candidate.genre.toLowerCase().includes(needle)
      || candidate.songs.some((song) => song.song_title.toLowerCase().includes(needle)),
    );
  }, [catalog.data?.candidates, search]);

  if (catalog.isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading eligible Top 40 bands…</CardContent></Card>;
  }

  if (catalog.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load booking pool</AlertTitle>
        <AlertDescription>{(catalog.error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  const data = catalog.data;
  if (!data) return null;

  const canBookEpisode = data.episode_status === "scheduled" || data.episode_status === "inviting";

  return (
    <div className="space-y-4" data-totp-booking-manager>
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Book bands</CardTitle>
              <CardDescription className="mt-1">
                Choose eligible UK Top 40 acts and send their real player invitation. The charting song is locked when you book them.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{data.booked_slots}/{data.max_performances} booked</Badge>
              <Badge variant={data.available_slots > 0 ? "outline" : "destructive"}>{data.available_slots} slots left</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.provisional_snapshot ? (
            <Alert>
              <Clock3 className="h-4 w-4" />
              <AlertTitle>Using the latest available UK chart</AlertTitle>
              <AlertDescription>
                The configured snapshot is {formatDate(data.configured_snapshot_date)}, which is not available yet.
                The booking pool currently uses {formatDate(data.source_snapshot_date)}. The first booking freezes that real snapshot for this episode.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="text-sm text-muted-foreground">
              Eligibility snapshot: {formatDate(data.source_snapshot_date)}
            </div>
          )}

          {!canBookEpisode ? (
            <Alert variant="destructive">
              <Ban className="h-4 w-4" />
              <AlertTitle>Bookings are closed</AlertTitle>
              <AlertDescription>
                This episode is {data.episode_status.replaceAll("_", " ")}. Bands can only be invited before the running order is locked.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="relative max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search band, genre or charting song…"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {search.trim()
              ? "No eligible chart acts match that search."
              : "No UK Streaming or Digital Sales Top 40 acts are available in the booking snapshot yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((candidate) => (
            <CandidateCard
              key={candidate.band_id}
              candidate={candidate}
              availableSlots={data.available_slots}
              canBookEpisode={canBookEpisode}
              onBook={(band, song) => bookBand.mutate({ candidate: band, song })}
              pendingKey={pendingKey}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default TotpBookingManager;
