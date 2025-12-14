import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Music2 } from "lucide-react";

interface SongSelectionStepProps {
  userId: string;
  releaseType: "single" | "ep" | "album";
  selectedSongs: string[];
  onSongsChange: (songs: string[]) => void;
  bandId: string | null;
  onBack: () => void;
  onNext: () => void;
}

export function SongSelectionStep({
  userId,
  releaseType,
  selectedSongs,
  onSongsChange,
  bandId,
  onBack,
  onNext
}: SongSelectionStepProps) {
  const requiredSongs = releaseType === "single" ? 2 : releaseType === "ep" ? 4 : 10;
  const maxSongs = releaseType === "album" ? 20 : requiredSongs;

  const { data: songs } = useQuery({
    queryKey: ["available-songs", userId, bandId],
    queryFn: async () => {
      let allSongs: any[] = [];

      if (bandId) {
        // Get band songs - any recorded song belonging to the band
        // Include songs that have completed recording sessions (status = 'recorded')
        const { data: bandSongs } = await supabase
          .from("songs")
          .select("*")
          .eq("band_id", bandId)
          .eq("status", "recorded")
          .order("created_at", { ascending: false });
        
        allSongs = bandSongs || [];

        // Also get songs from band members that are not assigned to a band
        const { data: bandMembers } = await supabase
          .from("band_members")
          .select("user_id")
          .eq("band_id", bandId);

        if (bandMembers && bandMembers.length > 0) {
          const memberUserIds = bandMembers.map(m => m.user_id).filter(Boolean);
          if (memberUserIds.length > 0) {
            const { data: memberSongs } = await supabase
              .from("songs")
              .select("*")
              .in("user_id", memberUserIds)
              .is("band_id", null)
              .eq("status", "recorded")
              .order("created_at", { ascending: false });

            if (memberSongs) {
              // Merge avoiding duplicates
              const existingIds = new Set(allSongs.map(s => s.id));
              for (const song of memberSongs) {
                if (!existingIds.has(song.id)) {
                  allSongs.push(song);
                }
              }
            }
          }
        }
      } else {
        // Get user's solo songs (all recorded songs by this user)
        const { data: userSongs } = await supabase
          .from("songs")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "recorded")
          .order("created_at", { ascending: false });
        
        allSongs = userSongs || [];
      }

      // Remove duplicates by ID just in case
      const uniqueSongs = Array.from(
        new Map(allSongs.map(s => [s.id, s])).values()
      );

      // Log for debugging
      console.log("Available songs for release:", uniqueSongs.length, uniqueSongs);

      return uniqueSongs;
    }
  });

  const toggleSong = (songId: string) => {
    if (selectedSongs.includes(songId)) {
      onSongsChange(selectedSongs.filter(id => id !== songId));
    } else if (selectedSongs.length < maxSongs) {
      onSongsChange([...selectedSongs, songId]);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">
          Select Songs ({selectedSongs.length}/{maxSongs})
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {releaseType === "single" && "Select 1 A-side and 1 B-side (must be recorded)"}
          {releaseType === "ep" && "Select exactly 4 recorded songs"}
          {releaseType === "album" && "Select 10-20 recorded songs"}
        </p>

        {!songs || songs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Music2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No recorded songs available</p>
            <p className="text-sm mt-1">Record your songs in the Recording Studio first</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {songs?.map((song, index) => (
            <Card key={song.id} className="p-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={selectedSongs.includes(song.id)}
                  onCheckedChange={() => toggleSong(song.id)}
                  disabled={
                    !selectedSongs.includes(song.id) && selectedSongs.length >= maxSongs
                  }
                />
                <div className="flex-1">
                  <div className="font-medium">{song.title}</div>
                  <div className="text-sm text-muted-foreground">{song.genre}</div>
                  {releaseType === "single" && selectedSongs[0] === song.id && (
                    <div className="text-xs text-primary">A-side</div>
                  )}
                  {releaseType === "single" && selectedSongs[1] === song.id && (
                    <div className="text-xs text-muted-foreground">B-side</div>
                  )}
                </div>
              </div>
            </Card>
          ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={selectedSongs.length < requiredSongs}
          className="flex-1"
        >
          Next: Select Formats
        </Button>
      </div>
    </div>
  );
}
