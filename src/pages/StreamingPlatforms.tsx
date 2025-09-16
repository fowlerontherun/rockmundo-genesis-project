import { useState, useEffect } from "react";
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
  const [userSongs, setUserSongs] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<StreamingCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

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
        .eq('user_id', user!.id);

      if (accountsError) throw accountsError;
      setPlayerAccounts(accountsData || []);

      // Load player's songs
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('artist_id', user!.id)
        .eq('status', 'released')
        .order('created_at', { ascending: false });

      if (songsError) throw songsError;
      setUserSongs(songsData || []);

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
    } catch (error: any) {
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

  const mockPlatforms = [
    {
      id: 1,
      name: "Spotify",
      logo: "🎵",
      monthlyListeners: 450000,
      streams: 2400000,
      revenue: 8200,
      royaltyRate: 0.003,
      playlists: 45,
      topPlaylist: "Indie Rock Hits",
      growth: 12.5,
      color: "bg-green-500"
    },
    {
      id: 2,
      name: "Apple Music",
      logo: "🎶",
      monthlyListeners: 280000,
      streams: 1200000,
      revenue: 4800,
      royaltyRate: 0.004,
      playlists: 23,
      topPlaylist: "New Rock",
      growth: 8.3,
      color: "bg-gray-700"
    },
    {
      id: 3,
      name: "YouTube Music",
      logo: "📺",
      monthlyListeners: 320000,
      streams: 1800000,
      revenue: 3600,
      royaltyRate: 0.002,
      playlists: 67,
      topPlaylist: "Rock Essentials",
      growth: 15.2,
      color: "bg-red-500"
    },
    {
      id: 4,
      name: "Amazon Music",
      logo: "📻",
      monthlyListeners: 150000,
      streams: 680000,
      revenue: 2100,
      royaltyRate: 0.0035,
      playlists: 18,
      topPlaylist: "Prime Rock",
      growth: 6.7,
      color: "bg-orange-500"
    }
  ];

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
                      <div className="lg:col-span-2 space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold text-cream">{song.title}</h3>
                          {song.trending && (
                            <Badge className="bg-accent text-background text-xs">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Trending
                            </Badge>
                          )}
                        </div>
                        <p className="text-cream/60">{song.album}</p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-accent font-bold">
                            {(song.totalStreams / 1000000).toFixed(1)}M streams
                          </span>
                          <span className="text-cream/80">
                            ${song.revenue.toLocaleString()} revenue
                          </span>
                        </div>
                      </div>

                      <div className="lg:col-span-2 space-y-2">
                        <p className="text-cream/60 text-sm">Platform Breakdown</p>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-sm">
                            <span>Total Plays</span>
                            <span className="text-accent">{song.plays.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span>Popularity</span>
                            <span className="text-accent">{song.popularity}/100</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span>Quality</span>
                            <span className="text-accent">{song.quality_score}/100</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span>Status</span>
                            <span className="text-accent capitalize">{song.status}</span>
                          </div>
                        </div>
                      </div>

                        <div className="space-y-2">
                          <div className="text-center space-y-1">
                            <p className="text-muted-foreground text-sm">Genre</p>
                            <p className="text-lg font-bold text-accent">{song.genre || 'Unknown'}</p>
                          </div>
                          <div className="space-y-2">
                            <Button 
                              size="sm" 
                              className="w-full bg-gradient-primary"
                              onClick={() => toast({ title: "Feature Coming Soon!", description: "Song promotion will be available soon!" })}
                            >
                              <Share2 className="h-4 w-4 mr-1" />
                              Promote
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