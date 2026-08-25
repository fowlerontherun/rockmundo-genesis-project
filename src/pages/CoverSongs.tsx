import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Disc3, Flame, Search, Star, TrendingUp, Users, ListMusic, Mic2 } from "lucide-react";
import {
  useAddSongToRepertoire,
  useCoverableSongs,
  useGetOrCreateCoverMaster,
  useIncomingCoverRequests,
  useMyBandIds,
  useOutgoingCoverRequests,
  useRequestSongCover,
  useRespondToCoverRequest,
  type CoverableSong,
} from "@/hooks/useSongCovers";

const statusVariant = (status?: string | null) =>
  status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary";

const CoverSongs = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("all");
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null);
  const [target, setTarget] = useState<CoverableSong | null>(null);
  const [message, setMessage] = useState("");

  const { data: bands = [] } = useMyBandIds();
  const bandId = selectedBandId ?? bands[0]?.bandId ?? null;
  const bandIds = useMemo(() => bands.map((band) => band.bandId), [bands]);

  const { data: songs = [], isLoading } = useCoverableSongs({ search, genre, bandId });
  const { data: outgoing = [] } = useOutgoingCoverRequests(bandIds);
  const { data: incoming = [] } = useIncomingCoverRequests(bandIds);
  const addToRepertoire = useAddSongToRepertoire();
  const requestRecording = useRequestSongCover();
  const respond = useRespondToCoverRequest();
  const coverMaster = useGetOrCreateCoverMaster();

  const ourCovers = songs.filter((song) => song.in_repertoire);
  const pendingIncoming = incoming.filter((request) => request.status === "pending");

  const addLiveCover = (song: CoverableSong) => {
    if (!bandId) return;
    addToRepertoire.mutate({ songId: song.song_id, bandId });
  };

  const submitRecordingRequest = async () => {
    if (!target || !bandId) return;
    await requestRecording.mutateAsync({ songId: target.song_id, bandId, message });
    setTarget(null);
    setMessage("");
  };

  const prepareRecording = async (song: CoverableSong) => {
    if (!bandId) return;
    const result = await coverMaster.mutateAsync({ originalSongId: song.song_id, bandId });
    navigate(`/recording-studio?songId=${encodeURIComponent(result.cover_master_id)}`);
  };

  const SongSummary = ({ song }: { song: CoverableSong }) => (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-sm truncate">{song.title}</span>
        {song.genre && <Badge variant="outline" className="text-[10px]">{song.genre}</Badge>}
        {song.in_repertoire && (
          <Badge variant="secondary" className="text-[10px]">
            In repertoire · {song.familiarity_percentage}% familiar
          </Badge>
        )}
        {song.recording_license_status === "approved" && (
          <Badge className="text-[10px]">Recording licensed</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {song.owner_band_name ?? "Unknown band"} · Quality {song.quality_score}
      </p>
      <div className="flex items-center gap-3 mt-1 text-[11px] flex-wrap">
        <span className="flex items-center gap-1 text-purple-500"><Star className="h-3 w-3" /> {song.fame} fame</span>
        <span className="flex items-center gap-1 text-orange-500"><Flame className="h-3 w-3" /> {song.popularity} popularity</span>
        <span className="flex items-center gap-1 text-muted-foreground"><TrendingUp className="h-3 w-3" /> peak {song.peak_popularity}</span>
        <span className="flex items-center gap-1 text-muted-foreground"><Users className="h-3 w-3" /> {song.gig_play_count} original plays</span>
        <span className="flex items-center gap-1 text-muted-foreground"><ListMusic className="h-3 w-3" /> {song.covering_band_count} covering bands</span>
      </div>
    </div>
  );

  const RecordingAction = ({ song }: { song: CoverableSong }) => {
    if (song.recording_license_status === "approved") {
      return (
        <Button size="sm" className="h-8 text-xs" disabled={coverMaster.isPending} onClick={() => prepareRecording(song)}>
          <Mic2 className="h-3 w-3 mr-1" /> Record cover
        </Button>
      );
    }
    if (song.existing_request_status === "pending") {
      return <Badge variant="secondary" className="text-[10px]">Recording request pending</Badge>;
    }
    return (
      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setTarget(song)}>
        Request recording licence
      </Button>
    );
  };

  return (
    <FMPageScaffold
      title="Cover Songs & Repertoire"
      subtitle="Learn other bands' songs for live shows, then request permission separately if you want to record them."
      eyebrow="Music"
      icon={Disc3}
      backTo="/music"
      backLabel="Music hub"
      kpis={[
        { label: "Discoverable songs", value: songs.length },
        { label: "Our live covers", value: ourCovers.length },
        { label: "Requests awaiting you", value: pendingIncoming.length },
      ]}
      headerActions={bands.length > 1 ? (
        <Select value={bandId ?? undefined} onValueChange={setSelectedBandId}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Choose band" /></SelectTrigger>
          <SelectContent>
            {bands.map((band) => <SelectItem key={band.bandId} value={band.bandId}>{band.bandName}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : undefined}
    >
      <Tabs defaultValue="discover">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="discover" className="text-xs">Discover</TabsTrigger>
          <TabsTrigger value="repertoire" className="text-xs">Our Covers ({ourCovers.length})</TabsTrigger>
          <TabsTrigger value="requests" className="text-xs">Recording Requests ({outgoing.length})</TabsTrigger>
          <TabsTrigger value="approvals" className="text-xs">Requests for Our Songs ({pendingIncoming.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="space-y-3 pt-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search song or band" className="pl-8 h-9 text-sm" />
            </div>
            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="w-full sm:w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genres</SelectItem>
                {MUSIC_GENRES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? <p className="text-sm text-muted-foreground">Loading catalogue…</p> : songs.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No finished songs from other bands were found.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {songs.map((song) => (
                <Card key={song.song_id}>
                  <CardContent className="p-3 flex flex-col lg:flex-row lg:items-center gap-3">
                    <SongSummary song={song} />
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {!song.in_repertoire ? (
                        <Button size="sm" className="h-8 text-xs" disabled={!bandId || addToRepertoire.isPending} onClick={() => addLiveCover(song)}>
                          Add to repertoire
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Ready to rehearse for live use</Badge>
                      )}
                      {song.in_repertoire && <RecordingAction song={song} />}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {!bandId && <p className="text-xs text-muted-foreground">Join or form a band to add cover songs.</p>}
        </TabsContent>

        <TabsContent value="repertoire" className="space-y-2 pt-3">
          {ourCovers.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Your band has not added any live covers yet.</CardContent></Card>
          ) : ourCovers.map((song) => (
            <Card key={song.song_id}>
              <CardContent className="p-3 flex flex-col lg:flex-row lg:items-center gap-3">
                <SongSummary song={song} />
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate("/rehearsals")}>Rehearse</Button>
                  <RecordingAction song={song} />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="requests" className="space-y-2 pt-3">
          {outgoing.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No recording-cover requests sent yet.</CardContent></Card>
          ) : outgoing.map((request) => (
            <Card key={request.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{request.songs?.title ?? "Song"}</p>
                  <p className="text-xs text-muted-foreground truncate">{request.owner_band?.name ?? "Writers"} · {Number(request.royalty_percentage)}% writer royalty</p>
                  {request.response_message && <p className="text-xs italic text-muted-foreground mt-1">“{request.response_message}”</p>}
                </div>
                <Badge variant={statusVariant(request.status)} className="text-[10px] shrink-0">{request.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="approvals" className="space-y-2 pt-3">
          {incoming.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No bands have requested recording permission for your songs.</CardContent></Card>
          ) : incoming.map((request) => (
            <Card key={request.id}>
              <CardHeader className="p-3 pb-0">
                <CardTitle className="text-sm flex items-center justify-between gap-2">
                  <span className="truncate">{request.songs?.title ?? "Song"}</span>
                  <Badge variant={statusVariant(request.status)} className="text-[10px]">{request.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {request.requesting_band?.name ?? "A band"} wants to make and commercially release a recording at {Number(request.royalty_percentage)}% writer royalties.
                </p>
                {request.message && <p className="text-xs italic">“{request.message}”</p>}
                {request.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8 text-xs" disabled={respond.isPending} onClick={() => respond.mutate({ requestId: request.id, approve: true })}>Approve</Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={respond.isPending} onClick={() => respond.mutate({ requestId: request.id, approve: false })}>Decline</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request recording licence — {target?.title}</DialogTitle>
            <DialogDescription>
              Live use is already handled by your repertoire. This request is only for making and commercially releasing your own recording. The current writer royalty is {Number(target?.cover_royalty_percentage ?? 0)}%.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-1">
            <Label className="text-xs">Message to the songwriters</Label>
            <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Optional message…" className="text-sm" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={submitRecordingRequest} disabled={requestRecording.isPending}>
              {requestRecording.isPending ? "Sending…" : "Request recording licence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FMPageScaffold>
  );
};

export default CoverSongs;
