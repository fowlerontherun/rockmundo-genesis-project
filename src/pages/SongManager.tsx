import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Music, Plus, TrendingUp, Star, Calendar, Play, Edit3, Trash2 } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface Song {
  id: string;
  title: string;
  genre: string;
  lyrics?: string;
  quality_score: number;
  release_date?: string;
  chart_position?: number;
  streams: number;
  revenue: number;
  status: 'draft' | 'recorded' | 'released';
  created_at: string;
  user_id: string;
  updated_at?: string;
}

interface StreamingAccountRecord {
  id: string;
  followers: number | null;
  platform?: {
    id?: string;
    name?: string;
    revenue_per_play?: number | null;
  } | null;
}

interface BreakdownSource {
  key: string;
  name: string;
  weight: number;
  revenuePerPlay: number;
  platformId?: string;
}

interface StreamingStatsBreakdownEntry {
  key: string;
  platformId?: string;
  name: string;
  streams: number;
  revenue: number;
  revenuePerPlay: number;
}

const DEFAULT_REVENUE_PER_PLAY = 0.003;

const DEFAULT_STREAMING_PLATFORM_DISTRIBUTION: BreakdownSource[] = [
  { key: "spotify", name: "Spotify", weight: 45, revenuePerPlay: 0.003 },
  { key: "apple_music", name: "Apple Music", weight: 25, revenuePerPlay: 0.007 },
  { key: "youtube_music", name: "YouTube Music", weight: 20, revenuePerPlay: 0.002 },
  { key: "tidal", name: "Tidal", weight: 10, revenuePerPlay: 0.01 }
];

const slugifyPlatformKey = (value: string, fallback: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || fallback;
};

const buildInitialStreamingBreakdown = (
  initialStreams: number,
  accounts: StreamingAccountRecord[] | null | undefined
): StreamingStatsBreakdownEntry[] => {
  const sources: BreakdownSource[] = (accounts && accounts.length > 0)
    ? accounts.map((account) => {
        const platformName = account.platform?.name?.trim() || "Streaming Platform";
        return {
          key: account.platform?.id || slugifyPlatformKey(platformName, account.id),
          name: platformName,
          weight: Math.max(account.followers ?? 0, 1),
          revenuePerPlay: account.platform?.revenue_per_play ?? DEFAULT_REVENUE_PER_PLAY,
          platformId: account.platform?.id ?? undefined
        };
      })
    : DEFAULT_STREAMING_PLATFORM_DISTRIBUTION.map((entry) => ({ ...entry }));

  if (sources.length === 0) {
    return [];
  }

  const totalWeight = sources.reduce((sum, entry) => sum + (entry.weight || 0), 0) || sources.length;
  let allocatedStreams = 0;

  return sources.map((entry, index) => {
    const ratio = totalWeight > 0 ? entry.weight / totalWeight : 1 / sources.length;
    const isLast = index === sources.length - 1;
    const streams = isLast
      ? Math.max(initialStreams - allocatedStreams, 0)
      : Math.max(Math.floor(initialStreams * ratio), 0);
    allocatedStreams += streams;
    const revenue = streams * entry.revenuePerPlay;

    return {
      key: entry.key || `platform_${index}`,
      platformId: entry.platformId,
      name: entry.name,
      streams,
      revenue,
      revenuePerPlay: entry.revenuePerPlay
    };
  });
};

