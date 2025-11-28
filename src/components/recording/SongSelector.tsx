import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Music, TrendingUp } from "lucide-react";
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
      
      // Filter familiarity data to only include the current band
      return data?.map(song => ({
        ...song,
        band_song_familiarity: bandId 
          ? song.band_song_familiarity?.filter((f: any) => f.band_id === bandId)
          : song.band_song_familiarity
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
                    </CardTitle>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant="secondary">{song.genre}</Badge>
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
                  {selectedSong?.id === song.id ? 'Selected' : 'Select Song'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
