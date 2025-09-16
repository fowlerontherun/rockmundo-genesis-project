import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface PromotionCampaign {
  id: string;
  user_id: string;
  song_id: string;
  platform_id: string | null;
  platform_name: string | null;
  campaign_type: string;
  budget: number;
  status: string;
  playlist_name: string | null;
  playlists_targeted: number | null;
  new_placements: number | null;
  stream_increase: number | null;
  revenue_generated: number | null;
  message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface PromotionFunctionResponse {
  success: boolean;
  message: string;
  campaign?: PromotionCampaign;
  statsDelta?: {
    streams: number;
    revenue: number;
    listeners: number;
  };
}

const BASE_STREAMING_STATS = {
  totalStreams: 6_100_000,
  revenue: 18_700,
  listeners: 1_200_000,
};

const StreamingPlatforms = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useGameData();

  const [platforms, setPlatforms] = useState<StreamingPlatform[]>([]);
  const [playerAccounts, setPlayerAccounts] = useState<PlayerStreamingAccount[]>([]);
  const [userSongs, setUserSongs] = useState<SongWithPlatformData[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<PromotionCampaign[]>([]);
  const [streamingStats, setStreamingStats] = useState(() => ({ ...BASE_STREAMING_STATS }));
  const [promotionSettings, setPromotionSettings] = useState<Record<string, { platformId: string; budget: number }>>({});
  const [promoting, setPromoting] = useState<Record<string, boolean>>({});
  const [playlistSubmitting, setPlaylistSubmitting] = useState<Record<string, boolean>>({});
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState<string | null>(null);
  const [playlistBudget, setPlaylistBudget] = useState<number>(150);
  const [serverMessage, setServerMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setServerMessage(null);
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

      const streamingPlatforms = platformsData || [];
      const formattedSongs: SongWithPlatformData[] = songsData.map((song) => {
        const platformBreakdown = buildPlatformBreakdown(song, streamingPlatforms);
        const breakdownStreams = platformBreakdown.reduce(
          (total, entry) => total + entry.streams,
          0
        );
        let breakdownRevenue = platformBreakdown.reduce(
          (total, entry) => total + entry.revenue,
          0
        );

        if (
          breakdownRevenue === 0 &&
          song.revenue !== undefined &&
          song.revenue !== null
        ) {
          breakdownRevenue = safeNumber(song.revenue);
        }

        const totalStreamsValue =
          breakdownStreams > 0 ? breakdownStreams : safeNumber(song.streams);

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

      const { data: campaignsData, error: campaignsError } = await supabase
        .from('promotion_campaigns')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;
      setCampaigns(campaignsData || []);

      if (campaignsData && campaignsData.length > 0) {
        const streamsBoost = campaignsData.reduce((total, campaign) => total + (campaign.stream_increase ?? 0), 0);
        const revenueBoost = campaignsData.reduce((total, campaign) => total + (campaign.revenue_generated ?? 0), 0);
        const listenersBoost = campaignsData.reduce(
          (total, campaign) => total + (campaign.listeners_generated ?? 0),
          0
        );

        setStreamingStats({
          totalStreams: BASE_STREAMING_STATS.totalStreams + streamsBoost,
          revenue: BASE_STREAMING_STATS.revenue + revenueBoost,
          listeners: BASE_STREAMING_STATS.listeners + listenersBoost,
        });
      } else {
        setStreamingStats({ ...BASE_STREAMING_STATS });
      }

    } catch (error: any) {
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
    if (userSongs.length === 0) {
      setSelectedSongForPlaylist(null);
      return;
    }

    if (!selectedSongForPlaylist || !userSongs.some(song => song.id === selectedSongForPlaylist)) {
      setSelectedSongForPlaylist(userSongs[0].id);
    }
  }, [userSongs, selectedSongForPlaylist]);

  useEffect(() => {
    if (userSongs.length === 0 || platforms.length === 0) {
      return;
    }

    const defaultPlatformId =
      playerAccounts.find(account => account.is_connected)?.platform_id ??
      platforms[0]?.id ??
      null;

    if (!defaultPlatformId) {
      return;
    }

    setPromotionSettings(prev => {
      const updated = { ...prev };
      userSongs.forEach(song => {
        const existing = updated[song.id];
        if (!existing) {
          updated[song.id] = { platformId: defaultPlatformId, budget: 500 };
        } else if (!existing.platformId) {
          updated[song.id] = { ...existing, platformId: defaultPlatformId };
        }
      });
      return updated;
    });
  }, [userSongs, platforms, playerAccounts]);

  const formatLargeNumber = (value: number) => {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }

    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`;
    }

    return value.toLocaleString();
  };

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

  const handlePromoteSong = async (songId: string) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not signed in",
        description: "You need to be logged in to promote songs.",
      });
      return;
    }

    const settings = promotionSettings[songId];
    if (!settings || !settings.platformId) {
      const message = "Select a platform before launching a promotion.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "Missing information",
        description: message,
      });
      return;
    }

    if (settings.budget <= 0) {
      const message = "Enter a budget greater than zero to start a promotion.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "Invalid budget",
        description: message,
      });
      return;
    }

    const platformDetails = platforms.find(platform => platform.id === settings.platformId);
    const platformName = platformDetails?.name ?? null;

    setPromoting(prev => ({ ...prev, [songId]: true }));

    try {
      const { data, error } = await supabase.functions.invoke<PromotionFunctionResponse>("promotions", {
        body: {
          action: "promotion",
          songId,
          platformId: settings.platformId,
          platformName,
          budget: settings.budget,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data || !data.success) {
        throw new Error(data?.message ?? "Failed to start promotion.");
      }

      if (data.campaign) {
        setCampaigns(prev => [data.campaign, ...prev]);
      }

      if (data.statsDelta) {
        setStreamingStats(prev => ({
          totalStreams: prev.totalStreams + (data.statsDelta?.streams ?? 0),
          revenue: prev.revenue + (data.statsDelta?.revenue ?? 0),
          listeners: prev.listeners + (data.statsDelta?.listeners ?? 0),
        }));
      }

      setServerMessage({ type: "success", text: data.message });
      toast({
        title: "Promotion Started!",
        description: data.message,
      });
    } catch (error: any) {
      const message = error?.message ?? "Failed to start promotion.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "Promotion failed",
        description: message,
      });
    } finally {
      setPromoting(prev => ({ ...prev, [songId]: false }));
    }
  };

  const handleSubmitToPlaylist = async (playlistName: string, playlistPlatform: string) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Not signed in",
        description: "You need to be logged in to submit songs.",
      });
      return;
    }

    if (!selectedSongForPlaylist) {
      const message = "Select a song to submit to the playlist.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "No song selected",
        description: message,
      });
      return;
    }

    if (playlistBudget <= 0) {
      const message = "Set a playlist submission budget greater than zero.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "Invalid budget",
        description: message,
      });
      return;
    }

    const platformMatch = platforms.find(platform => platform.name.toLowerCase() === playlistPlatform.toLowerCase());

    setPlaylistSubmitting(prev => ({ ...prev, [playlistName]: true }));

    try {
      const { data, error } = await supabase.functions.invoke<PromotionFunctionResponse>("promotions", {
        body: {
          action: "playlist_submission",
          songId: selectedSongForPlaylist,
          platformId: platformMatch?.id,
          platformName: platformMatch?.name ?? playlistPlatform,
          budget: playlistBudget,
          playlistName,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data || !data.success) {
        throw new Error(data?.message ?? "Failed to submit playlist request.");
      }

      if (data.campaign) {
        setCampaigns(prev => [data.campaign, ...prev]);
      }

      if (data.statsDelta) {
        setStreamingStats(prev => ({
          totalStreams: prev.totalStreams + (data.statsDelta?.streams ?? 0),
          revenue: prev.revenue + (data.statsDelta?.revenue ?? 0),
          listeners: prev.listeners + (data.statsDelta?.listeners ?? 0),
        }));
      }

      setServerMessage({ type: "success", text: data.message });
      toast({
        title: "Playlist Submission Sent!",
        description: data.message,
      });
    } catch (error: any) {
      const message = error?.message ?? "Failed to submit playlist request.";
      setServerMessage({ type: "error", text: message });
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: message,
      });
    } finally {
      setPlaylistSubmitting(prev => ({ ...prev, [playlistName]: false }));
    }

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

        {serverMessage && (
          <Alert
            variant={serverMessage.type === "error" ? "destructive" : "default"}
            className="bg-card/80 border-accent"
          >
            <AlertTitle className="font-semibold">
              {serverMessage.type === "error" ? "Action Failed" : "Action Successful"}
            </AlertTitle>
            <AlertDescription>{serverMessage.text}</AlertDescription>
          </Alert>
        )}

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
                  <div className="text-3xl font-bold text-accent">
                    {formatLargeNumber(streamingStats.totalStreams)}
                  </div>
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
                  <div className="text-3xl font-bold text-accent">
                    ${streamingStats.revenue.toLocaleString()}
                  </div>
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
                  <div className="text-3xl font-bold text-accent">
                    {formatLargeNumber(streamingStats.listeners)}
                  </div>
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

                        <div className="space-y-3">
                          <div className="text-center space-y-1">
                            <p className="text-muted-foreground text-sm">Genre</p>
                            <p className="text-lg font-bold text-accent">{song.genre || 'Unknown'}</p>
                          </div>
                          <div className="space-y-3">
                            <div className="space-y-1">
                              <Label
                                htmlFor={`promotion-platform-${song.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Promotion Platform
                              </Label>
                              <Select
                                value={promotionSettings[song.id]?.platformId || undefined}
                                onValueChange={(value) =>
                                  setPromotionSettings(prev => ({
                                    ...prev,
                                    [song.id]: {
                                      platformId: value,
                                      budget: prev[song.id]?.budget ?? 500,
                                    },
                                  }))
                                }
                              >
                                <SelectTrigger
                                  id={`promotion-platform-${song.id}`}
                                  className="bg-background/40 border-accent/30 text-sm"
                                >
                                  <SelectValue placeholder="Select platform" />
                                </SelectTrigger>
                                <SelectContent>
                                  {platforms.map((platform) => (
                                    <SelectItem key={platform.id} value={platform.id}>
                                      {platform.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label
                                htmlFor={`promotion-budget-${song.id}`}
                                className="text-xs text-muted-foreground"
                              >
                                Budget ($)
                              </Label>
                              <Input
                                id={`promotion-budget-${song.id}`}
                                type="number"
                                min={50}
                                value={promotionSettings[song.id]?.budget ?? 500}
                                onChange={(event) => {
                                  const value = Number(event.target.value);
                                  setPromotionSettings(prev => {
                                    const fallbackPlatformId =
                                      prev[song.id]?.platformId ??
                                      playerAccounts.find(account => account.is_connected)?.platform_id ??
                                      platforms[0]?.id ??
                                      "";

                                    return {
                                      ...prev,
                                      [song.id]: {
                                        platformId: fallbackPlatformId,
                                        budget: Number.isFinite(value) ? value : 0,
                                      },
                                    };
                                  });
                                }}
                                className="bg-background/40 border-accent/30 text-sm"
                              />
                            </div>
                            <Button
                              size="sm"
                              className="w-full bg-gradient-primary"
                              onClick={() => handlePromoteSong(song.id)}
                              disabled={promoting[song.id] || !promotionSettings[song.id]?.platformId}
                            >
                              {promoting[song.id] ? (
                                "Promoting..."
                              ) : (
                                <span className="flex items-center justify-center gap-1">
                                  <Share2 className="h-4 w-4" />
                                  Promote
                                </span>
                              )}
                            </Button>
                          </div>
                        </div>
                    </div>
                  </CardContent>
                </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="playlists" className="space-y-6">
            {userSongs.length > 0 && (
              <Card className="bg-card/80 border-accent">
                <CardHeader>
                  <CardTitle className="text-cream text-lg">Submission Preferences</CardTitle>
                  <CardDescription>Select the song and budget for playlist submissions</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="playlist-song-select" className="text-sm text-muted-foreground">
                      Song to Submit
                    </Label>
                    <Select
                      value={selectedSongForPlaylist ?? undefined}
                      onValueChange={(value) => setSelectedSongForPlaylist(value)}
                    >
                      <SelectTrigger
                        id="playlist-song-select"
                        className="bg-background/40 border-accent/30"
                      >
                        <SelectValue placeholder="Choose a released song" />
                      </SelectTrigger>
                      <SelectContent>
                        {userSongs.map(song => (
                          <SelectItem key={song.id} value={song.id}>
                            {song.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playlist-budget-input" className="text-sm text-muted-foreground">
                      Submission Budget ($)
                    </Label>
                    <Input
                      id="playlist-budget-input"
                      type="number"
                      min={25}
                      value={playlistBudget}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setPlaylistBudget(Number.isFinite(value) ? value : 0);
                      }}
                      className="bg-background/40 border-accent/30"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

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
                    onClick={() => handleSubmitToPlaylist("Indie Rock Hits", "Spotify")}
                    disabled={playlistSubmitting["Indie Rock Hits"] || !selectedSongForPlaylist}
                  >
                    {playlistSubmitting["Indie Rock Hits"] ? "Submitting..." : "Submit New Song"}
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
                    onClick={() => handleSubmitToPlaylist("New Rock", "Apple Music")}
                    disabled={playlistSubmitting["New Rock"] || !selectedSongForPlaylist}
                  >
                    {playlistSubmitting["New Rock"] ? "Submitting..." : "Submit New Song"}
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
                    onClick={() => handleSubmitToPlaylist("Rock Essentials", "YouTube Music")}
                    disabled={playlistSubmitting["Rock Essentials"] || !selectedSongForPlaylist}
                  >
                    {playlistSubmitting["Rock Essentials"] ? "Submitting..." : "Submit New Song"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            <div className="space-y-4">
              {campaigns.length === 0 ? (
                <Card className="bg-card/80 border-accent">
                  <CardContent className="py-10 text-center space-y-2">
                    <Star className="h-8 w-8 text-accent mx-auto" />
                    <p className="text-cream font-semibold">No campaigns yet</p>
                    <p className="text-cream/60 text-sm">
                      Launch a promotion or playlist submission to see it tracked here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                campaigns.map((campaign) => {
                  const platformLabel =
                    campaign.platform_name ??
                    platforms.find(platform => platform.id === campaign.platform_id)?.name ??
                    "Unknown Platform";
                  const statusLabel = campaign.status
                    ? campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)
                    : "Active";
                  const statusColor =
                    campaign.status === "active"
                      ? "bg-green-500"
                      : campaign.status === "pending"
                        ? "bg-yellow-500"
                        : "bg-blue-500";
                  const progressTarget = campaign.playlists_targeted ?? 0;
                  const progressValue =
                    progressTarget > 0
                      ? Math.min(100, ((campaign.new_placements ?? 0) / progressTarget) * 100)
                      : 0;
                  const messageLabel =
                    campaign.message ??
                    (campaign.campaign_type === "playlist"
                      ? `Playlist submission to ${campaign.playlist_name ?? platformLabel}`
                      : `Promotion on ${platformLabel}`);
                  const createdLabel = campaign.created_at
                    ? new Date(campaign.created_at).toLocaleDateString()
                    : "Recently";

                  return (
                    <Card key={campaign.id} className="bg-card/80 border-accent">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
                          <div className="space-y-2">
                            <h3 className="font-semibold text-cream">{messageLabel}</h3>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{platformLabel}</Badge>
                              <Badge variant="outline" className="capitalize">
                                {campaign.campaign_type}
                              </Badge>
                              <Badge className={`${statusColor} text-background`}>{statusLabel}</Badge>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Budget</p>
                            <p className="text-lg font-bold text-accent">${campaign.budget.toLocaleString()}</p>
                            <p className="text-cream/60 text-xs">Created: {createdLabel}</p>
                            {campaign.playlist_name && (
                              <p className="text-cream/60 text-xs">Playlist: {campaign.playlist_name}</p>
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Playlist Results</p>
                            <p className="text-lg font-bold text-accent">
                              {campaign.new_placements ?? 0}/{campaign.playlists_targeted ?? 0}
                            </p>
                            <Progress value={progressValue} className="h-2" />
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Performance Impact</p>
                            <p className="text-lg font-bold text-accent">
                              +{(campaign.stream_increase ?? 0).toLocaleString()} streams
                            </p>
                            <p className="text-cream/80 text-sm">
                              +${(campaign.revenue_generated ?? 0).toLocaleString()} revenue
                            </p>
                            <p className="text-cream/60 text-xs">
                              +{campaign.listeners_generated ?? 0} listeners
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
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