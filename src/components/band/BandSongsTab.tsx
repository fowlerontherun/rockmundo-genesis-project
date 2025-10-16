import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Music, Calendar, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BandSongsTabProps {
  bandId: string;
}

interface BandSong {
  id: string;
  title: string;
  genre: string;
  quality_score: number;
  catalog_status: string;
  created_at: string;
  user_id: string;
  familiarity_percentage: number | null;
  familiarity_minutes: number | null;
  last_rehearsed_at: string | null;
}

export function BandSongsTab({ bandId }: BandSongsTabProps) {
  const [songs, setSongs] = useState<BandSong[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBandSongs();
  }, [bandId]);

  const loadBandSongs = async () => {
    try {
      // Get all songs owned by band members
      const { data: members } = await supabase
        .from('band_members')
        .select('user_id')
        .eq('band_id', bandId);

      if (!members || members.length === 0) {
        setLoading(false);
        return;
      }

      const memberIds = members.map(m => m.user_id);

      // Get familiarity data (includes all songs in band repertoire, including gifted ones)
      const { data: familiarityData } = await supabase
        .from('band_song_familiarity')
        .select('song_id, familiarity_percentage, familiarity_minutes, last_rehearsed_at')
        .eq('band_id', bandId);

      // Get all song IDs from familiarity data
      const familiaritySongIds = familiarityData?.map(f => f.song_id) || [];

      // Get songs: both owned by members AND in familiarity (which includes gifted songs)
      const { data: songsData } = await supabase
        .from('songs')
        .select('*')
        .or(`user_id.in.(${memberIds.join(',')}),id.in.(${familiaritySongIds.join(',')})`)
        .order('created_at', { ascending: false });

      if (!songsData) {
        setLoading(false);
        return;
      }

      // Merge song data with familiarity
      const songsWithFamiliarity = songsData.map(song => {
        const familiarity = familiarityData?.find(f => f.song_id === song.id);
        return {
          ...song,
          familiarity_percentage: familiarity?.familiarity_percentage || null,
          familiarity_minutes: familiarity?.familiarity_minutes || null,
          last_rehearsed_at: familiarity?.last_rehearsed_at || null,
        };
      });

      setSongs(songsWithFamiliarity);
    } catch (error) {
      console.error('Error loading band songs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 80) return 'bg-green-500';
    if (quality >= 60) return 'bg-blue-500';
    if (quality >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getFamiliarityLabel = (percentage: number | null) => {
    if (percentage === null || percentage === 0) return 'Not Rehearsed';
    if (percentage >= 80) return 'Well Rehearsed';
    if (percentage >= 50) return 'Familiar';
    if (percentage >= 20) return 'Learning';
    return 'Just Started';
  };

  const getFamiliarityColor = (percentage: number | null) => {
    if (percentage === null || percentage === 0) return 'bg-muted text-muted-foreground';
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 50) return 'bg-blue-500';
    if (percentage >= 20) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  if (loading) {
    return <div className="text-center py-8">Loading songs...</div>;
  }

  if (songs.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No songs found for this band</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Band Song Repertoire ({songs.length} songs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {songs.map((song) => (
              <Card key={song.id} className="border-2">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{song.title}</h3>
                        <div className="flex gap-2 mt-1 flex-wrap">
                          <Badge variant="outline">{song.genre}</Badge>
                          {song.catalog_status === 'published' && (
                            <Badge variant="secondary">In Catalog</Badge>
                          )}
                          <Badge className={getQualityColor(song.quality_score)}>
                            Quality: {song.quality_score}%
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={getFamiliarityColor(song.familiarity_percentage)}>
                          {getFamiliarityLabel(song.familiarity_percentage)}
                        </Badge>
                      </div>
                    </div>

                    {/* Familiarity Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Rehearsal Familiarity</span>
                        <span className="font-medium">
                          {song.familiarity_percentage || 0}%
                        </span>
                      </div>
                      <Progress value={song.familiarity_percentage || 0} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {song.familiarity_minutes || 0} minutes rehearsed
                        </span>
                        {song.last_rehearsed_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Last rehearsed {formatDistanceToNow(new Date(song.last_rehearsed_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Song Stats */}
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t text-sm">
                      <div>
                        <span className="text-muted-foreground">Created: </span>
                        <span>{new Date(song.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground">Status: </span>
                        <span className="font-medium">
                          {song.catalog_status === 'published' ? 'Published' : 'Unpublished'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
