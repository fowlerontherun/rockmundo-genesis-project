import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Sparkles, Music2, Trophy, Vote, Loader2, CheckCircle, Crown, Flag, Play, Pause } from "lucide-react";

// Simple inline audio player component
function SimpleAudioPlayer({ audioUrl, title }: { audioUrl: string; title: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex items-center gap-2">
      <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={togglePlay}>
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
    </div>
  );
}
const EUROVISION_COUNTRIES = [
  "Albania", "Armenia", "Australia", "Austria", "Azerbaijan", "Belgium", "Bulgaria", 
  "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France", 
  "Georgia", "Germany", "Greece", "Iceland", "Ireland", "Israel", "Italy", "Latvia", 
  "Lithuania", "Luxembourg", "Malta", "Moldova", "Montenegro", "Netherlands", 
  "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "San Marino", 
  "Serbia", "Slovenia", "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom"
];

interface EurovisionEvent {
  id: string;
  year: number;
  status: "submissions" | "voting" | "complete";
  host_city: string | null;
  host_country: string | null;
}

interface EurovisionEntry {
  id: string;
  event_id: string;
  band_id: string;
  song_id: string;
  country: string;
  vote_count: number;
  final_rank: number | null;
  band: { name: string; logo_url: string | null } | null;
  song: { title: string; audio_url: string | null } | null;
}

