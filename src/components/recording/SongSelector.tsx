import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music, TrendingUp, Disc3, CheckCircle2 } from "lucide-react";
import { getRehearsalLevel, formatRehearsalTime } from "@/utils/rehearsalLevels";

interface SongSelectorProps {
  userId: string;
  bandId?: string;
  selectedSong: any;
  onSelect: (song: any) => void;
}

export const SongSelector = ({ userId, bandId, selectedSong, onSelect }: SongSelectorProps) => {
  const { data: songs, isLoading } = useQuery({
    queryKey: ['recordable-songs', userId, bandId],
    queryFn: async () => {
      // Get songs with their recording history
      const { data, error } = await supabase
        .from('songs')
        .select(`
          *,
          band_song_familiarity!song_id (
            familiarity_minutes,
            familiarity_percentage,
            rehearsal_stage,
            band_id
          )
        `)
        .eq('user_id', userId)
        .in('status', ['draft', 'recorded'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Get recording history for these songs
      const songIds = data?.map(s => s.id) || [];
      let recordingHistory: Record<string, { count: number; versions: string[] }> = {};

      if (songIds.length > 0) {
        const { data: recordings } = await supabase
          .from('recording_sessions')
          .select('song_id, recording_version, status')
          .in('song_id', songIds)
          .eq('status', 'completed');

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

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading songs...</div>;
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
      <div className="text-sm text-muted-foreground">
        Choose a song to record ({songs.length} available)
      </div>
      
      <div className="grid gap-3">
        {songs.map((song) => {
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
        })}
      </div>
    </div>
  );
};
