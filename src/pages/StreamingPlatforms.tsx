import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, 
  Users, 
  TrendingUp, 
  DollarSign, 
  Star, 
  Music, 
  Radio,
  Globe,
  Heart,
  Share2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";
import type { Database } from "@/integrations/supabase/types";

type StreamingPlatform = Database["public"]["Tables"]["streaming_platforms"]["Row"];
type PlayerStreamingAccount = Database["public"]["Tables"]["player_streaming_accounts"]["Row"];
type SongRecord = Database["public"]["Tables"]["songs"]["Row"] & {
  album?: string | null;
  plays?: number | null;
  popularity?: number | null;
  totalStreams?: number | null;
  trending?: boolean | null;
};

interface PlatformMetric extends StreamingPlatform {
  monthlyListeners: number;
  monthlyStreams: number;
  monthlyRevenue: number;
  growth: number;
  isConnected: boolean;
}

interface OverviewMetrics {
  totalStreams: number;
  totalRevenue: number;
  totalListeners: number;
  streamsGrowth: number;
  revenueGrowth: number;
  listenersGrowth: number;
}

interface PlatformSnapshot {
  monthlyListeners: number;
  monthlyStreams: number;
  monthlyRevenue: number;
}

interface OverviewSnapshot {
  totalStreams: number;
  totalRevenue: number;
  totalListeners: number;
}

const calculateGrowth = (
  previous: number | null | undefined,
  current: number | null | undefined
) => {
  if (previous === undefined || previous === null) {
    return 0;
  }

  const previousValue = Number(previous);
  const currentValue = Number(current ?? 0);

  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return ((currentValue - previousValue) / previousValue) * 100;
};

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const standardNumberFormatter = new Intl.NumberFormat('en-US');

const formatCompactNumber = (value: number) => {
  if (!Number.isFinite(value) || value === 0) {
    return '0';
  }

  if (Math.abs(value) < 1000) {
    return standardNumberFormatter.format(Math.round(value));
  }

  return compactNumberFormatter.format(value);
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) {
    return '$0';
  }

  return currencyFormatter.format(value);
};