export default function Eurovision() {
  const { user } = useAuth();
  const { data: primaryBand } = usePrimaryBand();
  const queryClient = useQueryClient();
  const [selectedSongId, setSelectedSongId] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");

  // Fetch current Eurovision event
  const { data: currentEvent, isLoading: eventLoading } = useQuery({
    queryKey: ["eurovision-current-event"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eurovision_events")
        .select("*")
        .order("year", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as EurovisionEvent | null;
    },
  });

  // Fetch entries for current event
  const { data: entries = [], isLoading: entriesLoading } = useQuery({
    queryKey: ["eurovision-entries", currentEvent?.id],
    queryFn: async () => {
      if (!currentEvent?.id) return [];
      const { data, error } = await supabase
        .from("eurovision_entries")
        .select(`
          id, event_id, band_id, song_id, country, vote_count, final_rank,
          band:bands(name, logo_url),
          song:songs(title, audio_url)
        `)
        .eq("event_id", currentEvent.id)
        .order("vote_count", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as EurovisionEntry[];
    },
    enabled: !!currentEvent?.id,
  });

  // Check if user's band has already submitted
  const userEntry = entries.find(e => e.band_id === primaryBand?.id);

  // Fetch user's recorded songs for submission
  const { data: recordedSongs = [] } = useQuery({
    queryKey: ["recorded-songs-for-eurovision", primaryBand?.id],
    queryFn: async () => {
      if (!primaryBand?.id) return [];
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, audio_url")
        .eq("band_id", primaryBand.id)
        .eq("status", "recorded")
        .not("audio_url", "is", null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!primaryBand?.id && currentEvent?.status === "submissions",
  });

  // Check user's votes
  const { data: userVotes = [] } = useQuery({
    queryKey: ["eurovision-user-votes", currentEvent?.id, user?.id],
    queryFn: async () => {
      if (!currentEvent?.id || !user?.id) return [];
      const { data, error } = await supabase
        .from("eurovision_votes")
        .select("entry_id")
        .eq("voter_id", user.id);
      if (error) throw error;
      return data.map(v => v.entry_id);
    },
    enabled: !!currentEvent?.id && !!user?.id,
  });

  // Submit entry mutation
  const submitEntryMutation = useMutation({
    mutationFn: async () => {
      if (!currentEvent?.id || !primaryBand?.id || !selectedSongId || !selectedCountry) {
        throw new Error("Missing required fields");
      }
      const { error } = await supabase
        .from("eurovision_entries")
        .insert({
          event_id: currentEvent.id,
          band_id: primaryBand.id,
          song_id: selectedSongId,
          country: selectedCountry,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eurovision-entries"] });
      toast.success("Entry submitted successfully!");
      setSelectedSongId("");
      setSelectedCountry("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Vote mutation
  const voteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      if (!user?.id) throw new Error("Must be logged in to vote");
      const { error } = await supabase
        .from("eurovision_votes")
        .insert({ entry_id: entryId, voter_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eurovision-entries"] });
      queryClient.invalidateQueries({ queryKey: ["eurovision-user-votes"] });
      toast.success("Vote cast!");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Remove vote mutation
  const removeVoteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      if (!user?.id) throw new Error("Must be logged in");
      const { error } = await supabase
        .from("eurovision_votes")
        .delete()
        .eq("entry_id", entryId)
        .eq("voter_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eurovision-entries"] });
      queryClient.invalidateQueries({ queryKey: ["eurovision-user-votes"] });
      toast.success("Vote removed");
    },
  });

  // Withdraw entry mutation
  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!userEntry?.id) throw new Error("No entry to withdraw");
      const { error } = await supabase
        .from("eurovision_entries")
        .delete()
        .eq("id", userEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eurovision-entries"] });
      toast.success("Entry withdrawn");
    },
  });

  const takenCountries = entries.map(e => e.country);
  const availableCountries = EUROVISION_COUNTRIES.filter(c => !takenCountries.includes(c));

  if (eventLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentEvent) {
    return (
      <div className="container mx-auto max-w-4xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Eurovision Song Contest</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Active Eurovision Event</h2>
            <p className="text-muted-foreground">Check back later for the next Eurovision season!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColors = {
    submissions: "bg-blue-500",
    voting: "bg-amber-500",
    complete: "bg-emerald-500",
  };

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Eurovision {currentEvent.year}</h1>
            {currentEvent.host_city && (
              <p className="text-muted-foreground">
                Hosted in {currentEvent.host_city}, {currentEvent.host_country}
              </p>
            )}
          </div>
        </div>
        <Badge className={`${statusColors[currentEvent.status]} text-white px-4 py-2 text-sm`}>
          {currentEvent.status === "submissions" && "Submissions Open"}
          {currentEvent.status === "voting" && "Voting Open"}
          {currentEvent.status === "complete" && "Competition Complete"}
        </Badge>
      </div>

      {/* Your Entry Section */}
      {currentEvent.status === "submissions" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music2 className="h-5 w-5" />
              {userEntry ? "Your Entry" : "Submit Your Entry"}
            </CardTitle>
            <CardDescription>
              {userEntry 
                ? "Your band is competing in this year's Eurovision!" 
                : "Enter your band's song to represent a country"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {userEntry ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                  <Flag className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <p className="font-semibold">{userEntry.band?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Representing {userEntry.country} with "{userEntry.song?.title}"
                    </p>
                  </div>
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                </div>
                {userEntry.song?.audio_url && (
                  <SimpleAudioPlayer 
                    audioUrl={userEntry.song.audio_url} 
                    title={userEntry.song.title || "Song"} 
                  />
                )}
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => withdrawMutation.mutate()}
                  disabled={withdrawMutation.isPending}
                >
                  Withdraw Entry
                </Button>
              </div>
            ) : primaryBand ? (
              <div className="space-y-4">
                {recordedSongs.length === 0 ? (
                  <p className="text-muted-foreground">
                    You need at least one recorded song with audio to enter Eurovision.
                  </p>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Select Song</label>
                        <Select value={selectedSongId} onValueChange={setSelectedSongId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose your entry song" />
                          </SelectTrigger>
                          <SelectContent>
                            {recordedSongs.map(song => (
                              <SelectItem key={song.id} value={song.id}>
                                {song.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Represent Country</label>
                        <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a country" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCountries.map(country => (
                              <SelectItem key={country} value={country}>
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      onClick={() => submitEntryMutation.mutate()}
                      disabled={!selectedSongId || !selectedCountry || submitEntryMutation.isPending}
                    >
                      {submitEntryMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Submit Entry
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">
                You need to be in a band to enter Eurovision.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leaderboard / Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentEvent.status === "complete" ? (
              <>
                <Trophy className="h-5 w-5 text-amber-500" />
                Final Results
              </>
            ) : (
              <>
                <Vote className="h-5 w-5" />
                {currentEvent.status === "voting" ? "Vote for Your Favorites" : "Current Entries"}
              </>
            )}
          </CardTitle>
          <CardDescription>
            {entries.length} entries competing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No entries yet. Be the first to submit!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Artist</TableHead>
                  <TableHead>Song</TableHead>
                  <TableHead className="text-right">Votes</TableHead>
                  {currentEvent.status === "voting" && <TableHead className="w-24"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, idx) => {
                  const hasVoted = userVotes.includes(entry.id);
                  const isOwnEntry = entry.band_id === primaryBand?.id;
                  
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        {idx === 0 && currentEvent.status === "complete" ? (
                          <Crown className="h-5 w-5 text-amber-500" />
                        ) : (
                          <span className="text-muted-foreground">{idx + 1}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{entry.country}</TableCell>
                      <TableCell>{entry.band?.name || "Unknown"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {entry.song?.title || "Unknown"}
                          {entry.song?.audio_url && (
                            <SimpleAudioPlayer 
                              audioUrl={entry.song.audio_url} 
                              title={entry.song.title || "Song"} 
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {entry.vote_count}
                      </TableCell>
                      {currentEvent.status === "voting" && (
                        <TableCell>
                          {isOwnEntry ? (
                            <Badge variant="secondary">Your Entry</Badge>
                          ) : hasVoted ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeVoteMutation.mutate(entry.id)}
                              disabled={removeVoteMutation.isPending}
                            >
                              Voted ✓
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => voteMutation.mutate(entry.id)}
                              disabled={voteMutation.isPending}
                            >
                              Vote
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
