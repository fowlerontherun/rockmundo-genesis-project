import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Play,
  Users,
  DollarSign,
  Music,
  Share2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGameData } from "@/hooks/useGameData";

interface StreamingPlatform {
  id: string;
  name: string;
  description: string;
  icon: string;
  min_followers: number;
  revenue_per_play: number;
  created_at: string;
}

interface PlayerStreamingAccount {
  id: string;
  user_id: string;
  platform_id: string;
  is_connected: boolean;
  followers: number;
  monthly_plays: number;
  monthly_revenue: number;
  connected_at: string;
  updated_at: string;
  platform?: StreamingPlatform;
}

type PlatformMetricRecord = Record<string, unknown> | null;

interface SongRecord {
  id: string;
  title: string;
  genre?: string | null;
  status?: string | null;
  album?: string | null;
  album_name?: string | null;
  albumTitle?: string | null;
  revenue?: number | string | null;
  streams?: number | string | null;
  platform_streams?: PlatformMetricRecord;
  platform_revenue?: PlatformMetricRecord;
  spotify_streams?: number | string | null;
  apple_music_streams?: number | string | null;
  apple_streams?: number | string | null;
  youtube_music_streams?: number | string | null;
  youtube_streams?: number | string | null;
  amazon_music_streams?: number | string | null;
  amazon_streams?: number | string | null;
  tidal_streams?: number | string | null;
  spotify_revenue?: number | string | null;
  apple_music_revenue?: number | string | null;
  apple_revenue?: number | string | null;
  youtube_music_revenue?: number | string | null;
  youtube_revenue?: number | string | null;
  amazon_music_revenue?: number | string | null;
  amazon_revenue?: number | string | null;
  tidal_revenue?: number | string | null;
  [key: string]: unknown;
}

interface PlatformBreakdown {
  key: string;
  label: string;
  streams: number;
  revenue: number;
}

interface StreamingStatsRecord {
  id: string;
  song_id: string;
  user_id: string;
  total_streams: number | null;
  total_revenue: number | null;
  platform_breakdown: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

interface SongWithPlatformData {
  id: string;
  title: string;
  album?: string | null;
  genre?: string | null;
  status?: string | null;
  totalStreams: number;
  totalRevenue: number;
  platformBreakdown: PlatformBreakdown[];
}

const safeNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return 0;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const formatPlatformLabel = (rawKey: string): string => {
  const key = rawKey.toLowerCase();

  if (key.includes("spotify")) return "Spotify";
  if (key.includes("apple")) return "Apple Music";
  if (key.includes("youtube")) return "YouTube Music";
  if (key.includes("amazon")) return "Amazon Music";
  if (key.includes("tidal")) return "Tidal";

  return rawKey
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const buildPlatformBreakdown = (
  song: SongRecord,
  platforms: StreamingPlatform[]
): PlatformBreakdown[] => {
  const breakdownMap = new Map<string, PlatformBreakdown>();

  const addEntry = (
    key: string,
    label: string,
    streamsValue: unknown,
    revenueValue?: unknown
  ) => {
    const streams = safeNumber(streamsValue);
    const normalizedLabel = label.toLowerCase();
    const platformInfo = platforms.find(
      (platform) => platform.name?.toLowerCase() === normalizedLabel
    );

    const providedRevenue =
      revenueValue !== undefined ? safeNumber(revenueValue) : undefined;
    const revenue =
      providedRevenue !== undefined
        ? providedRevenue
        : streams * (platformInfo?.revenue_per_play ?? 0);

    const existing = breakdownMap.get(normalizedLabel);

    if (existing) {
      breakdownMap.set(normalizedLabel, {
        ...existing,
        streams: existing.streams + streams,
        revenue: existing.revenue + revenue,
      });
      return;
    }

    breakdownMap.set(normalizedLabel, {
      key,
      label: platformInfo?.name ?? label,
      streams,
      revenue,
    });
  };

  if (song.platform_streams && typeof song.platform_streams === "object") {
    Object.entries(song.platform_streams).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      const label = formatPlatformLabel(key);

      if (typeof value === "object" && !Array.isArray(value)) {
        const metric = value as { streams?: unknown; revenue?: unknown };
        addEntry(key, label, metric.streams ?? value, metric.revenue);
      } else {
        addEntry(key, label, value);
      }
    });
  }

