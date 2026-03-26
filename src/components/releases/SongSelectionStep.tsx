import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Music2, Disc3, Album, AlertTriangle, Eye, EyeOff } from "lucide-react";
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
  onRelease?: string | null;
  releaseType?: string | null;
  isGreatestHits?: boolean;
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
  const [showReleasedSongs, setShowReleasedSongs] = useState(false);

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

  // Fetch songs already on releases (singles, EPs, albums) for exclusivity check
  const { data: songsOnReleases } = useQuery({
    queryKey: ["songs-on-releases", userId, bandId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_songs_on_releases", {
        p_band_id: bandId,
        p_user_id: bandId ? null : userId
      });
      if (error) {
        console.error("Error fetching songs on releases:", error);
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
          .select("song_id, releases!release_songs_release_id_fkey!inner(release_status)")
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

      // Build release lookup (songs used in any release - singles, EPs, albums)
      const releaseLookup = new Map<string, { title: string; releaseType: string }>();
      if (songsOnReleases) {
        for (const sor of songsOnReleases) {
          // Only store the first release found (for display purposes)
          if (!releaseLookup.has(sor.song_id)) {
            releaseLookup.set(sor.song_id, { title: sor.release_title, releaseType: sor.release_type });
          }
        }
      }

      // Build list with versions - each recorded version is a separate entry
      const songsWithVersions: SongWithVersion[] = [];
      const processedVersions = new Set<string>();

      for (const song of allSongs) {
        const songSessions = recordingSessions.filter(s => s.song_id === song.id);
        const releaseInfo = releaseLookup.get(song.id) || null;
        
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
                onRelease: releaseInfo?.title || null,
                releaseType: releaseInfo?.releaseType || null,
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
              onRelease: releaseInfo?.title || null,
              releaseType: releaseInfo?.releaseType || null,
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
  
  // Determine if a song should be hidden (not just disabled)
  const isSongHidden = (song: SongWithVersion) => {
    if (isGreatestHits) return false; // Greatest hits shows all released songs
    if (!song.onRelease) return false; // Not on any release = show it
    if (showReleasedSongs) return false; // User toggled to show all
    // For albums: hide songs already on an album
    if (releaseType === "album" && song.releaseType === "album") return true;
    // For singles/EPs: hide songs already on any release
    if (releaseType === "single" || releaseType === "ep") return true;
    // For albums: songs on singles/EPs are still available for albums
    return false;
  };

  // Songs already on any release are disabled (can't select) - except for greatest hits
  const isSongDisabled = (song: SongWithVersion) => {
    if (isGreatestHits) return false;
    if (song.onRelease) {
      // For albums: only disable if already on an album
      if (releaseType === "album") return song.releaseType === "album";
      return true; // Singles/EPs: any prior release = disabled
    }
    return false;
  };

  const visibleSongs = songs?.filter(song => !isSongHidden(song)) || [];
  const hiddenCount = (songs?.length || 0) - visibleSongs.length;

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

        {!isGreatestHits && (
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {releaseType === "album" 
                ? "Songs already on an album are hidden. Songs from singles/EPs can be included."
                : "Songs already on a release are hidden."
              }
            </AlertDescription>
          </Alert>
        )}

        {!isGreatestHits && hiddenCount > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Switch 
              id="show-released" 
              checked={showReleasedSongs} 
              onCheckedChange={setShowReleasedSongs} 
            />
            <Label htmlFor="show-released" className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5">
              {showReleasedSongs ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {showReleasedSongs ? "Showing" : "Show"} {hiddenCount} already-released song{hiddenCount !== 1 ? 's' : ''}
            </Label>
          </div>
        )}

        {isGreatestHits && (
          <Alert className="mb-4 border-warning/30 bg-warning/5">
            <AlertDescription className="text-sm">
              Greatest Hits albums can include any of your previously released songs, even if they're already on another release.
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
        ) : visibleSongs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Music2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">All songs are already on releases</p>
            <p className="text-sm mt-1">Record new songs or toggle the switch above to see them.</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {visibleSongs.map((song) => {
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
                        {song.onRelease && (
                          <Badge variant="outline" className="text-xs border-warning/50">
                            <Album className="h-3 w-3 mr-1" />
                            On: {song.onRelease} ({song.releaseType})
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
