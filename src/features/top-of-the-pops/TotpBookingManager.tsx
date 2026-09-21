import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Music2, Search, Send, ShieldAlert, Tv2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  adminBookTotpBand,
  getTotpAdminBookingCatalog,
  type TotpAdminBookingCandidate,
} from "./api";

function formatSnapshot(value: string | null) {
  if (!value) return "No chart snapshot";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Europe/London" })
    .format(new Date(`${value}T12:00:00Z`));
}

function invitationBadge(candidate: TotpAdminBookingCandidate) {
  const status = candidate.invitation?.status;
  if (!status) return null;
  if (status === "accepted" || status === "checked_in" || status === "performed") {
    return <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> {status.replaceAll("_", " ")}</Badge>;
  }
  return <Badge variant="secondary">{status.replaceAll("_", " ")}</Badge>;
}

export function TotpBookingManager({ episodeId }: { episodeId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedSongs, setSelectedSongs] = useState<Record<string, string>>({});

  const catalog = useQuery({
    queryKey: ["totp", "admin-bookings", episodeId],
    queryFn: () => getTotpAdminBookingCatalog(episodeId),
    staleTime: 15_000,
  });

  const booking = useMutation({
    mutationFn: ({ bandId, songId }: { bandId: string; songId: string }) =>
      adminBookTotpBand(episodeId, bandId, songId),
    onSuccess: (result) => {
      toast({
        title: result.status === "already_booked" ? "Band already invited" : "Top of the Pops invitation sent",
        description: result.band_name && result.song_title
          ? `${result.band_name} · ${result.song_title} · chart #${result.qualifying_rank}`
          : `Chart #${result.qualifying_rank} invitation is already on this episode.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["totp"] });
      void queryClient.invalidateQueries({ queryKey: ["totp", "admin-bookings", episodeId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not book band",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const candidates = catalog.data?.candidates ?? [];
    if (!query) return candidates;
    return candidates.filter((candidate) =>
      candidate.band_name.toLowerCase().includes(query)
      || candidate.genre.toLowerCase().includes(query)
      || candidate.songs.some((song) => song.song_title.toLowerCase().includes(query)),
    );
  }, [catalog.data?.candidates, search]);

  if (catalog.isLoading) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading Top of the Pops booking pool…</CardContent></Card>;
  }

  if (catalog.isError) {
    return <Card><CardContent className="p-6 text-sm text-destructive">{(catalog.error as Error).message}</CardContent></Card>;
  }

  const data = catalog.data;
  if (!data) return null;
  const editable = data.episode_status === "scheduled" || data.episode_status === "inviting";

  return (
    <div className="space-y-4" id="totp-bookings">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Tv2 className="h-5 w-5" /> Book bands for Top of the Pops</CardTitle>
          <CardDescription>
            Choose chart-eligible bands and the qualifying song they will be invited to perform. Bands from the previous show remain blocked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Booking slots</div>
              <div className="mt-1 text-xl font-bold">{data.booked_slots}/{data.max_performances}</div>
              <div className="text-xs text-muted-foreground">{data.available_slots} remaining</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Eligibility snapshot</div>
              <div className="mt-1 font-semibold">{formatSnapshot(data.source_snapshot_date)}</div>
              <div className="text-xs text-muted-foreground">UK Streaming + Digital Sales</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Eligible bands</div>
              <div className="mt-1 text-xl font-bold">{data.candidates.filter((row) => row.eligible).length}</div>
              <div className="text-xs text-muted-foreground">{data.candidates.length} charting bands found</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Episode status</div>
              <div className="mt-1 font-semibold capitalize">{data.episode_status}</div>
              <div className="text-xs text-muted-foreground">Episode #{data.episode_number}</div>
            </div>
          </div>

          {data.provisional_snapshot ? (
            <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="font-semibold">Using the latest available chart snapshot</div>
                <p className="mt-1 text-muted-foreground">
                  The scheduled snapshot ({formatSnapshot(data.configured_snapshot_date)}) has no chart data yet.
                  The first manual booking will freeze {formatSnapshot(data.source_snapshot_date)} onto this episode so every invitation uses the same eligibility pool.
                </p>
              </div>
            </div>
          ) : null}

          {!editable ? (
            <div className="flex gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              Bookings are closed because this episode has already moved beyond the invitation stage.
            </div>
          ) : null}

          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search bands, genres or songs…"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {rows.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No chart-eligible bands match this search.</CardContent></Card>
        ) : rows.map((candidate) => {
          const selectedSongId = selectedSongs[candidate.band_id] ?? candidate.songs[0]?.song_id ?? "";
          const selectedSong = candidate.songs.find((song) => song.song_id === selectedSongId) ?? candidate.songs[0] ?? null;
          const blocked = !candidate.eligible
            || !!candidate.invitation
            || data.available_slots <= 0
            || !editable
            || !selectedSong;

          return (
            <Card key={candidate.band_id}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-lg font-semibold">{candidate.band_name}</div>
                      <Badge variant="outline">{candidate.genre}</Badge>
                      <Badge variant="secondary">Best #{candidate.best_rank}</Badge>
                      {invitationBadge(candidate)}
                      {candidate.previous_episode_performer ? (
                        <Badge variant="destructive">previous show</Badge>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {candidate.songs.length} qualifying song{candidate.songs.length === 1 ? "" : "s"} in the selected UK chart snapshot.
                    </div>
                    {candidate.previous_episode_performer ? (
                      <p className="mt-2 text-xs text-destructive">
                        Cannot be booked: artists cannot perform on two Top of the Pops episodes in a row.
                      </p>
                    ) : null}
                  </div>

                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:min-w-[520px] lg:justify-end">
                    <Select
                      value={selectedSongId}
                      onValueChange={(value) => setSelectedSongs((current) => ({ ...current, [candidate.band_id]: value }))}
                      disabled={!!candidate.invitation || !candidate.eligible}
                    >
                      <SelectTrigger className="min-w-0 sm:w-[330px]">
                        <SelectValue placeholder="Choose qualifying song" />
                      </SelectTrigger>
                      <SelectContent>
                        {candidate.songs.map((song) => (
                          <SelectItem key={song.song_id} value={song.song_id}>
                            #{song.qualifying_rank} · {song.song_title} · {song.qualifying_chart.replaceAll("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={() => selectedSong && booking.mutate({ bandId: candidate.band_id, songId: selectedSong.song_id })}
                      disabled={blocked || booking.isPending}
                    >
                      {candidate.invitation ? (
                        <><CheckCircle2 className="mr-2 h-4 w-4" /> Invited</>
                      ) : (
                        <><Send className="mr-2 h-4 w-4" /> Send invite</>
                      )}
                    </Button>
                  </div>
                </div>

                {selectedSong ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                    <Music2 className="h-3.5 w-3.5" />
                    Selected: <span className="font-medium text-foreground">{selectedSong.song_title}</span>
                    <span>· UK #{selectedSong.qualifying_rank}</span>
                    <span>· {selectedSong.qualifying_chart.replaceAll("_", " ")}</span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default TotpBookingManager;
