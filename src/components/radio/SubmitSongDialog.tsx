import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Music, CheckCircle2, XCircle, AlertTriangle, Lock, MapPin } from "lucide-react";
import { useRadioStations, type RadioStation } from "@/hooks/useRadioStations";

interface SubmitSongDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  station: RadioStation;
}

export const SubmitSongDialog = ({ open, onOpenChange, station }: SubmitSongDialogProps) => {
  const [selectedSongId, setSelectedSongId] = useState<string>("");
  const { submitToStation, isSubmitting } = useRadioStations();

  // Fetch user's band and country fame
  const { data: bandData } = useQuery({
    queryKey: ["user-band-for-radio"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return null;

      const { data: band } = await supabase
        .from("bands")
        .select("id, name, fame")
        .eq("leader_id", profile.id)
        .maybeSingle();

      return band;
    },
    enabled: open,
  });

  // Check if band has visited this station's country
  const { data: hasVisitedCountry = false } = useQuery({
    queryKey: ["visited-country-check", bandData?.id, station.country],
    queryFn: async () => {
      if (!bandData?.id || !station.country) return false;
      const { data } = await supabase
        .from("band_country_fans")
        .select("id")
        .eq("band_id", bandData.id)
        .eq("country", station.country)
        .eq("has_performed", true)
        .maybeSingle();
      return !!data;
    },
    enabled: !!bandData?.id && !!station.country && open,
  });

  // Fetch band's fame in the station's country
  const { data: countryFame = 0 } = useQuery({
    queryKey: ["band-country-fame", bandData?.id, station.country],
    queryFn: async () => {
      if (!bandData?.id || !station.country) return 0;

      const { data } = await supabase.rpc("get_band_country_fame", {
        p_band_id: bandData.id,
        p_country: station.country,
      });

      return data || 0;
    },
    enabled: !!bandData?.id && !!station.country && open,
  });

  const minFameRequired = station.min_fame_required || 0;
  const hasEnoughFame = countryFame >= minFameRequired;

  // Fetch user's released songs AND songs with upcoming releases
  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["user-songs-for-radio"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get released songs
      const { data: releasedSongs, error: releasedError } = await supabase
        .from("songs")
        .select("id, title, genre, quality_score, status, band_id")
        .eq("user_id", user.id)
        .eq("status", "released")
        .order("created_at", { ascending: false });

      if (releasedError) throw releasedError;

      // Get songs with upcoming releases (status: manufacturing, released)
      const { data: releaseSongs, error: releaseError } = await supabase
        .from("release_songs")
        .select(`
          song:songs!inner(id, title, genre, quality_score, status, user_id, band_id)
        `)
        .eq("song.user_id", user.id);

      if (releaseError) throw releaseError;

      // Combine and deduplicate by song ID
      const songMap = new Map<string, any>();
      
      for (const song of releasedSongs || []) {
        songMap.set(song.id, { ...song, hasRelease: false });
      }
      
      for (const rs of releaseSongs || []) {
        const song = rs.song as any;
        if (song && !songMap.has(song.id)) {
          songMap.set(song.id, { 
            id: song.id, 
            title: song.title, 
            genre: song.genre, 
            quality_score: song.quality_score,
            status: song.status,
            band_id: song.band_id,
            hasRelease: true 
          });
        } else if (song && songMap.has(song.id)) {
          songMap.get(song.id).hasRelease = true;
        }
      }

      return Array.from(songMap.values());
    },
    enabled: open,
  });

  const handleSubmit = () => {
    if (!selectedSongId) return;
    const song = songs.find(s => s.id === selectedSongId);

    submitToStation({
      stationId: station.id,
      songId: selectedSongId,
      bandId: song?.band_id,
    });

    onOpenChange(false);
    setSelectedSongId("");
  };

  const isGenreMatch = (songGenre: string) => {
    if (!station.accepted_genres || station.accepted_genres.length === 0) return true;
    return station.accepted_genres.some(g => 
      g.toLowerCase() === songGenre.toLowerCase()
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Song to {station.name}</DialogTitle>
          <DialogDescription>
            Select a released song to submit for radio airplay consideration.
            {station.accepted_genres && station.accepted_genres.length > 0 && (
              <span className="block mt-2">
                This station plays: {station.accepted_genres.join(", ")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Country Fame Requirement Alert */}
        {minFameRequired > 0 && (
          <Alert variant={hasEnoughFame ? "default" : "destructive"} className="mb-4">
            <MapPin className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                {station.country} fame required: <strong>{minFameRequired}</strong>
              </span>
              <Badge variant={hasEnoughFame ? "default" : "destructive"}>
                Your fame: {countryFame}
              </Badge>
            </AlertDescription>
          </Alert>
        )}

        {!hasVisitedCountry ? (
          <div className="py-8 text-center text-muted-foreground">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="font-medium">Country Not Visited</p>
            <p className="text-sm mt-2">
              You must perform in {station.country} before you can submit songs to stations there. Book a gig or tour to unlock radio access.
            </p>
          </div>
        ) : !hasEnoughFame && minFameRequired > 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="font-medium">Station Locked</p>
            <p className="text-sm mt-2">
              Build more fame in {station.country} through gigs, radio plays, and PR to unlock this station.
            </p>
          </div>
        ) : isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading songs...</div>
        ) : songs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No songs available. You need a released song or a song with an upcoming release to submit to radio.
          </div>
        ) : (
          <RadioGroup value={selectedSongId} onValueChange={setSelectedSongId}>
            <div className="space-y-3">
              {songs.map((song) => {
                const genreMatch = isGenreMatch(song.genre || "");
                return (
                  <div
                    key={song.id}
                    className={`flex items-center space-x-3 p-4 rounded-lg border ${
                      selectedSongId === song.id
                        ? "border-primary bg-accent"
                        : "border-border hover:bg-accent/50"
                    } transition-colors cursor-pointer`}
                    onClick={() => setSelectedSongId(song.id)}
                  >
                    <RadioGroupItem value={song.id} id={song.id} />
                    <Label
                      htmlFor={song.id}
                      className="flex-1 cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <Music className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{song.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {song.genre}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Quality: {song.quality_score}/1000
                            </span>
                          </div>
                        </div>
                      </div>
                      {genreMatch ? (
                        <Badge variant="default" className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Genre Match
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          Genre Mismatch
                        </Badge>
                      )}
                    </Label>
                  </div>
                );
              })}
            </div>
          </RadioGroup>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedSongId || isSubmitting || !hasEnoughFame || !hasVisitedCountry}
          >
            {isSubmitting ? "Submitting..." : "Submit Song"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
