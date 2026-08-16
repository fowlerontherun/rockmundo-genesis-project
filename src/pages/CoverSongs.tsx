import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { MUSIC_GENRES } from "@/data/genres";
import { Disc3, Flame, Search, Star, TrendingUp, Users } from "lucide-react";
import {
  useCoverableSongs,
  useIncomingCoverRequests,
  useMyBandIds,
  useOutgoingCoverRequests,
  useRequestSongCover,
  useRespondToCoverRequest,
  type CoverPurpose,
  type CoverableSong,
} from "@/hooks/useSongCovers";

const purposeLabels: Record<string, string> = {
  live: "Live sets",
  recording: "Recording",
  both: "Live & recording",
};

const statusVariant = (status: string) =>
  status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";

const CoverSongs = () => {
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [target, setTarget] = useState<CoverableSong | null>(null);
  const [purpose, setPurpose] = useState<CoverPurpose>("live");
  const [message, setMessage] = useState("");

  const { data: bands = [] } = useMyBandIds();
  const bandId = selectedBandId ?? bands[0]?.bandId ?? null;
  const bandIds = useMemo(() => bands.map((b) => b.bandId), [bands]);

  const { data: songs = [], isLoading } = useCoverableSongs({ search, genre, bandId });
  const { data: outgoing = [] } = useOutgoingCoverRequests(bandIds);
  const { data: incoming = [] } = useIncomingCoverRequests(bandIds);

  const requestCover = useRequestSongCover();
  const respond = useRespondToCoverRequest();

  const pendingIncoming = incoming.filter((r) => r.status === "pending");

  const submitRequest = async () => {
    if (!target || !bandId) return;
    await requestCover.mutateAsync({ songId: target.song_id, bandId, purpose, message });
    setTarget(null);
    setMessage("");
    setPurpose("live");
  };

  return (
    <FMPageScaffold
      title="Cover Songs"
      subtitle="Find songs to cover, license them from their writers and manage cover approvals"
      eyebrow="Music"
      icon={Disc3}
      backTo="/music"
      backLabel="Music hub"
      kpis={[
        { label: "Available songs", value: songs.length },
        { label: "Pending approvals", value: pendingIncoming.length },
        { label: "Your requests", value: outgoing.length },
      ]}
      headerActions={
        bands.length > 1 ? (
          <Select value={bandId ?? undefined} onValueChange={setSelectedBandId}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Choose band" />
            </SelectTrigger>
            <SelectContent>
              {bands.map((band) => (
                <SelectItem key={band.bandId} value={band.bandId}>
                  {band.bandName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : undefined
      }
    >
      <Tabs defaultValue="browse">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="browse" className="text-xs">
            Find covers
          </TabsTrigger>
          <TabsTrigger value="requests" className="text-xs">
            Your requests ({outgoing.length})
          </TabsTrigger>
          <TabsTrigger value="approvals" className="text-xs">
            Approvals ({pendingIncoming.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-3 pt-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search song or band"
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genres</SelectItem>
                {MUSIC_GENRES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading catalogue…</p>
          ) : songs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No songs are open to covers right now. Songwriters can list theirs from the Song Manager.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {songs.map((song) => (
                <Card key={song.song_id}>
                  <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{song.title}</span>
                        {song.genre && (
                          <Badge variant="outline" className="text-[10px]">
                            {song.genre}
                          </Badge>
                        )}
                        {song.cover_auto_approve && (
                          <Badge variant="secondary" className="text-[10px]">
                            Instant licence
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {song.owner_band_name ?? "Independent writer"} · Quality {song.quality_score}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[11px]">
                        <span className="flex items-center gap-1 text-purple-500">
                          <Star className="h-3 w-3" /> {song.fame} fame
                        </span>
                        <span className="flex items-center gap-1 text-orange-500">
                          <Flame className="h-3 w-3" /> {song.popularity} popularity
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <TrendingUp className="h-3 w-3" /> peak {song.peak_popularity}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Users className="h-3 w-3" /> {song.gig_play_count} plays
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        {Number(song.cover_royalty_percentage)}% royalty
                      </Badge>
                      {song.existing_request_status ? (
                        <Badge variant={statusVariant(song.existing_request_status)} className="text-[10px]">
                          {song.existing_request_status}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          disabled={!bandId}
                          onClick={() => setTarget(song)}
                        >
                          Request cover
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!bandId && (
            <p className="text-xs text-muted-foreground">Join or form a band to request covers.</p>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-2 pt-3">
          {outgoing.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                You haven't asked to cover any songs yet.
              </CardContent>
            </Card>
          ) : (
            outgoing.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{request.songs?.title ?? "Song"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {request.owner_band?.name ?? "Writer"} · {purposeLabels[request.purpose] ?? request.purpose} ·{" "}
                      {Number(request.royalty_percentage)}% royalty
                    </p>
                    {request.response_message && (
                      <p className="text-xs italic text-muted-foreground mt-1">“{request.response_message}”</p>
                    )}
                  </div>
                  <Badge variant={statusVariant(request.status)} className="text-[10px] shrink-0">
                    {request.status}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="approvals" className="space-y-2 pt-3">
          {incoming.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No cover requests for your songs yet.
              </CardContent>
            </Card>
          ) : (
            incoming.map((request) => (
              <Card key={request.id}>
                <CardHeader className="p-3 pb-0">
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span className="truncate">{request.songs?.title ?? "Song"}</span>
                    <Badge variant={statusVariant(request.status)} className="text-[10px]">
                      {request.status}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {request.requesting_band?.name ?? "A band"} wants it for{" "}
                    {purposeLabels[request.purpose] ?? request.purpose} at {Number(request.royalty_percentage)}%
                    royalties to you.
                  </p>
                  {request.message && <p className="text-xs italic">“{request.message}”</p>}
                  {request.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate({ requestId: request.id, approve: true })
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate({ requestId: request.id, approve: false })
                        }
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request to cover {target?.title}</DialogTitle>
            <DialogDescription>
              The writers keep {Number(target?.cover_royalty_percentage ?? 0)}% of what this cover earns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Intended use</Label>
              <Select value={purpose} onValueChange={(value) => setPurpose(value as CoverPurpose)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live sets only</SelectItem>
                  <SelectItem value="recording">Recording only</SelectItem>
                  <SelectItem value="both">Live sets and recording</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Message to the writers</Label>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Tell them how you'll treat the song…"
                className="text-sm"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitRequest} disabled={requestCover.isPending}>
              {requestCover.isPending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </FMPageScaffold>
  );
};

export default CoverSongs;