const SongManager = () => {
  const { user } = useAuth();
  const { profile, skills, updateProfile } = useGameData();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSong, setNewSong] = useState({
    title: '',
    genre: '',
    lyrics: ''
  });
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [growthHistory, setGrowthHistory] = useState<SongGrowthRecord[]>([]);

  const POLL_INTERVAL = 30000;

  const genres = [
    'Rock', 'Pop', 'Hip Hop', 'Jazz', 'Blues', 'Country',
    'Electronic', 'Folk', 'Reggae', 'Metal', 'Punk', 'Alternative'
  ];

  const fetchSongs = useCallback(async () => {
    if (!user?.id) {
      setSongs([]);
      setLoading(false);
      return;
    }

  const createStreamingStatsRecord = async (
    songId: string,
    totalStreams: number
  ): Promise<StreamingStatsBreakdownEntry[]> => {
    if (!user) {
      return [];
    }

    try {
      const { data: accountData, error: accountsError } = await supabase
        .from('player_streaming_accounts')
        .select(`
          id,
          followers,
          platform:streaming_platforms!player_streaming_accounts_platform_id_fkey (
            id,
            name,
            revenue_per_play
          )
        `)
        .eq('user_id', user.id)
        .eq('is_connected', true);

      if (accountsError) {
        throw accountsError;
      }

      const breakdown = buildInitialStreamingBreakdown(
        totalStreams,
        (accountData as StreamingAccountRecord[] | null | undefined)
      );

      const totalRevenue = breakdown.reduce((sum, entry) => sum + entry.revenue, 0);
      const breakdownPayload = breakdown.map((entry) => ({
        platform_id: entry.platformId ?? null,
        key: entry.key,
        name: entry.name,
        streams: entry.streams,
        revenue: Number(entry.revenue.toFixed(2)),
        revenue_per_play: entry.revenuePerPlay
      }));

      const { error: statsError } = await supabase
        .from('streaming_stats')
        .upsert({
          song_id: songId,
          user_id: user.id,
          total_streams: totalStreams,
          total_revenue: Number(totalRevenue.toFixed(2)),
          platform_breakdown: breakdownPayload as Json
        }, {
          onConflict: 'song_id'
        });

      if (statsError) {
        throw statsError;
      }

      return breakdown;
    } catch (statsError) {
      console.error('Error creating streaming stats:', statsError);
      return [];
    }
  };

  const enqueueStreamingSimulation = async (
    songId: string,
    totalStreams: number,
    breakdown: StreamingStatsBreakdownEntry[]
  ) => {
    if (breakdown.length === 0 || totalStreams <= 0) {
      return;
    }

    try {
      await supabase.functions.invoke('queue-streaming-simulation', {
        body: {
          songId,
          totalStreams,
          breakdown: breakdown.map((entry) => ({
            key: entry.key,
            name: entry.name,
            streams: entry.streams,
            revenue: Number(entry.revenue.toFixed(2))
          }))
        }
      });
    } catch (jobError) {
      // The edge function may not be configured in all environments.
      console.info('Streaming simulation job not queued:', jobError);
    }
  };

  const fetchSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSongs((data || []).map(normalizeSongRecord));
    } catch (error: any) {
      console.error('Error fetching songs:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load songs"
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  const fetchGrowthHistory = useCallback(async () => {
    if (!user?.id) {
      setGrowthHistory([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('song_stream_growth_history')
        .select('id, song_id, user_id, streams_added, revenue_added, recorded_at, songs(title)')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setGrowthHistory((data || []).map(normalizeGrowthRecord));
    } catch (error) {
      console.error('Error fetching song growth:', error);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setSongs([]);
      setGrowthHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchSongs();
    fetchGrowthHistory();
  }, [user?.id, fetchSongs, fetchGrowthHistory]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const interval = setInterval(() => {
      fetchSongs();
      fetchGrowthHistory();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [user?.id, fetchSongs, fetchGrowthHistory]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`songs-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songs',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT' && payload.new) {
            const normalized = normalizeSongRecord(payload.new);
            setSongs((prev) => {
              const exists = prev.some((song) => song.id === normalized.id);

              if (exists) {
                return prev.map((song) =>
                  song.id === normalized.id ? { ...song, ...normalized } : song
                );
              }

              return [normalized, ...prev].sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime()
              );
            });
          }

          if (payload.eventType === 'UPDATE' && payload.new) {
            const normalized = normalizeSongRecord(payload.new);
            setSongs((prev) =>
              prev.map((song) =>
                song.id === normalized.id ? { ...song, ...normalized } : song
              )
            );
          }

          if (payload.eventType === 'DELETE' && payload.old) {
            const deletedId = (payload.old as { id?: string })?.id;
            if (deletedId) {
              setSongs((prev) => prev.filter((song) => song.id !== deletedId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`song-growth-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'song_stream_growth_history',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (!payload.new) {
            return;
          }

          const normalized = normalizeGrowthRecord(payload.new);
          setGrowthHistory((prev) => {
            if (prev.some((entry) => entry.id === normalized.id)) {
              return prev;
            }

            const updated = [normalized, ...prev];
            return updated.slice(0, 200);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const dailyGrowth = useMemo(
    () => summarizeGrowth(growthHistory, songs, 1),
    [growthHistory, songs]
  );

  const weeklyGrowth = useMemo(
    () => summarizeGrowth(growthHistory, songs, 7),
    [growthHistory, songs]
  );

  const createSong = async () => {
    if (!user || !newSong.title || !newSong.genre) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide a title and genre for your song."
      });
      return;
    }

    try {
      const qualityScore = Math.floor(
        ((skills?.songwriting || 0) + (skills?.performance || 0)) / 2 + 
        Math.random() * 20 - 10
      );

      const { data, error } = await supabase
        .from('songs')
        .insert([{
          title: newSong.title,
          genre: newSong.genre,
          lyrics: newSong.lyrics,
          quality_score: Math.max(1, Math.min(100, qualityScore)),
          status: 'draft',
          streams: 0,
          revenue: 0,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;

      setSongs(prev => [normalizeSongRecord(data), ...prev]);
      setNewSong({ title: '', genre: '', lyrics: '' });
      setIsCreateDialogOpen(false);
      
      toast({
        title: "Song Created",
        description: `"${data.title}" has been added to your collection!`
      });
    } catch (error: any) {
      console.error('Error creating song:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create song"
      });
    }
  };

  const recordSong = async (song: Song) => {
    if (!profile || profile.cash < 500) {
      toast({
        variant: "destructive",
        title: "Insufficient Funds",
        description: "Recording costs $500. You need more cash!"
      });
      return;
    }

    try {
      const recordingBonus = (skills?.performance || 0) / 4;
      const finalQuality = Math.min(100, song.quality_score + recordingBonus);

      const { error } = await supabase
        .from('songs')
        .update({
          status: 'recorded',
          quality_score: finalQuality
        })
        .eq('id', song.id);

      if (error) throw error;

      await updateProfile({ cash: profile.cash - 500 });

      setSongs(prev => prev.map(s => 
        s.id === song.id 
          ? { ...s, status: 'recorded' as const, quality_score: finalQuality }
          : s
      ));

      setIsRecordDialogOpen(false);
      
      toast({
        title: "Song Recorded",
        description: `"${song.title}" has been professionally recorded!`
      });
    } catch (error: any) {
      console.error('Error recording song:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record song"
      });
    }
  };

  const releaseSong = async (song: Song) => {
    if (song.status !== 'recorded') {
      toast({
        variant: "destructive",
        title: "Cannot Release",
        description: "Song must be recorded before release!"
      });
      return;
    }

    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication required",
        description: "You must be logged in to release a song."
      });
      return;
    }

    try {
      const initialStreams = Math.floor(song.quality_score * (profile?.fans || 0) / 100);
      const chartPosition = Math.max(1, 101 - Math.floor(song.quality_score * 0.8));
      const initialRevenue = Number((initialStreams * 0.01).toFixed(2));

      const { error } = await supabase
        .from('songs')
        .update({
          status: 'released',
          release_date: new Date().toISOString(),
          streams: initialStreams,
          chart_position: chartPosition,
          revenue: initialRevenue
        })
        .eq('id', song.id);

      if (error) throw error;

      const breakdown = await createStreamingStatsRecord(song.id, initialStreams);
      const fameGain = Math.floor(song.quality_score / 2);
      await updateProfile({
        fame: (profile?.fame || 0) + fameGain,
        cash: (profile?.cash || 0) + initialRevenue
      });

      setSongs(prev => prev.map(s => 
        s.id === song.id 
          ? { 
              ...s, 
              status: 'released' as const,
              release_date: new Date().toISOString(),
              streams: initialStreams,
              chart_position: chartPosition,
              revenue: initialRevenue
            }
          : s
      ));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('streaming:refresh', {
          detail: {
            songId: song.id,
            streams: initialStreams
          }
        }));
      }

      if (breakdown.length > 0) {
        void enqueueStreamingSimulation(song.id, initialStreams, breakdown);
      }

      toast({
        title: "Song Released",
        description: `"${song.title}" is now available to fans! +${fameGain} fame!`
      });
    } catch (error: any) {
      console.error('Error releasing song:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to release song"
      });
    }
  };

  const deleteSong = async (songId: string) => {
    try {
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', songId);

      if (error) throw error;

      setSongs(prev => prev.filter(s => s.id !== songId));
      setGrowthHistory(prev => prev.filter(record => record.song_id !== songId));

      toast({
        title: "Song Deleted",
        description: "Song has been removed from your collection"
      });
    } catch (error: any) {
      console.error('Error deleting song:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete song"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'recorded': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'released': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const renderGrowthPanel = (summary: GrowthSummary, windowLabel: string) => {
    if (summary.totals.streams <= 0) {
      return (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No streaming activity recorded in the {windowLabel}.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Stream growth captured over the {windowLabel}.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Total Streams</p>
            <p className="text-2xl font-bold">{summary.totals.streams.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Streaming Revenue</p>
            <p className="text-2xl font-bold">${summary.totals.revenue.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">Active Songs</p>
            <p className="text-2xl font-bold">{summary.bySong.length}</p>
          </div>
        </div>
        <div className="space-y-2">
          {summary.bySong.slice(0, 5).map((entry, index) => (
            <div
              key={entry.songId}
              className="flex items-center justify-between rounded-lg border bg-background/60 px-4 py-2"
            >
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                  #{index + 1}
                </Badge>
                <div>
                  <p className="font-semibold">{entry.title}</p>
                  <p className="text-xs text-muted-foreground">
                    +{entry.streams.toLocaleString()} streams · +${entry.revenue.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const totalSongs = songs.length;
  const releasedSongs = songs.filter(s => s.status === 'released').length;
  const totalStreams = songs.reduce((sum, s) => sum + s.streams, 0);
  const totalRevenue = songs.reduce((sum, s) => sum + s.revenue, 0);
  const bestChart = Math.min(...songs.filter(s => s.chart_position).map(s => s.chart_position!)) || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <Music className="h-12 w-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-lg text-foreground">Loading your songs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Song Manager
          </h1>
          <p className="text-lg text-muted-foreground">
            Create, record, and release your musical masterpieces
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <Music className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{totalSongs}</div>
              <div className="text-sm text-muted-foreground">Total Songs</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Star className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <div className="text-2xl font-bold">{releasedSongs}</div>
              <div className="text-sm text-muted-foreground">Released</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Play className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">{totalStreams.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Streams</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">#{bestChart || 'N/A'}</div>
              <div className="text-sm text-muted-foreground">Best Chart</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
              <div className="text-sm text-muted-foreground">Revenue</div>
            </CardContent>
          </Card>
        </div>

        {/* Streaming Growth */}
        <Card>
          <CardHeader>
            <CardTitle>Streaming Growth</CardTitle>
            <CardDescription>
              Automatic audience growth based on song quality and marketing skills
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="daily" className="w-full">
              <TabsList className="grid w-full gap-2 sm:w-auto sm:grid-cols-2">
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
              </TabsList>
              <TabsContent value="daily" className="mt-4">
                {renderGrowthPanel(dailyGrowth, 'last 24 hours')}
              </TabsContent>
              <TabsContent value="weekly" className="mt-4">
                {renderGrowthPanel(weeklyGrowth, 'last 7 days')}
              </TabsContent>
            </Tabs>
            <p className="mt-4 text-xs text-muted-foreground">
              Streaming metrics refresh automatically every 15 minutes.
            </p>
          </CardContent>
        </Card>

        {/* Create Song Button */}
        <div className="flex justify-end">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create New Song
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Song</DialogTitle>
                <DialogDescription>
                  Start working on your next musical masterpiece
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Song Title</Label>
                  <Input
                    id="title"
                    value={newSong.title}
                    onChange={(e) => setNewSong(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter song title"
                  />
                </div>
                <div>
                  <Label htmlFor="genre">Genre</Label>
                  <Select value={newSong.genre} onValueChange={(value) => setNewSong(prev => ({ ...prev, genre: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map((genre) => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="lyrics">Lyrics (Optional)</Label>
                  <Textarea
                    id="lyrics"
                    value={newSong.lyrics}
                    onChange={(e) => setNewSong(prev => ({ ...prev, lyrics: e.target.value }))}
                    placeholder="Write your lyrics here..."
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createSong}>Create Song</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Songs List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {songs.map((song) => (
            <Card key={song.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{song.title}</CardTitle>
                    <CardDescription>{song.genre}</CardDescription>
                  </div>
                  <Badge className={getStatusColor(song.status)}>
                    {song.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Quality</span>
                    <span>{song.quality_score}/100</span>
                  </div>
                  <Progress value={song.quality_score} className="h-2" />
                </div>

                {song.status === 'released' && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Streams:</span>
                      <span>{song.streams.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Chart Position:</span>
                      <span>#{song.chart_position}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Revenue:</span>
                      <span>${song.revenue.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {song.status === 'draft' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedSong(song);
                        setIsRecordDialogOpen(true);
                      }}
                    >
                      Record ($500)
                    </Button>
                  )}
                  
                  {song.status === 'recorded' && (
                    <Button 
                      size="sm"
                      onClick={() => releaseSong(song)}
                    >
                      Release
                    </Button>
                  )}
                  
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => deleteSong(song.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {songs.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Music className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No Songs Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start your musical journey by creating your first song!
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Song
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Record Song Dialog */}
        <Dialog open={isRecordDialogOpen} onOpenChange={setIsRecordDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Song</DialogTitle>
              <DialogDescription>
                Record "{selectedSong?.title}" in a professional studio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Recording Details</h4>
                <ul className="text-sm space-y-1">
                  <li>• Cost: $500</li>
                  <li>• Quality boost based on Performance skill</li>
                  <li>• Professional production</li>
                  <li>• Required before release</li>
                </ul>
              </div>
              <div className="text-sm text-muted-foreground">
                Current Cash: ${profile?.cash?.toLocaleString() || 0}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRecordDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => selectedSong && recordSong(selectedSong)}
                disabled={!profile || profile.cash < 500}
              >
                Record Song ($500)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SongManager;