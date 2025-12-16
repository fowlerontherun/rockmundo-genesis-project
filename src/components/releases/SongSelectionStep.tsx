import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Music2, Disc3 } from "lucide-react";

export interface SongSelection {
  songId: string;
  version: string;
  displayKey: string;
}

interface SongSelectionStepProps {
  userId: string;
  releaseType: "single" | "ep" | "album";
  selectedSongs: SongSelection[];
  onSongsChange: (songs: SongSelection[]) => void;
  bandId: string | null;
  onBack: () => void;
  onNext: () => void;
}

interface SongWithVersion {
  id: string;
  songId: string;
  title: string;
  genre: string;
  version: string;
  qualityScore: number;
  recordedAt: string | null;
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
  // Singles allow 1-2 songs, EPs 3-6, Albums 7-20
  const minSongs = releaseType === "single" ? 1 : releaseType === "ep" ? 3 : 7;
  const maxSongs = releaseType === "single" ? 2 : releaseType === "ep" ? 6 : 20;

  const { data: songs } = useQuery({
    queryKey: ["available-songs-versions", userId, bandId],
    queryFn: async () => {
      let allSongs: any[] = [];

      if (bandId) {
        // Get band songs
        const { data: bandSongs } = await supabase
          .from("songs")
          .select("*")
          .eq("band_id", bandId)
          .eq("status", "recorded")
          .order("created_at", { ascending: false });
        
        allSongs = bandSongs || [];

        // Also get songs from band members
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
        // Get user's solo songs
        const { data: userSongs } = await supabase
          .from("songs")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "recorded")
          .order("created_at", { ascending: false });
        
        allSongs = userSongs || [];
      }

      // Get all recording sessions for these songs to find versions
      const songIds = allSongs.map(s => s.id);
      let recordingSessions: any[] = [];

      if (songIds.length > 0) {
        const { data: sessions } = await supabase
          .from("recording_sessions")
          .select("id, song_id, recording_version, quality_improvement, completed_at")
          .in("song_id", songIds)
          .eq("status", "completed")
          .order("completed_at", { ascending: false });

        recordingSessions = sessions || [];
      }

      // Build list with versions - each recorded version is a separate entry
      const songsWithVersions: SongWithVersion[] = [];
      const processedVersions = new Set<string>();

      for (const song of allSongs) {
        const songSessions = recordingSessions.filter(s => s.song_id === song.id);
        
        if (songSessions.length > 0) {
          // Group by version type
          const versionMap = new Map<string, any>();
          for (const session of songSessions) {
            const version = session.recording_version || "Standard";
            if (!versionMap.has(version)) {
              versionMap.set(version, session);
            }
          }

          // Create entry for each unique version
          for (const [version, session] of versionMap) {
            const key = `${song.id}-${version}`;
            if (!processedVersions.has(key)) {
              processedVersions.add(key);
              songsWithVersions.push({
                id: key,
                songId: song.id,
                title: song.title,
                genre: song.genre,
                version,
                qualityScore: song.quality_score || 0,
                recordedAt: session.completed_at
              });
            }
          }
        } else {
          // Song is recorded but no session records - add as Standard
          const key = `${song.id}-Standard`;
          if (!processedVersions.has(key)) {
            processedVersions.add(key);
            songsWithVersions.push({
              id: key,
              songId: song.id,
              title: song.title,
              genre: song.genre,
              version: "Standard",
              qualityScore: song.quality_score || 0,
              recordedAt: song.updated_at
            });
          }
        }
      }

      return songsWithVersions;
    }
  });

  const toggleSong = (song: SongWithVersion) => {
    const isSelected = selectedSongs.some(s => s.displayKey === song.id);
    if (isSelected) {
      onSongsChange(selectedSongs.filter(s => s.displayKey !== song.id));
    } else if (selectedSongs.length < maxSongs) {
      onSongsChange([...selectedSongs, {
        songId: song.songId,
        version: song.version,
        displayKey: song.id
      }]);
    }
  };

  const isSelected = (songId: string) => selectedSongs.some(s => s.displayKey === songId);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">
          Select Songs ({selectedSongs.length}/{maxSongs})
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {releaseType === "single" && "Select 1-2 recorded songs (A-side, optional B-side)"}
          {releaseType === "ep" && "Select 3-6 recorded songs"}
          {releaseType === "album" && "Select 7-20 recorded songs"}
        </p>

        {!songs || songs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Music2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No recorded songs available</p>
            <p className="text-sm mt-1">Record your songs in the Recording Studio first</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {songs?.map((song) => (
            <Card key={song.id} className="p-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={isSelected(song.id)}
                  onCheckedChange={() => toggleSong(song)}
                  disabled={!isSelected(song.id) && selectedSongs.length >= maxSongs}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{song.title}</span>
                    <Badge 
                      variant={song.version === "Standard" ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      <Disc3 className="h-3 w-3 mr-1" />
                      {song.version}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span>{song.genre}</span>
                    <span>•</span>
                    <span>Quality: {song.qualityScore}</span>
                  </div>
                  {releaseType === "single" && selectedSongs[0]?.displayKey === song.id && (
                    <div className="text-xs text-primary">A-side</div>
                  )}
                  {releaseType === "single" && selectedSongs[1]?.displayKey === song.id && (
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
          disabled={selectedSongs.length < minSongs}
          className="flex-1"
        >
          Next: Select Formats
        </Button>
      </div>
    </div>
  );
}
