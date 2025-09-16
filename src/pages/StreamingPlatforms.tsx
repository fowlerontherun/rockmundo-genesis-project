import { useState } from "react";
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

const StreamingPlatforms = () => {
  const { toast } = useToast();

  const platforms = [
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
              {platforms.map((platform) => (
                <Card key={platform.id} className="bg-card/80 border-accent">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{platform.logo}</span>
                        <CardTitle className="text-cream text-sm">{platform.name}</CardTitle>
                      </div>
                      <Badge 
                        className={`${platform.color} text-white text-xs`}
                      >
                        {platform.growth > 0 ? '+' : ''}{platform.growth}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-cream/60 text-xs">Monthly Listeners</span>
                        <span className="text-cream font-bold text-sm">
                          {(platform.monthlyListeners / 1000).toFixed(0)}K
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cream/60 text-xs">Total Streams</span>
                        <span className="text-accent font-bold text-sm">
                          {(platform.streams / 1000000).toFixed(1)}M
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cream/60 text-xs">Revenue</span>
                        <span className="text-accent font-bold text-sm">
                          ${platform.revenue.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-cream/60 text-xs">Playlists</span>
                        <span className="text-cream font-bold text-sm">{platform.playlists}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-accent/20">
                      <p className="text-cream/60 text-xs mb-1">Top Playlist</p>
                      <p className="text-cream text-xs font-semibold">{platform.topPlaylist}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
              {songs.map((song) => (
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
                            <span className="text-cream">Spotify</span>
                            <span className="text-accent">{(song.platforms.spotify / 1000).toFixed(0)}K</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-cream">Apple Music</span>
                            <span className="text-accent">{(song.platforms.apple / 1000).toFixed(0)}K</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-cream">YouTube</span>
                            <span className="text-accent">{(song.platforms.youtube / 1000).toFixed(0)}K</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-cream">Amazon</span>
                            <span className="text-accent">{(song.platforms.amazon / 1000).toFixed(0)}K</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-center space-y-1">
                          <p className="text-cream/60 text-sm">Playlist Placements</p>
                          <p className="text-2xl font-bold text-accent">{song.playlistPlacements}</p>
                        </div>
                        <div className="space-y-2">
                          <Button 
                            size="sm" 
                            className="w-full bg-accent hover:bg-accent/80 text-background"
                            onClick={() => handlePromoteSong(song.id, "Spotify")}
                          >
                            <Share2 className="h-4 w-4 mr-1" />
                            Promote
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full border-accent text-accent hover:bg-accent/10"
                          >
                            <Radio className="h-4 w-4 mr-1" />
                            Submit to Playlists
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
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