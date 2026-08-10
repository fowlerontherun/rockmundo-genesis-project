import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Music, TrendingUp, Disc3, CheckCircle2, Search, Filter, AlertTriangle } from "lucide-react";
import { getRehearsalLevel, formatRehearsalTime, REHEARSAL_LEVELS } from "@/utils/rehearsalLevels";

interface SongSelectorProps {
  userId: string;
  profileId?: string | null;
  bandId?: string;
  selectedSong: any;
  onSelect: (song: any) => void;
}

export const SongSelector = ({ userId, profileId, bandId, selectedSong, onSelect }: SongSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [recordedFilter, setRecordedFilter] = useState<string>("all");
  const [rehearsalFilter, setRehearsalFilter] = useState<string>("all");

  const { data: songs, isLoading, error } = useQuery({
    queryKey: ['recordable-songs', userId, profileId, bandId],
    queryFn: async () => {
      const RECORDABLE_STATUSES = ['draft', 'completed', 'written', 'recorded'];
      const selectClause = `
          *,
          band_song_familiarity!song_id (
            familiarity_minutes,
            familiarity_percentage,
            rehearsal_stage,
            band_id
          )
        `;

      const baseQuery = () => supabase
        .from('songs')
        .select(selectClause)
        .in('status', RECORDABLE_STATUSES)
        .or('archived.is.null,archived.eq.false')
        .order('created_at', { ascending: false });

      const requests: Array<Promise<any>> = [];

      // Band repertoire (songs written by any member for this band)
      if (bandId) requests.push(baseQuery().eq('band_id', bandId));

      // Songs this band owns even if the song row isn't stamped with band_id
      if (bandId) {
        requests.push(
          (async () => {
            const { data: owned, error: ownedError } = await (supabase as any)
              .from('band_song_ownership')
              .select('song_id')
              .eq('band_id', bandId);
            if (ownedError || !owned?.length) return { data: [], error: null };
            return baseQuery().in('id', owned.map((row: any) => row.song_id));
          })()
        );
      }

      // The active character's own songs (personal catalogue)
      if (profileId) requests.push(baseQuery().eq('profile_id', profileId));
      else if (userId) requests.push(baseQuery().eq('user_id', userId));

      const results = await Promise.all(requests);
      const firstError = results.find((res) => res?.error)?.error;
      if (firstError) throw firstError;

      const deduped = new Map<string, any>();
      for (const res of results) {
        for (const song of (res?.data ?? [])) {
          if (!deduped.has(song.id)) deduped.set(song.id, song);
        }
      }
      const data = [...deduped.values()].sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      );


      // Get recording history for these songs
      const songIds = data?.map(s => s.id) || [];
      let recordingHistory: Record<string, { count: number; versions: string[] }> = {};

      if (songIds.length > 0) {
        const { data: recordings, error: recordingsError } = await supabase
          .from('recording_sessions')
          .select('song_id, recording_version, status')
          .in('song_id', songIds)
          .eq('status', 'completed');

        if (recordingsError) throw recordingsError;

        if (recordings) {
          for (const rec of recordings) {
            if (!recordingHistory[rec.song_id]) {
              recordingHistory[rec.song_id] = { count: 0, versions: [] };
            }
            recordingHistory[rec.song_id].count++;
            if (rec.recording_version) {
              recordingHistory[rec.song_id].versions.push(rec.recording_version);
            }
          }
        }
      }
      
      // Filter familiarity data to only include the current band
      return data?.map(song => ({
        ...song,
        band_song_familiarity: bandId 
          ? song.band_song_familiarity?.filter((f: any) => f.band_id === bandId)
          : song.band_song_familiarity,
        recordingHistory: recordingHistory[song.id] || { count: 0, versions: [] }
      }));
    },
  });

  const filteredSongs = useMemo(() => {
    if (!songs) return [];
    
    return songs.filter(song => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!song.title.toLowerCase().includes(query) && 
            !song.genre?.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Recorded status filter
      const hasBeenRecorded = song.recordingHistory.count > 0;
      if (recordedFilter === "recorded" && !hasBeenRecorded) return false;
      if (recordedFilter === "unrecorded" && hasBeenRecorded) return false;

      // Rehearsal level filter
      if (rehearsalFilter !== "all" && bandId) {
        const familiarityMinutes = song.band_song_familiarity?.[0]?.familiarity_minutes || 0;
        const rehearsalInfo = getRehearsalLevel(familiarityMinutes);
        
        if (rehearsalFilter === "perfected" && rehearsalInfo.level !== 4) return false;
        if (rehearsalFilter === "well_rehearsed" && rehearsalInfo.level < 3) return false;
        if (rehearsalFilter === "familiar" && rehearsalInfo.level < 2) return false;
        if (rehearsalFilter === "learning" && rehearsalInfo.level < 1) return false;
        if (rehearsalFilter === "unlearned" && rehearsalInfo.level !== 0) return false;
      }

      return true;
    });
  }, [songs, searchQuery, recordedFilter, rehearsalFilter, bandId]);

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading songs...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
        <p className="font-medium text-destructive">Could not load songs for recording.</p>
        <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Please try again before booking a studio session."}</p>
      </div>
    );
  }

  if (!songs || songs.length === 0) {
    return (
      <div className="text-center py-12">
        <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No songs available to record.</p>
        <p className="text-sm text-muted-foreground mt-2">Complete a songwriting project first!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg border">
        <div className="space-y-1.5">
          <Label htmlFor="search" className="text-xs flex items-center gap-1">
            <Search className="h-3 w-3" />
            Search
          </Label>
          <Input
            id="search"
            placeholder="Search by title or genre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        
        <div className="space-y-1.5">
          <Label htmlFor="recorded" className="text-xs flex items-center gap-1">
            <Disc3 className="h-3 w-3" />
            Recording Status
          </Label>
          <Select value={recordedFilter} onValueChange={setRecordedFilter}>
            <SelectTrigger id="recorded" className="h-8 text-sm">
              <SelectValue placeholder="All Songs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Songs</SelectItem>
              <SelectItem value="unrecorded">Not Yet Recorded</SelectItem>
              <SelectItem value="recorded">Previously Recorded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {bandId && (
          <div className="space-y-1.5">
            <Label htmlFor="rehearsal" className="text-xs flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Rehearsal Level
            </Label>
            <Select value={rehearsalFilter} onValueChange={setRehearsalFilter}>
              <SelectTrigger id="rehearsal" className="h-8 text-sm">
                <SelectValue placeholder="Any Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Level</SelectItem>
                <SelectItem value="perfected">Perfected (6h+)</SelectItem>
                <SelectItem value="well_rehearsed">Well Rehearsed+ (5h+)</SelectItem>
                <SelectItem value="familiar">Familiar+ (3h+)</SelectItem>
                <SelectItem value="learning">Learning+ (1h+)</SelectItem>
                <SelectItem value="unlearned">Unlearned Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredSongs.length} of {songs.length} songs
      </div>
      
      <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-1">
        {filteredSongs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No songs match your filters</p>
            <Button 
              variant="link" 
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setRecordedFilter("all");
                setRehearsalFilter("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          filteredSongs.map((song) => {
            const familiarityMinutes = song.band_song_familiarity?.[0]?.familiarity_minutes || 0;
            const rehearsalInfo = getRehearsalLevel(familiarityMinutes);
            const hasBeenRecorded = song.recordingHistory.count > 0;
            
            return (
              <Card
                key={song.id}
                className={`transition-all hover:shadow-md cursor-pointer ${
                  selectedSong?.id === song.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => onSelect(song)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Music className="h-4 w-4 text-primary" />
                        {song.title}
                        {hasBeenRecorded && (
                          <Badge variant="outline" className="gap-1">
                            <Disc3 className="h-3 w-3" />
                            {song.recordingHistory.count}x recorded
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary">{song.genre}</Badge>
                        {song.status === 'recorded' && (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Recorded
                          </Badge>
                        )}
                        {song.catalog_status && (
                          <Badge variant="outline">{song.catalog_status}</Badge>
                        )}
                        {bandId && familiarityMinutes > 0 && (
                          <Badge variant={rehearsalInfo.variant}>
                            {rehearsalInfo.name} ({formatRehearsalTime(familiarityMinutes)})
                          </Badge>
                        )}
                        {bandId && familiarityMinutes === 0 && (
                          <Badge variant="destructive">Unlearned</Badge>
                        )}
                      </div>
                      {/* Show previous versions if re-recording */}
                      {hasBeenRecorded && song.recordingHistory.versions.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Versions: {[...new Set(song.recordingHistory.versions)].join(', ')}
                        </div>
                      )}
                      {bandId && familiarityMinutes > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Performance: {rehearsalInfo.performanceModifier > 0 ? '+' : ''}{(rehearsalInfo.performanceModifier * 100).toFixed(0)}%
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        Quality
                      </div>
                      <div className="text-lg font-bold text-primary">
                        {song.quality_score || 0}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <Button
                    variant={selectedSong?.id === song.id ? 'default' : 'outline'}
                    className="w-full"
                    size="sm"
                  >
                    {selectedSong?.id === song.id ? 'Selected' : hasBeenRecorded ? 'Re-record' : 'Select Song'}
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
