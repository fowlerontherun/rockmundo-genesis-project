import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Music2, Disc3, Album, AlertTriangle } from "lucide-react";
import { ReleaseType } from "./ReleaseTypeSelector";

export interface SongSelection {
  songId: string;
  version: string;
  displayKey: string;
}

interface SongSelectionStepProps {
  userId: string;
  releaseType: ReleaseType;
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
  onAlbum?: string | null;
  albumReleaseId?: string | null;
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
  // Determine min/max songs based on release type
  const getSongLimits = () => {
    switch (releaseType) {
      case "single": return { min: 1, max: 2 };
      case "ep": return { min: 3, max: 6 };
      case "album": return { min: 7, max: 20 };
      case "greatest_hits": return { min: 10, max: 25 };
      default: return { min: 1, max: 2 };
    }
  };
  
  const { min: minSongs, max: maxSongs } = getSongLimits();
  const isGreatestHits = releaseType === "greatest_hits";

  // Fetch songs already on albums for exclusivity check
  const { data: songsOnAlbums } = useQuery({
    queryKey: ["songs-on-albums", userId, bandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_songs_on_albums", {
        p_band_id: bandId,
        p_user_id: bandId ? null : userId
      });
      if (error) {
        console.error("Error fetching songs on albums:", error);
        return [];
      }
      return data || [];
    }
  });

  const { data: songs } = useQuery({
    queryKey: ["available-songs-versions", userId, bandId, releaseType],
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

      // For greatest hits, only show songs that have been released
      if (isGreatestHits) {
        const { data: releasedSongIds } = await supabase
          .from("release_songs")
          .select("song_id, releases!inner(release_status)")
          .eq("releases.release_status", "released");
        
        const releasedIds = new Set(releasedSongIds?.map(rs => rs.song_id) || []);
        allSongs = allSongs.filter(s => releasedIds.has(s.id));
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

      // Build album lookup
      const albumLookup = new Map<string, string>();
      if (songsOnAlbums) {
        for (const soa of songsOnAlbums) {
          albumLookup.set(soa.song_id, soa.album_title);
        }
      }

      // Build list with versions - each recorded version is a separate entry
      const songsWithVersions: SongWithVersion[] = [];
      const processedVersions = new Set<string>();

      for (const song of allSongs) {
        const songSessions = recordingSessions.filter(s => s.song_id === song.id);
        const onAlbum = albumLookup.get(song.id) || null;
        
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
                recordedAt: session.completed_at,
                onAlbum,
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
              recordedAt: song.updated_at,
              onAlbum,
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
  
  // For albums (not greatest hits), songs already on albums are disabled
  const isSongDisabled = (song: SongWithVersion) => {
    if (isGreatestHits) return false; // Greatest hits can include any released song
    if (releaseType === "album" && song.onAlbum) return true; // Can't add to another album
    return false;
  };

  const getReleaseTypeDescription = () => {
    switch (releaseType) {
      case "single": return "Select 1-2 recorded songs (A-side, optional B-side)";
      case "ep": return "Select 3-6 recorded songs";
      case "album": return "Select 7-20 recorded songs";
      case "greatest_hits": return "Select 10-25 of your best released songs";
      default: return "";
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold mb-2">
          Select Songs ({selectedSongs.length}/{maxSongs})
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {getReleaseTypeDescription()}
        </p>

        {releaseType === "album" && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Songs can only appear on one album. Songs already on an album are grayed out but can still be used in greatest hits compilations.
            </AlertDescription>
          </Alert>
        )}

        {isGreatestHits && (
          <Alert className="mb-4 border-amber-500/30 bg-amber-500/5">
            <AlertDescription className="text-sm">
              Greatest Hits albums can include any of your previously released songs, even if they're already on another album.
            </AlertDescription>
          </Alert>
        )}

        {!songs || songs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Music2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">
              {isGreatestHits ? "No released songs available" : "No recorded songs available"}
            </p>
            <p className="text-sm mt-1">
              {isGreatestHits 
                ? "Release some songs first before creating a Greatest Hits album"
                : "Record your songs in the Recording Studio first"
              }
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {songs?.map((song) => {
              const disabled = isSongDisabled(song);
              const selected = isSelected(song.id);
              
              return (
                <Card 
                  key={song.id} 
                  className={`p-4 ${disabled && !selected ? "opacity-50" : ""}`}
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => !disabled && toggleSong(song)}
                      disabled={disabled || (!selected && selectedSongs.length >= maxSongs)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{song.title}</span>
                        <Badge 
                          variant={song.version === "Standard" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          <Disc3 className="h-3 w-3 mr-1" />
                          {song.version}
                        </Badge>
                        {song.onAlbum && (
                          <Badge variant="outline" className="text-xs border-amber-500/50">
                            <Album className="h-3 w-3 mr-1" />
                            On: {song.onAlbum}
                          </Badge>
                        )}
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
              );
            })}
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