  if (song.platform_revenue && typeof song.platform_revenue === "object") {
    Object.entries(song.platform_revenue).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      const label = formatPlatformLabel(key);
      const normalizedLabel = label.toLowerCase();

      if (!breakdownMap.has(normalizedLabel)) {
        addEntry(key, label, 0, value);
      }
    });
  }

  if (breakdownMap.size === 0) {
    const fallbackFields = [
      { key: "spotify_streams", label: "Spotify", revenueKey: "spotify_revenue" },
      {
        key: "apple_music_streams",
        label: "Apple Music",
        revenueKey: "apple_music_revenue",
      },
      { key: "apple_streams", label: "Apple Music", revenueKey: "apple_revenue" },
      {
        key: "youtube_music_streams",
        label: "YouTube Music",
        revenueKey: "youtube_music_revenue",
      },
      { key: "youtube_streams", label: "YouTube Music", revenueKey: "youtube_revenue" },
      {
        key: "amazon_music_streams",
        label: "Amazon Music",
        revenueKey: "amazon_music_revenue",
      },
      { key: "amazon_streams", label: "Amazon Music", revenueKey: "amazon_revenue" },
      { key: "tidal_streams", label: "Tidal", revenueKey: "tidal_revenue" },
    ];

    fallbackFields.forEach(({ key, label, revenueKey }) => {
      const streamsValue = (song as Record<string, unknown>)[key];
      const revenueValue = revenueKey
        ? (song as Record<string, unknown>)[revenueKey]
        : undefined;

      if (streamsValue !== undefined && streamsValue !== null) {
        addEntry(key, label, streamsValue, revenueValue);
      }
    });
  }

  const breakdown = Array.from(breakdownMap.values()).filter(
    (entry) => entry.streams > 0 || entry.revenue > 0
  );

  breakdown.sort((a, b) => b.streams - a.streams);

  return breakdown;
};

const buildPlatformBreakdownFromStats = (
  stats: StreamingStatsRecord | undefined
): PlatformBreakdown[] | null => {
  if (!stats || !Array.isArray(stats.platform_breakdown)) {
    return null;
  }

  const entries = (stats.platform_breakdown as Array<Record<string, unknown>>)
    .map((entry, index) => {
      const entryRecord = entry as Record<string, unknown>;
      const rawKey = entryRecord.key;
      const rawName = entryRecord.name ?? entryRecord.label ?? rawKey;
      const label = typeof rawName === "string"
        ? rawName
        : typeof rawKey === "string"
          ? formatPlatformLabel(rawKey)
          : `Platform ${index + 1}`;

      const key = typeof rawKey === "string"
        ? rawKey
        : label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const streams = safeNumber(entryRecord.streams);
      const revenue = entryRecord.revenue !== undefined && entryRecord.revenue !== null
        ? safeNumber(entryRecord.revenue)
        : streams * safeNumber(entryRecord["revenue_per_play"]);

      return {
        key,
        label,
        streams,
        revenue,
      };
    })
    .filter((entry) => entry.streams > 0 || entry.revenue > 0);

  return entries.length > 0 ? entries : null;
};

