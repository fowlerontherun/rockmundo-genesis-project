import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Music, Calendar, Search, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { SongDetailDialog } from '@/components/songs/SongDetailDialog';

interface BandSongsTabProps {
  bandId: string;
}

interface BandSong {
  id: string;
  title: string;
  genre: string;
  quality_score: number;
  catalog_status: string;
  status?: string;
  created_at: string;
  user_id: string;
  familiarity_percentage: number | null;
  familiarity_minutes: number | null;
  last_rehearsed_at: string | null;
}

export function BandSongsTab({ bandId }: BandSongsTabProps) {
  const [songs, setSongs] = useState<BandSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);

  useEffect(() => {
    loadBandSongs();
  }, [bandId]);

  const loadBandSongs = async () => {
    try {
      // Primary query: Get songs directly associated with the band
      const { data: bandSongs } = await supabase
        .from('songs')
        .select('*')
        .eq('band_id', bandId)
        .order('created_at', { ascending: false });

      // Secondary: Get songs from band members (for solo songs they may have brought)
      const { data: members } = await supabase
        .from('band_members')
        .select('user_id')
        .eq('band_id', bandId);

      const memberIds = (members || []).map(m => m.user_id).filter((id): id is string => id !== null);

      // Get familiarity data for rehearsed songs
      const { data: familiarityData } = await supabase
        .from('band_song_familiarity')
        .select('song_id, familiarity_percentage, familiarity_minutes, last_rehearsed_at')
        .eq('band_id', bandId);

      const familiaritySongIds = familiarityData?.map(f => f.song_id) || [];

      // Get songs from setlists
      const { data: setlistIds } = await supabase
        .from('setlists')
        .select('id')
        .eq('band_id', bandId);

      let setlistSongIds: string[] = [];
      if (setlistIds && setlistIds.length > 0) {
        const { data: setlistSongs } = await supabase
          .from('setlist_songs')
          .select('song_id')
          .in('setlist_id', setlistIds.map(s => s.id));
        setlistSongIds = setlistSongs?.map(s => s.song_id) || [];
      }

      // Get member songs (songs written by members but not assigned to band)
      let memberSongs: any[] = [];
      if (memberIds.length > 0) {
        const { data: memberSongsData } = await supabase
          .from('songs')
          .select('*')
          .in('user_id', memberIds)
          .is('band_id', null)
          .order('created_at', { ascending: false });
        memberSongs = memberSongsData || [];
      }

      // Combine all songs (band songs + member songs + familiarity/setlist songs)
      const allBandSongIds = new Set((bandSongs || []).map(s => s.id));
      const allMemberSongIds = new Set(memberSongs.map(s => s.id));
      const additionalSongIds = [...familiaritySongIds, ...setlistSongIds].filter(
        id => !allBandSongIds.has(id) && !allMemberSongIds.has(id)
      );

      // Fetch any additional songs from familiarity/setlists not already loaded
      let additionalSongs: any[] = [];
      if (additionalSongIds.length > 0) {
        const { data: additionalData } = await supabase
          .from('songs')
          .select('*')
          .in('id', additionalSongIds);
        additionalSongs = additionalData || [];
      }

      // Combine and deduplicate
      const allSongsMap = new Map<string, any>();
      [...(bandSongs || []), ...memberSongs, ...additionalSongs].forEach(song => {
        if (!allSongsMap.has(song.id)) {
          allSongsMap.set(song.id, song);
        }
      });

      const songsData = Array.from(allSongsMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      if (!songsData) {
        setLoading(false);
        return;
      }

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

  // Get unique genres for filter
  const genres = useMemo(() => {
    const uniqueGenres = [...new Set(songs.map(s => s.genre).filter(Boolean))];
    return uniqueGenres.sort();
  }, [songs]);

  // Filtered songs
  const filteredSongs = useMemo(() => {
    return songs.filter(song => {
      const matchesSearch = !searchQuery || 
        song.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGenre = genreFilter === 'all' || song.genre === genreFilter;
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'recorded' && song.status === 'recorded') ||
        (statusFilter === 'published' && song.catalog_status === 'published') ||
        (statusFilter === 'rehearsed' && (song.familiarity_percentage || 0) >= 50);
      return matchesSearch && matchesGenre && matchesStatus;
    });
  }, [songs, searchQuery, genreFilter, statusFilter]);

  const getQualityColor = (quality: number) => {
    if (quality >= 80) return 'bg-green-500/80';
    if (quality >= 60) return 'bg-blue-500/80';
    if (quality >= 40) return 'bg-yellow-500/80';
    return 'bg-red-500/80';
  };

  const getFamiliarityColor = (percentage: number | null) => {
    if (percentage === null || percentage === 0) return 'bg-muted text-muted-foreground';
    if (percentage >= 80) return 'bg-green-500/80';
    if (percentage >= 50) return 'bg-blue-500/80';
    return 'bg-yellow-500/80';
  };

  if (loading) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Loading songs...</div>;
  }

  if (songs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Music className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No songs found for this band</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Music className="h-4 w-4" />
            Songs ({filteredSongs.length}/{songs.length})
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 w-32 sm:w-40 text-xs"
              />
            </div>
            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {genres.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="recorded">Recorded</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="rehearsed">Rehearsed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border">
          {filteredSongs.map((song) => (
            <div 
              key={song.id} 
              className="py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-accent/50 rounded-md transition-colors -mx-2 px-2"
              onClick={() => setSelectedSongId(song.id)}
            >
              <div className="flex items-center gap-3">
                {/* Song Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{song.title}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                      {song.genre}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    {song.status === 'recorded' && (
                      <span className="text-green-600">● Recorded</span>
                    )}
                    {song.last_rehearsed_at && (
                      <span className="flex items-center gap-0.5">
                        <Calendar className="h-2.5 w-2.5" />
                        {formatDistanceToNow(new Date(song.last_rehearsed_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quality & Familiarity Badges */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge className={`${getQualityColor(song.quality_score)} text-[10px] px-1.5 py-0 h-5`}>
                    Q:{song.quality_score}
                  </Badge>
                  <Badge className={`${getFamiliarityColor(song.familiarity_percentage)} text-[10px] px-1.5 py-0 h-5`}>
                    R:{song.familiarity_percentage || 0}%
                  </Badge>
                </div>

                {/* Familiarity Progress - compact */}
                <div className="w-16 shrink-0 hidden sm:block">
                  <Progress value={song.familiarity_percentage || 0} className="h-1.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredSongs.length === 0 && songs.length > 0 && (
          <p className="text-center text-sm text-muted-foreground py-4">No songs match your filters</p>
        )}
      </CardContent>

      {/* Song Detail Dialog */}
      <SongDetailDialog 
        songId={selectedSongId} 
        onClose={() => setSelectedSongId(null)} 
      />
    </Card>
  );
}