const StreamingPlatforms = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useGameData();
  
  const [platforms, setPlatforms] = useState<StreamingPlatform[]>([]);
  const [playerAccounts, setPlayerAccounts] = useState<PlayerStreamingAccount[]>([]);
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetric[]>([]);
  const [overviewMetrics, setOverviewMetrics] = useState<OverviewMetrics>({
    totalStreams: 0,
    totalRevenue: 0,
    totalListeners: 0,
    streamsGrowth: 0,
    revenueGrowth: 0,
    listenersGrowth: 0,
  });
  const [userSongs, setUserSongs] = useState<SongRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const platformSnapshotsRef = useRef<Record<string, PlatformSnapshot>>({});
  const overviewSnapshotRef = useRef<OverviewSnapshot | null>(null);

  const loadData = useCallback(async (showLoading = false) => {
    if (!user) return;

    if (showLoading) {
      setLoading(true);
    }

    try {
      const { data: platformsData, error: platformsError } = await supabase
        .from('streaming_platforms')
        .select('*')
        .order('name');

      if (platformsError) throw platformsError;
      setPlatforms(platformsData ?? []);

      const { data: accountsData, error: accountsError } = await supabase
        .from('player_streaming_accounts')
        .select('*')
        .eq('user_id', user.id);

      if (accountsError) throw accountsError;
      setPlayerAccounts(accountsData ?? []);

      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('artist_id', user.id)
        .eq('status', 'released')
        .order('created_at', { ascending: false });

      if (songsError) throw songsError;
      const normalizedSongs: SongRecord[] = (songsData ?? []).map((song) => ({
        ...song,
      }));
      setUserSongs(normalizedSongs);

    } catch (error: unknown) {
      console.error('Error loading streaming data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load streaming data",
      });
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [toast, user]);

  useEffect(() => {
    if (user) {
      loadData(true);
    } else {
      setLoading(false);
    }
  }, [user, loadData]);

  useEffect(() => {
    platformSnapshotsRef.current = {};
    overviewSnapshotRef.current = null;
    setPlatformMetrics([]);
    setOverviewMetrics({
      totalStreams: 0,
      totalRevenue: 0,
      totalListeners: 0,
      streamsGrowth: 0,
      revenueGrowth: 0,
      listenersGrowth: 0,
    });
  }, [user?.id]);

  useEffect(() => {
    if (!platforms.length) {
      setPlatformMetrics([]);
      setOverviewMetrics({
        totalStreams: 0,
        totalRevenue: 0,
        totalListeners: 0,
        streamsGrowth: 0,
        revenueGrowth: 0,
        listenersGrowth: 0,
      });
      return;
    }

    const metrics = platforms.map((platform) => {
      const account = playerAccounts.find((acc) => acc.platform_id === platform.id);
      const monthlyListeners = account?.followers ?? 0;
      const monthlyStreams = account?.monthly_plays ?? 0;
      const monthlyRevenue = account?.monthly_revenue !== null && account?.monthly_revenue !== undefined
        ? Number(account.monthly_revenue)
        : 0;

      const previousSnapshot = platformSnapshotsRef.current[platform.id];
      const growth = calculateGrowth(previousSnapshot?.monthlyStreams, monthlyStreams);

      platformSnapshotsRef.current[platform.id] = {
        monthlyListeners,
        monthlyStreams,
        monthlyRevenue,
      };

      return {
        ...platform,
        monthlyListeners,
        monthlyStreams,
        monthlyRevenue,
        growth,
        isConnected: Boolean(account?.is_connected),
      };
    });

    setPlatformMetrics(metrics);

    const totalStreams = metrics.reduce((sum, metric) => sum + metric.monthlyStreams, 0);
    const totalRevenue = metrics.reduce((sum, metric) => sum + metric.monthlyRevenue, 0);
    const totalListeners = metrics.reduce((sum, metric) => sum + metric.monthlyListeners, 0);

    const previousTotals = overviewSnapshotRef.current;

    const streamsGrowth = calculateGrowth(previousTotals?.totalStreams, totalStreams);
    const revenueGrowth = calculateGrowth(previousTotals?.totalRevenue, totalRevenue);
    const listenersGrowth = calculateGrowth(previousTotals?.totalListeners, totalListeners);

    overviewSnapshotRef.current = {
      totalStreams,
      totalRevenue,
      totalListeners,
    };

    setOverviewMetrics({
      totalStreams,
      totalRevenue,
      totalListeners,
      streamsGrowth,
      revenueGrowth,
      listenersGrowth,
    });
  }, [platforms, playerAccounts]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`streaming-metrics-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_streaming_accounts',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'songs',
        },
        (payload) => {
          const record = (payload.new ?? payload.old) as { user_id?: string; artist_id?: string } | null;
          if (record && (record.user_id === user.id || record.artist_id === user.id)) {
            loadData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadData]);

  const connectPlatform = async (platformId: string) => {
    if (!user || !profile) return;

    try {
      const platform = platforms.find(p => p.id === platformId);
      if (!platform) return;

      // Check if user meets requirements
      const requiredFame = platform.min_followers ?? 0;
      if ((profile.fame || 0) < requiredFame) {
        toast({
          variant: "destructive",
          title: "Requirements not met",
          description: `You need ${requiredFame.toLocaleString()} fame to connect to ${platform.name}`,
        });
        return;
      }

      // Create or update streaming account
      const { data, error } = await supabase
        .from('player_streaming_accounts')
        .upsert({
          user_id: user.id,
          platform_id: platformId,
          is_connected: true,
          followers: Math.round((profile.fame || 0) * 0.1),
          monthly_plays: 0,
          monthly_revenue: 0,
          connected_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,platform_id'
        });

      if (error) throw error;

      await loadData();
      toast({
        title: "Platform Connected!",
        description: `Successfully connected to ${platform.name}`,
      });
    } catch (error: unknown) {
      console.error('Error connecting platform:', error);
      toast({
        variant: "destructive",
        title: "Connection failed",
        description: "Failed to connect to platform",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Loading streaming platforms...</p>
        </div>
      </div>
    );
  }

  const songs = [
    {
      id: 1,
      title: "Electric Dreams",
      album: "Voltage",
      totalStreams: 1250000,
      platforms: {
        spotify: 650000,
        apple: 280000,
        youtube: 220000,
        amazon: 100000
      },
      revenue: 3200,
      playlistPlacements: 23,
      trending: true
    },
    {
      id: 2,
      title: "Midnight Highway",
      album: "Voltage",
      totalStreams: 890000,
      platforms: {
        spotify: 420000,
        apple: 190000,
        youtube: 180000,
        amazon: 100000
      },
      revenue: 2400,
      playlistPlacements: 18,
      trending: false
    },
    {
      id: 3,
      title: "Neon Lights",
      album: "City Nights",
      totalStreams: 2100000,
      platforms: {
        spotify: 1200000,
        apple: 450000,
        youtube: 350000,
        amazon: 100000
      },
      revenue: 5800,
      playlistPlacements: 42,
      trending: true
    }
  ];

  const campaigns = [
    {
      id: 1,
      name: "Playlist Push - Electric Dreams",
      platform: "Spotify",
      budget: 2000,
      playlistsTargeted: 50,
      newPlacements: 12,
      streamIncrease: 45000,
      status: "Active",
      endDate: "Dec 15, 2024"
    },
    {
      id: 2,
      name: "YouTube Promotion",
      platform: "YouTube Music",
      budget: 1500,
      playlistsTargeted: 30,
      newPlacements: 8,
      streamIncrease: 25000,
      status: "Completed",
      endDate: "Nov 30, 2024"
    }
  ];

  const handlePromoteSong = (songId: number, platform: string) => {
    toast({
      title: "Promotion Started!",
      description: `Your song is now being promoted on ${platform}.`,
    });
  };

  const handleSubmitToPlaylist = (playlistName: string) => {
    toast({
      title: "Playlist Submission Sent!",
      description: `Your song has been submitted to "${playlistName}".`,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-primary p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bebas text-cream tracking-wider">
            STREAMING PLATFORMS
          </h1>
          <p className="text-xl text-cream/80 font-oswald">
            Manage your digital music presence and streaming revenue
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="songs">Songs</TabsTrigger>
            <TabsTrigger value="playlists">Playlists</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {platformMetrics.map((platform) => {
                const requiredFame = platform.min_followers ?? 0;
                const revenuePerPlay = Number(platform.revenue_per_play ?? 0);
                const growthClass = platform.growth >= 0 ? 'text-success' : 'text-destructive';
                const growthPrefix = platform.growth >= 0 ? '+' : '';

                return (
                  <Card key={platform.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{platform.icon || '🎵'}</span>
                          <CardTitle className="text-lg">{platform.name}</CardTitle>
                        </div>
                        {platform.isConnected ? (
                          <Badge className="bg-success text-success-foreground">Connected</Badge>
                        ) : (
                          <Badge variant="outline">Not Connected</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {platform.isConnected ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Monthly Listeners</span>
                            <span className="font-bold text-sm">{platform.monthlyListeners.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Monthly Streams</span>
                            <span className="text-accent font-bold text-sm">
                              {platform.monthlyStreams.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Monthly Revenue</span>
                            <span className="text-success font-bold text-sm">
                              {formatCurrency(platform.monthlyRevenue)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Growth</span>
                            <span className={`${growthClass} font-bold text-sm`}>
                              {growthPrefix}{platform.growth.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {platform.description || 'Connect to unlock insights for this platform.'}
                          </p>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Required Fame:</span>
                            <span className="font-bold text-sm">{requiredFame.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Revenue/Play:</span>
                            <span className="text-success font-bold text-sm">
                              ${revenuePerPlay.toFixed(4)}
                            </span>
                          </div>
                          <Button
                            onClick={() => connectPlatform(platform.id)}
                            disabled={(profile?.fame || 0) < requiredFame}
                            className="w-full bg-gradient-primary"
                          >
                            Connect
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Total Streams
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {formatCompactNumber(overviewMetrics.totalStreams)}
                  </div>
                  <p className="text-cream/60 text-sm">
                    {overviewMetrics.streamsGrowth >= 0 ? '+' : ''}
                    {overviewMetrics.streamsGrowth.toFixed(1)}% vs last update
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Streaming Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {formatCurrency(overviewMetrics.totalRevenue)}
                  </div>
                  <p className="text-cream/60 text-sm">
                    {overviewMetrics.revenueGrowth >= 0 ? '+' : ''}
                    {overviewMetrics.revenueGrowth.toFixed(1)}% vs last update
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card/80 border-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-cream text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Total Listeners
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">
                    {formatCompactNumber(overviewMetrics.totalListeners)}
                  </div>
                  <p className="text-cream/60 text-sm">
                    {overviewMetrics.listenersGrowth >= 0 ? '+' : ''}
                    {overviewMetrics.listenersGrowth.toFixed(1)}% vs last update
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>


          <TabsContent value="songs" className="space-y-6">
            <div className="space-y-4">
              {userSongs.length === 0 ? (
                <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardContent className="text-center py-12">
                    <Music className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Released Songs</h3>
                    <p className="text-muted-foreground">Release some songs in the Music Studio to see them here!</p>
                  </CardContent>
                </Card>
              ) : (
                userSongs.map((song) => {
                  const totalStreams = song.totalStreams ?? song.streams ?? 0;
                  const totalPlays = song.plays ?? song.streams ?? 0;
                  const songRevenue = typeof song.revenue === 'number' ? song.revenue : Number(song.revenue ?? 0);
                  const popularity = song.popularity ?? 0;
                  const trending = Boolean(song.trending);
                  const album = song.album ?? 'Single';
                  const genre = song.genre ?? 'Unknown';
                  const status = song.status ?? 'draft';

                  return (
                    <Card key={song.id} className="bg-card/80 border-accent">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                          <div className="lg:col-span-2 space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-cream">{song.title}</h3>
                              {trending && (
                                <Badge className="bg-accent text-background text-xs">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  Trending
                                </Badge>
                              )}
                            </div>
                            <p className="text-cream/60">{album}</p>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-accent font-bold">
                                {(totalStreams / 1000000).toFixed(1)}M streams
                              </span>
                              <span className="text-cream/80">
                                ${songRevenue.toLocaleString()} revenue
                              </span>
                            </div>
                          </div>

                          <div className="lg:col-span-2 space-y-2">
                            <p className="text-cream/60 text-sm">Platform Breakdown</p>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-sm">
                                <span>Total Plays</span>
                                <span className="text-accent">{totalPlays.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span>Popularity</span>
                                <span className="text-accent">{Math.round(popularity)}/100</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span>Quality</span>
                                <span className="text-accent">{song.quality_score}/100</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span>Status</span>
                                <span className="text-accent capitalize">{status}</span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="text-center space-y-1">
                              <p className="text-muted-foreground text-sm">Genre</p>
                              <p className="text-lg font-bold text-accent">{genre}</p>
                            </div>
                            <div className="space-y-2">
                              <Button
                                size="sm"
                                className="w-full bg-gradient-primary"
                                onClick={() =>
                                  toast({
                                    title: "Feature Coming Soon!",
                                    description: "Song promotion will be available soon!",
                                  })
                                }
                              >
                                <Share2 className="h-4 w-4 mr-1" />
                                Promote
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="playlists" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="bg-card/80 border-accent">
                <CardHeader>
                  <CardTitle className="text-cream text-lg">Indie Rock Hits</CardTitle>
                  <CardDescription>Spotify • 450K followers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Songs Included</span>
                      <span className="text-accent">2</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Monthly Streams</span>
                      <span className="text-accent">180K</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Position</span>
                      <span className="text-accent">#12, #28</span>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full bg-accent hover:bg-accent/80 text-background"
                    onClick={() => handleSubmitToPlaylist("Indie Rock Hits")}
                  >
                    Submit New Song
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-accent">
                <CardHeader>
                  <CardTitle className="text-cream text-lg">New Rock</CardTitle>
                  <CardDescription>Apple Music • 220K followers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Songs Included</span>
                      <span className="text-accent">1</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Monthly Streams</span>
                      <span className="text-accent">95K</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Position</span>
                      <span className="text-accent">#7</span>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full bg-accent hover:bg-accent/80 text-background"
                    onClick={() => handleSubmitToPlaylist("New Rock")}
                  >
                    Submit New Song
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card/80 border-accent">
                <CardHeader>
                  <CardTitle className="text-cream text-lg">Rock Essentials</CardTitle>
                  <CardDescription>YouTube Music • 380K followers</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Songs Included</span>
                      <span className="text-accent">3</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Monthly Streams</span>
                      <span className="text-accent">210K</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-cream/60">Position</span>
                      <span className="text-accent">#5, #18, #31</span>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    className="w-full bg-accent hover:bg-accent/80 text-background"
                    onClick={() => handleSubmitToPlaylist("Rock Essentials")}
                  >
                    Submit New Song
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="bg-card/80 border-accent">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                      <div className="space-y-2">
                        <h3 className="font-semibold text-cream">{campaign.name}</h3>
                        <Badge variant="outline">{campaign.platform}</Badge>
                        <Badge 
                          className={campaign.status === 'Active' ? 'bg-green-500' : 'bg-blue-500'}
                        >
                          {campaign.status}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <p className="text-cream/60 text-sm">Budget</p>
                        <p className="text-lg font-bold text-accent">${campaign.budget.toLocaleString()}</p>
                        <p className="text-cream/60 text-xs">End: {campaign.endDate}</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-cream/60 text-sm">Playlist Results</p>
                        <p className="text-lg font-bold text-accent">
                          {campaign.newPlacements}/{campaign.playlistsTargeted}
                        </p>
                        <Progress 
                          value={(campaign.newPlacements / campaign.playlistsTargeted) * 100} 
                          className="h-2" 
                        />
                      </div>

                      <div className="space-y-2">
                        <p className="text-cream/60 text-sm">Stream Increase</p>
                        <p className="text-lg font-bold text-accent">
                          +{campaign.streamIncrease.toLocaleString()}
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="border-accent text-accent">
                            View Details
                          </Button>
                          {campaign.status === 'Active' && (
                            <Button size="sm" className="bg-accent hover:bg-accent/80 text-background">
                              Modify
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Start New Campaign</CardTitle>
                <CardDescription>Promote your music on streaming platforms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button className="bg-accent hover:bg-accent/80 text-background">
                    Playlist Push Campaign
                  </Button>
                  <Button className="bg-accent hover:bg-accent/80 text-background">
                    Social Media Boost
                  </Button>
                  <Button className="bg-accent hover:bg-accent/80 text-background">
                    Radio Promotion
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StreamingPlatforms;