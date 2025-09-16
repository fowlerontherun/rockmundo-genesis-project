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

interface StreamingCampaign {
  id: string;
  user_id: string;
  platform: string;
  name: string;
  budget: number;
  status: string;
  playlists_targeted?: number | null;
  new_placements?: number | null;
  stream_increase?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

type StreamingCampaignInput = {
  name: string;
  platform: string;
  budget: number;
  status?: string;
  playlists_targeted?: number;
  new_placements?: number;
  stream_increase?: number;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
};

type CampaignPreset = "playlist" | "social" | "radio";

const StreamingPlatforms = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useGameData();

  const [platforms, setPlatforms] = useState<StreamingPlatform[]>([]);
  const [playerAccounts, setPlayerAccounts] = useState<PlayerStreamingAccount[]>([]);
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

  const loadCampaigns = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('streaming_campaigns')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    setCampaigns((data as StreamingCampaign[]) || []);
  };

  const loadData = async () => {

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

      await loadCampaigns();

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

  const createCampaign = async (campaign: StreamingCampaignInput) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('streaming_campaigns')
        .insert({
          user_id: user.id,
          platform: campaign.platform,
          name: campaign.name,
          budget: campaign.budget,
          status: campaign.status ?? 'planned',
          playlists_targeted: campaign.playlists_targeted ?? 0,
          new_placements: campaign.new_placements ?? 0,
          stream_increase: campaign.stream_increase ?? 0,
          start_date: campaign.start_date ?? null,
          end_date: campaign.end_date ?? null,
          notes: campaign.notes ?? null,
        });

      if (error) throw error;

      await loadCampaigns();

      toast({
        title: "Campaign created",
        description: "Your streaming campaign has been created.",
      });
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        variant: "destructive",
        title: "Campaign creation failed",
        description: "Unable to create campaign. Please try again.",
      });
    }
  };

  const updateCampaign = async (
    campaignId: string,
    updates: Partial<StreamingCampaignInput>
  ) => {
    if (!user) return;

    try {
      const payload = Object.fromEntries(
        Object.entries(updates).filter(([, value]) => value !== undefined)
      ) as Partial<StreamingCampaignInput>;

      if (payload.start_date !== undefined) {
        payload.start_date = payload.start_date ?? null;
      }

      if (payload.end_date !== undefined) {
        payload.end_date = payload.end_date ?? null;
      }

      if (payload.notes !== undefined) {
        payload.notes = payload.notes ?? null;
      }

      const { error } = await supabase
        .from('streaming_campaigns')
        .update(payload)
        .eq('id', campaignId)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadCampaigns();

      toast({
        title: "Campaign updated",
        description: "Your campaign changes have been saved.",
      });
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "Unable to update campaign. Please try again.",
      });
    }
  };

  const handleCreatePresetCampaign = async (preset: CampaignPreset) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Sign in required",
        description: "You need to sign in to manage streaming campaigns.",
      });
      return;
    }

    const now = new Date();
    const startDate = now.toISOString().split('T')[0];
    const endDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const basePresets: Record<CampaignPreset, Omit<StreamingCampaignInput, 'start_date' | 'end_date'>> = {
      playlist: {
        name: `Playlist Push ${startDate}`,
        platform: "Spotify",
        budget: 2000,
        status: "active",
        playlists_targeted: 40,
        new_placements: 0,
        stream_increase: 0,
        notes: "Quick-start playlist outreach campaign.",
      },
      social: {
        name: `Social Boost ${startDate}`,
        platform: "YouTube Music",
        budget: 1500,
        status: "planned",
        playlists_targeted: 25,
        new_placements: 0,
        stream_increase: 0,
        notes: "Social media amplification for your latest release.",
      },
      radio: {
        name: `Radio Promotion ${startDate}`,
        platform: "Apple Music",
        budget: 1200,
        status: "planned",
        playlists_targeted: 15,
        new_placements: 0,
        stream_increase: 0,
        notes: "Targeted radio-style promotion across major platforms.",
      },
    };

    await createCampaign({
      ...basePresets[preset],
      start_date: startDate,
      end_date: endDate,
    });
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
  ];

  const handlePromoteSong = (songId: number, platform: string) => {
    toast({
      title: "Promotion Started!",
      description: `Your song is now being promoted on ${platform}.`,
    });
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
                  <CardContent className="py-12 text-center space-y-2">
                    <h3 className="text-lg font-semibold text-cream">No campaigns yet</h3>
                    <p className="text-muted-foreground text-sm">
                      Launch a promotion to see your streaming campaigns here.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                campaigns.map((campaign) => {
                  const targeted = campaign.playlists_targeted ?? 0;
                  const placements = campaign.new_placements ?? 0;
                  const progress = targeted > 0 ? Math.min((placements / targeted) * 100, 100) : 0;
                  const statusLabel = campaign.status
                    ? campaign.status
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (char) => char.toUpperCase())
                    : "Unknown";
                  const isActive = campaign.status?.toLowerCase() === "active";
                  const endDateLabel = campaign.end_date
                    ? new Date(campaign.end_date).toLocaleDateString()
                    : "No end date";
                  const targetedDisplay = targeted > 0 ? targeted : '—';

                  return (
                    <Card key={campaign.id} className="bg-card/80 border-accent">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
                          <div className="space-y-2">
                            <h3 className="font-semibold text-cream">{campaign.name}</h3>
                            <Badge variant="outline">{campaign.platform}</Badge>
                            <Badge className={isActive ? "bg-green-500" : "bg-blue-500"}>
                              {statusLabel}
                            </Badge>
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Budget</p>
                            <p className="text-lg font-bold text-accent">
                              ${Number(campaign.budget ?? 0).toLocaleString()}
                            </p>
                            <p className="text-cream/60 text-xs">End: {endDateLabel}</p>
                          </div>

                          <div className="space-y-1">
                            <p className="text-cream/60 text-sm">Playlist Results</p>
                            <p className="text-lg font-bold text-accent">
                              {placements}/{targetedDisplay}
                            </p>
                            <Progress value={progress} className="h-2" />
                          </div>

                          <div className="space-y-2">
                            <p className="text-cream/60 text-sm">Stream Increase</p>
                            <p className="text-lg font-bold text-accent">
                              +{Number(campaign.stream_increase ?? 0).toLocaleString()}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-accent text-accent"
                              >
                                View Details
                              </Button>
                              <Button
                                size="sm"
                                className="bg-accent hover:bg-accent/80 text-background"
                                onClick={() =>
                                  updateCampaign(campaign.id, {
                                    status: isActive ? "completed" : "active",
                                  })
                                }
                              >
                                {isActive ? "Mark Complete" : "Reactivate"}
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

            <Card className="bg-card/80 border-accent">
              <CardHeader>
                <CardTitle className="text-cream">Start New Campaign</CardTitle>
                <CardDescription>Promote your music on streaming platforms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    className="bg-accent hover:bg-accent/80 text-background"
                    onClick={() => handleCreatePresetCampaign("playlist")}
                  >
                    Playlist Push Campaign
                  </Button>
                  <Button
                    className="bg-accent hover:bg-accent/80 text-background"
                    onClick={() => handleCreatePresetCampaign("social")}
                  >
                    Social Media Boost
                  </Button>
                  <Button
                    className="bg-accent hover:bg-accent/80 text-background"
                    onClick={() => handleCreatePresetCampaign("radio")}
                  >
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