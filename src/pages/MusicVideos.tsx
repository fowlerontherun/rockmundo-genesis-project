import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, TrendingUp, Eye, DollarSign, Video, Film, Tv, Plus, Calendar, Star, Users, Clock, BarChart3, Music } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { SongPlayer } from "@/components/audio/SongPlayer";
import { VideoAnalytics } from "@/components/videos/VideoAnalytics";

interface MusicVideo {
  id: string;
  song_id: string;
  title: string;
  description: string | null;
  budget: number;
  production_quality: number;
  director_id: string | null;
  status: "planning" | "production" | "released";
  release_date: string | null;
  views_count: number;
  earnings: number;
  hype_score: number;
  created_at: string;
  songs?: {
    title: string;
  };
}

// Production progress component
const ProductionProgress = ({ video }: { video: MusicVideo }) => {
  const createdAt = new Date(video.created_at);
  const now = new Date();
  const hoursElapsed = differenceInHours(now, createdAt);
  
  // Production time based on budget
  let requiredHours = 48;
  if (video.budget >= 50000) requiredHours = 6;
  else if (video.budget >= 25000) requiredHours = 12;
  else if (video.budget >= 10000) requiredHours = 24;
  else if (video.budget >= 5000) requiredHours = 36;
  
  const progress = Math.min(100, (hoursElapsed / requiredHours) * 100);
  const hoursRemaining = Math.max(0, requiredHours - hoursElapsed);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Production Progress</span>
        <span className="font-medium">{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="text-xs text-muted-foreground">
        {hoursRemaining > 0 
          ? `~${hoursRemaining}h remaining`
          : "Ready for release!"}
      </div>
    </div>
  );
};