const formatLargeNumber = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(1);
    return `${parseFloat(formatted)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    const formatted = (value / 1_000).toFixed(1);
    return `${parseFloat(formatted)}K`;
  }
  return Math.round(value).toLocaleString();
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const StreamingPlatforms = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useGameData();

  const [platforms, setPlatforms] = useState<StreamingPlatform[]>([]);
  const [playerAccounts, setPlayerAccounts] = useState<PlayerStreamingAccount[]>([]);
  const [userSongs, setUserSongs] = useState<SongWithPlatformData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;

    setLoading(true);

    try {
      // Load streaming platforms
      const { data: platformsData, error: platformsError } = await supabase
        .from('streaming_platforms')
        .select('*')
        .order('name');

      if (platformsError) throw platformsError;
      setPlatforms(platformsData || []);

      // Load player's streaming accounts
      const { data: accountsData, error: accountsError } = await supabase
        .from('player_streaming_accounts')
        .select(`
          *,
          streaming_platforms!player_streaming_accounts_platform_id_fkey(*)
        `)
        .eq('user_id', user.id);

      if (accountsError) throw accountsError;
      setPlayerAccounts(accountsData || []);

      // Load player's songs with streaming metrics
      let songsData: SongRecord[] = [];
      const songsResponse = await supabase
        .from('songs')
        .select('*')
        .eq('artist_id', user.id)
        .eq('status', 'released')
        .order('created_at', { ascending: false });

      if (songsResponse.error) {
        // Some environments may use user_id instead of artist_id
        if (songsResponse.error.message?.toLowerCase().includes('artist_id')) {
          const fallbackResponse = await supabase
            .from('songs')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'released')
            .order('created_at', { ascending: false });

          if (fallbackResponse.error) throw fallbackResponse.error;
          songsData = (fallbackResponse.data as SongRecord[]) || [];
        } else {
          throw songsResponse.error;
        }
      } else {
        songsData = (songsResponse.data as SongRecord[]) || [];
      }

      let streamingStatsData: StreamingStatsRecord[] = [];
      if (songsData.length > 0) {
        const songIds = songsData.map((song) => song.id);
        const { data: statsData, error: statsError } = await supabase
          .from('streaming_stats')
          .select('*')
          .eq('user_id', user.id)
          .in('song_id', songIds);

        if (statsError) throw statsError;
        streamingStatsData = (statsData as StreamingStatsRecord[]) || [];
      }

      const statsMap = new Map<string, StreamingStatsRecord>();
      streamingStatsData.forEach((stat) => {
        if (stat?.song_id) {
          statsMap.set(stat.song_id, stat);
        }
      });

      const streamingPlatforms = platformsData || [];
      const formattedSongs: SongWithPlatformData[] = songsData.map((song) => {
        const stats = statsMap.get(song.id);
        const statsBreakdown = buildPlatformBreakdownFromStats(stats);
        const platformBreakdown = (statsBreakdown && statsBreakdown.length > 0)
          ? statsBreakdown
          : buildPlatformBreakdown(song, streamingPlatforms);

        const breakdownStreams = platformBreakdown.reduce(
          (total, entry) => total + entry.streams,
          0
        );
        let breakdownRevenue = platformBreakdown.reduce(
          (total, entry) => total + entry.revenue,
          0
        );

        if (stats) {
          const statsRevenue = safeNumber(stats.total_revenue);
          if (statsRevenue > 0) {
            breakdownRevenue = statsRevenue;
          }
        } else if (
          breakdownRevenue === 0 &&
          song.revenue !== undefined &&
          song.revenue !== null
        ) {
          breakdownRevenue = safeNumber(song.revenue);
        }

        let totalStreamsValue =
          breakdownStreams > 0 ? breakdownStreams : safeNumber(song.streams);

        if (stats) {
          const statsStreams = safeNumber(stats.total_streams);
          if (statsStreams > 0) {
            totalStreamsValue = statsStreams;
          }
        }

        return {
          id: song.id,
          title: song.title,
          album: song.album ?? song.album_name ?? song.albumTitle ?? null,
          genre: song.genre ?? undefined,
          status: song.status ?? undefined,
          totalStreams: totalStreamsValue,
          totalRevenue: breakdownRevenue,
          platformBreakdown,
        };
      });

      setUserSongs(formattedSongs);

    } catch (error) {
      console.error('Error loading streaming data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load streaming data",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  useEffect(() => {
    const handleStreamingRefresh = () => {
      loadData();
    };

    window.addEventListener('streaming:refresh', handleStreamingRefresh);
    return () => window.removeEventListener('streaming:refresh', handleStreamingRefresh);
  }, [loadData]);

  const connectPlatform = async (platformId: string) => {
    if (!user || !profile) return;

    try {
      const platform = platforms.find(p => p.id === platformId);
      if (!platform) return;

      // Check if user meets requirements
      if ((profile.fame || 0) < platform.min_followers) {
        toast({
          variant: "destructive",
          title: "Requirements not met",
          description: `You need ${platform.min_followers} fame to connect to ${platform.name}`,
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
    } catch (error) {
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
              {platforms.map((platform) => {
                const account = playerAccounts.find(acc => acc.platform_id === platform.id);
                return (
                  <Card key={platform.id} className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{platform.icon || '🎵'}</span>
                          <CardTitle className="text-lg">{platform.name}</CardTitle>
                        </div>
                        {account?.is_connected ? (
                          <Badge className="bg-success text-success-foreground">Connected</Badge>
                        ) : (
                          <Badge variant="outline">Not Connected</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {account?.is_connected ? (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Followers</span>
                            <span className="font-bold text-sm">{account.followers.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Monthly Plays</span>
                            <span className="text-accent font-bold text-sm">
                              {account.monthly_plays.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Revenue</span>
                            <span className="text-success font-bold text-sm">
                              ${account.monthly_revenue.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">{platform.description}</p>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Required Fame:</span>
                            <span className="font-bold text-sm">{platform.min_followers}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground text-xs">Revenue/Play:</span>
                            <span className="text-success font-bold text-sm">
                              ${platform.revenue_per_play}
                            </span>
                          </div>
                          <Button
                            onClick={() => connectPlatform(platform.id)}
                            disabled={(profile?.fame || 0) < platform.min_followers}
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
                  <div className="text-3xl font-bold text-accent">6.1M</div>
                  <p className="text-cream/60 text-sm">+18% this month</p>
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
                  <div className="text-3xl font-bold text-accent">$18,700</div>
                  <p className="text-cream/60 text-sm">This month</p>
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
                  <div className="text-3xl font-bold text-accent">1.2M</div>
                  <p className="text-cream/60 text-sm">Monthly unique</p>
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
                userSongs.map((song) => (
                  <Card key={song.id} className="bg-card/80 border-accent">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        <div className="lg:col-span-2 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-cream">{song.title}</h3>
                            {song.status && (
                              <Badge variant="outline" className="border-accent text-accent capitalize">
                                {song.status}
                              </Badge>
                            )}
                          </div>
                          <p className="text-cream/60">{song.album ?? 'Single Release'}</p>
                          {song.genre && (
                            <p className="text-muted-foreground text-sm">
                              Genre: <span className="text-cream">{song.genre}</span>
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <span className="text-accent font-bold">
                              {formatLargeNumber(song.totalStreams)} streams
                            </span>
                            <span className="text-cream/80">
                              {currencyFormatter.format(song.totalRevenue)}
                            </span>
                          </div>
                        </div>

                        <div className="lg:col-span-2 space-y-3">
                          <p className="text-cream/60 text-sm">Platform Breakdown</p>
                          {song.platformBreakdown.length > 0 ? (
                            <div className="space-y-2">
                              {song.platformBreakdown.map((platform) => (
                                <div
                                  key={`${song.id}-${platform.label}`}
                                  className="flex items-center justify-between rounded-lg border border-primary/20 bg-background/40 px-3 py-2"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium text-cream">{platform.label}</span>
                                    <span className="text-cream/60 text-xs">
                                      {currencyFormatter.format(platform.revenue)}
                                    </span>
                                  </div>
                                  <span className="text-accent font-semibold">
                                    {formatLargeNumber(platform.streams)} streams
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-muted-foreground text-sm">No platform data available yet.</p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="rounded-lg border border-primary/20 bg-background/40 p-3 text-center">
                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Streams</p>
                            <p className="text-xl font-bold text-accent">
                              {formatLargeNumber(song.totalStreams)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-primary/20 bg-background/40 p-3 text-center">
                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Revenue</p>
                            <p className="text-xl font-bold text-accent">
                              {currencyFormatter.format(song.totalRevenue)}
                            </p>
                          </div>
                          <div className="rounded-lg border border-primary/20 bg-background/40 p-3 text-center">
                            <p className="text-muted-foreground text-xs uppercase tracking-wide">Genre</p>
                            <p className="text-lg font-semibold text-cream">{song.genre ?? 'Unknown'}</p>
                          </div>
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
                    </CardContent>
                  </Card>
                ))
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