const MusicVideos = () => {
  const { profile } = useGameData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "my" | "trending">("all");
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  
  // Form state for new video
  const [selectedSong, setSelectedSong] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoBudget, setVideoBudget] = useState("5000");
  const [videoStyle, setVideoStyle] = useState("standard");

  // Fetch user's released songs
  const { data: releasedSongs = [] } = useQuery({
    queryKey: ["released-songs-for-videos", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      const { data: userReleases, error: releasesError } = await supabase
        .from("releases")
        .select("id, title")
        .eq("user_id", profile.id)
        .eq("release_status", "released");
      
      if (releasesError) throw releasesError;
      if (!userReleases || userReleases.length === 0) return [];

      const releaseIds = userReleases.map(r => r.id);

      const { data: releaseSongs, error: rsError } = await supabase
        .from("release_songs")
        .select("song_id, release_id")
        .in("release_id", releaseIds);

      if (rsError) throw rsError;
      if (!releaseSongs || releaseSongs.length === 0) return [];

      const songIds = [...new Set(releaseSongs.map(rs => rs.song_id))];

      const { data: songs, error: songsError } = await supabase
        .from("songs")
        .select("id, title")
        .in("id", songIds);

      if (songsError) throw songsError;

      return songs?.map((song: any) => {
        const rs = releaseSongs.find(rs => rs.song_id === song.id);
        const release = userReleases.find(r => r.id === rs?.release_id);
        return {
          ...song,
          release_id: rs?.release_id,
          release_title: release?.title,
        };
      }) || [];
    },
    enabled: !!profile?.id,
  });

  // Fetch music videos with song audio data
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["music-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("music_videos")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Fetch song data separately
      const songIds = data?.map(v => v.song_id).filter(Boolean) || [];
      if (songIds.length === 0) return (data || []) as MusicVideo[];
      
      const { data: songs } = await supabase
        .from("songs")
        .select("id, title, audio_url, audio_generation_status")
        .in("id", songIds);
      
      return (data || []).map(video => ({
        ...video,
        songs: songs?.find(s => s.id === video.song_id) || null,
      })) as (MusicVideo & { songs: { title: string; audio_url?: string; audio_generation_status?: string } | null })[];
    },
  });

  // Selected video for analytics
  const [selectedVideoForAnalytics, setSelectedVideoForAnalytics] = useState<MusicVideo | null>(null);

  // Fetch my videos
  const myVideos = videos.filter(v => 
    releasedSongs.some((s: any) => s.id === v.song_id)
  );

  // Fetch trending videos
  const trendingVideos = [...videos]
    .sort((a, b) => b.hype_score - a.hype_score)
    .slice(0, 10);

  // Create music video mutation
  const createVideoMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id || !selectedSong) throw new Error("Missing required data");
      
      const budget = parseInt(videoBudget);
      
      // Check if user has enough money
      if (profile.cash < budget) {
        throw new Error("Insufficient funds");
      }

      // Deduct budget from user's cash
      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: profile.cash - budget })
        .eq("id", profile.id);

      if (cashError) throw cashError;

      // Determine quality based on budget and style
      let qualityScore = Math.min(100, (budget / 100) + 20);
      if (videoStyle === "premium") qualityScore += 20;
      if (videoStyle === "deluxe") qualityScore += 40;

      // Get release_id for the selected song
      const song = releasedSongs.find((s: any) => s.id === selectedSong);
      
      // Create video
      const { data, error } = await supabase
        .from("music_videos")
        .insert({
          song_id: selectedSong,
          release_id: song?.release_id,
          title: videoTitle,
          description: videoDescription || null,
          budget,
          production_quality: Math.min(100, qualityScore),
          status: "production",
          views_count: 0,
          earnings: 0,
          hype_score: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["music-videos"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      toast({
        title: "Music Video Started",
        description: "Your music video production has begun!",
      });
      setRecordDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Release video mutation
  const releaseVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase
        .from("music_videos")
        .update({
          status: "released",
          release_date: new Date().toISOString(),
          hype_score: Math.floor(Math.random() * 50) + 30, // Initial hype
        })
        .eq("id", videoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["music-videos"] });
      toast({
        title: "Released to PooTube!",
        description: "Your music video is now live and generating views!",
      });
    },
  });

  const resetForm = () => {
    setSelectedSong("");
    setVideoTitle("");
    setVideoDescription("");
    setVideoBudget("5000");
    setVideoStyle("standard");
  };

  const displayVideos = 
    activeTab === "my" ? myVideos :
    activeTab === "trending" ? trendingVideos :
    videos;

  const budgetOptions = [
    { value: "2500", label: "$2,500 - Basic" },
    { value: "5000", label: "$5,000 - Standard" },
    { value: "10000", label: "$10,000 - Professional" },
    { value: "25000", label: "$25,000 - Premium" },
    { value: "50000", label: "$50,000 - Deluxe" },
  ];

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">PooTube Music Videos</h1>
          <p className="text-muted-foreground">Create, release, and track your music video success</p>
        </div>
        <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Record New Video
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Record Music Video</DialogTitle>
              <DialogDescription>
                Create a music video for one of your songs. Higher budgets lead to better production quality.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {releasedSongs.length === 0 ? (
                <div className="text-center py-8">
                  <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="font-semibold mb-2">No Released Music Yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    You need to create and release music in Release Manager first
                  </p>
                  <Button variant="outline" onClick={() => window.location.href = "/releases"}>
                    Go to Release Manager
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="song">Select Song</Label>
                    <Select value={selectedSong} onValueChange={setSelectedSong}>
                      <SelectTrigger id="song">
                        <SelectValue placeholder="Choose a released song..." />
                      </SelectTrigger>
                      <SelectContent>
                        {releasedSongs.map((song: any) => (
                          <SelectItem key={song.id} value={song.id}>
                            {song.title} ({song.release_title})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="title">Video Title</Label>
                    <Input
                      id="title"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      placeholder="Enter video title..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      value={videoDescription}
                      onChange={(e) => setVideoDescription(e.target.value)}
                      placeholder="Describe your music video concept..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="budget">Production Budget</Label>
                    <Select value={videoBudget} onValueChange={setVideoBudget}>
                      <SelectTrigger id="budget">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {budgetOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="style">Production Style</Label>
                    <Select value={videoStyle} onValueChange={setVideoStyle}>
                      <SelectTrigger id="style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="premium">Premium (+20% Quality)</SelectItem>
                        <SelectItem value="deluxe">Deluxe (+40% Quality)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setRecordDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => createVideoMutation.mutate()}
                      disabled={!selectedSong || !videoTitle || createVideoMutation.isPending}
                    >
                      {createVideoMutation.isPending ? "Creating..." : "Start Production"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Videos</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myVideos.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {myVideos.reduce((sum, v) => sum + v.views_count, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${myVideos.reduce((sum, v) => sum + v.earnings, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Hype Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {myVideos.length > 0 
                ? Math.round(myVideos.reduce((sum, v) => sum + v.hype_score, 0) / myVideos.length)
                : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Videos List */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all">All Videos</TabsTrigger>
          <TabsTrigger value="my">My Videos</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                Loading videos...
              </CardContent>
            </Card>
          ) : displayVideos.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                {activeTab === "my" 
                  ? "You haven't created any music videos yet. Click 'Record New Video' to get started!"
                  : "No videos found."}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayVideos.map((video) => (
                <Card key={video.id} className="overflow-hidden">
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <Film className="h-16 w-16 text-muted-foreground/50" />
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{video.title}</CardTitle>
                        <CardDescription className="truncate">
                          {video.songs?.title || "Unknown Song"}
                        </CardDescription>
                      </div>
                      <Badge variant={
                        video.status === "released" ? "default" :
                        video.status === "production" ? "secondary" :
                        "outline"
                      }>
                        {video.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Quality</span>
                        <span className="font-medium">{video.production_quality}%</span>
                      </div>
                      <Progress value={video.production_quality} />
                    </div>

                    {video.status === "released" && (
                      <>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Eye className="h-3 w-3" />
                              Views
                            </div>
                            <div className="font-semibold">{video.views_count.toLocaleString()}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <DollarSign className="h-3 w-3" />
                              Earned
                            </div>
                            <div className="font-semibold">${video.earnings.toLocaleString()}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <TrendingUp className="h-3 w-3" />
                            Hype
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                            <span className="font-semibold">{video.hype_score}</span>
                          </div>
                        </div>

                        {video.release_date && (
                          <div className="text-xs text-muted-foreground">
                            Released {formatDistanceToNow(new Date(video.release_date), { addSuffix: true })}
                          </div>
                        )}
                      </>
                    )}

                    {video.status === "production" && (
                      <div className="space-y-3">
                        <ProductionProgress video={video} />
                        {releasedSongs.some((s: any) => s.id === video.song_id) && (
                          <Button 
                            className="w-full"
                            variant="secondary"
                            disabled
                          >
                            <Clock className="mr-2 h-4 w-4 animate-spin" />
                            In Production...
                          </Button>
                        )}
                      </div>
                    )}

                    {video.status === "released" && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Tv className="mr-2 h-3 w-3" />
                          TV Shows
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Users className="mr-2 h-3 w-3" />
                          Promote
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MusicVideos;
