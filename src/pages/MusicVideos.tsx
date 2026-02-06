import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useGameData } from "@/hooks/useGameData";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, TrendingUp, Eye, DollarSign, Video, Film, Tv, Plus, Calendar, Star, Users, Clock, BarChart3, Music, Megaphone, Trophy, Rocket, Share2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { SongPlayer } from "@/components/audio/SongPlayer";
import { VideoAnalytics } from "@/components/videos/VideoAnalytics";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VipVideoCreationDialog } from "@/components/music-video/VipVideoCreationDialog";
import { MusicVideoViewerDialog } from "@/components/music-video/MusicVideoViewerDialog";

interface MusicVideo {
  id: string;
  song_id: string;
  title: string;
  description: string | null;
  video_url?: string | null;
  budget: number;
  production_quality: number;
  director_id: string | null;
  status: "planning" | "production" | "released" | "generating" | "failed";
  release_date: string | null;
  views_count: number;
  earnings: number;
  hype_score: number;
  created_at: string;
  generation_started_at?: string | null;
  generation_completed_at?: string | null;
  generation_error?: string | null;
  songs?: {
    title: string;
    audio_url?: string;
    audio_generation_status?: string;
  } | null;
}

// TV Shows for placement
const TV_SHOWS = [
  { id: "mtv_rotation", name: "MTV Rotation", cost: 5000, viewBoost: 10000, hypeBoost: 15, fameRequired: 100 },
  { id: "mtv_trl", name: "MTV TRL", cost: 15000, viewBoost: 50000, hypeBoost: 35, fameRequired: 500 },
  { id: "vh1_top20", name: "VH1 Top 20", cost: 8000, viewBoost: 20000, hypeBoost: 20, fameRequired: 200 },
  { id: "bet_106", name: "BET 106 & Park", cost: 12000, viewBoost: 35000, hypeBoost: 28, fameRequired: 300 },
  { id: "fuse_daily", name: "Fuse Daily", cost: 3000, viewBoost: 5000, hypeBoost: 8, fameRequired: 50 },
  { id: "late_night", name: "Late Night Show", cost: 25000, viewBoost: 100000, hypeBoost: 50, fameRequired: 1000 },
];

// Promotion options
const PROMO_OPTIONS = [
  { id: "social_ads", name: "Social Media Ads", cost: 2000, viewBoost: 5000, description: "Targeted ads on Twaater and DikCok" },
  { id: "influencer", name: "Influencer Campaign", cost: 10000, viewBoost: 25000, description: "Popular creators share your video" },
  { id: "billboard", name: "Digital Billboard", cost: 15000, viewBoost: 15000, description: "Times Square digital display" },
  { id: "radio_push", name: "Radio Push", cost: 5000, viewBoost: 8000, description: "DJ mentions and plays" },
  { id: "press_release", name: "Press Release", cost: 1000, viewBoost: 2000, description: "Coverage on music blogs" },
];

// Production progress component
const ProductionProgress = ({ video }: { video: MusicVideo }) => {
  const createdAt = new Date(video.created_at);
  const now = new Date();
  const hoursElapsed = differenceInHours(now, createdAt);

  let requiredHours = 48;
  if (video.budget >= 50000) requiredHours = 6;
  else if (video.budget >= 25000) requiredHours = 12;
  else if (video.budget >= 10000) requiredHours = 24;
  else if (video.budget >= 5000) requiredHours = 36;

  const progress = Math.min(100, (hoursElapsed / requiredHours) * 100);
  const hoursRemaining = Math.max(0, requiredHours - hoursElapsed);
  const isComplete = progress >= 100;

  return {
    progress,
    hoursRemaining,
    isComplete,
    element: (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Production Progress</span>
          <span className="font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="text-xs text-muted-foreground">
          {hoursRemaining > 0 ? `~${hoursRemaining}h remaining` : "Ready for release!"}
        </div>
      </div>
    ),
  };
};

const MusicVideos = () => {
  const { profile } = useGameData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "my" | "trending">("all");
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [tvShowsDialogOpen, setTvShowsDialogOpen] = useState(false);
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [analyticsDialogOpen, setAnalyticsDialogOpen] = useState(false);
  const [viewerDialogOpen, setViewerDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<MusicVideo | null>(null);

  // Form state for new video
  const [selectedSong, setSelectedSong] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoBudget, setVideoBudget] = useState("5000");
  const [videoStyle, setVideoStyle] = useState("standard");

  // Fetch user's recorded songs (from releases OR directly recorded)
  const { data: releasedSongs = [], isLoading: songsLoading } = useQuery({
    queryKey: ["songs-for-videos", profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      
      // First get user's band IDs - don't filter by member_status to include all bands
      const { data: userBands, error: bandsError } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", profile.user_id);
      
      if (bandsError) {
        console.error("Error fetching user bands:", bandsError);
      }
      
      const bandIds = userBands?.map(b => b.band_id) || [];
      console.log("🎬 Music Video - User bands:", bandIds.length, bandIds);
      
      // Get all recorded songs from user's bands
      let recordedSongs: any[] = [];
      if (bandIds.length > 0) {
        const { data: bandSongs, error: songsError } = await supabase
          .from("songs")
          .select("id, title, band_id, status")
          .in("band_id", bandIds)
          .eq("status", "recorded");
        
        if (songsError) {
          console.error("Error fetching recorded songs:", songsError);
        } else {
          recordedSongs = bandSongs || [];
          console.log("🎬 Music Video - Found recorded songs:", recordedSongs.length);
        }
      }
      
      // Also get songs directly owned by user (solo artist songs)
      const { data: userOwnedSongs, error: userSongsError } = await supabase
        .from("songs")
        .select("id, title, band_id, status")
        .eq("user_id", profile.user_id)
        .eq("status", "recorded");
      
      if (userSongsError) {
        console.error("Error fetching user-owned songs:", userSongsError);
      } else {
        console.log("🎬 Music Video - Found user-owned songs:", userOwnedSongs?.length || 0);
      }
      
      // Merge both sources, avoiding duplicates
      const songMap = new Map<string, any>();
      
      for (const song of recordedSongs) {
        songMap.set(song.id, {
          ...song,
          release_id: null,
          release_title: "Recorded",
        });
      }
      
      for (const song of (userOwnedSongs || [])) {
        if (!songMap.has(song.id)) {
          songMap.set(song.id, {
            ...song,
            release_id: null,
            release_title: "Recorded",
          });
        }
      }
      
      // Also check for songs from released releases as additional source
      const { data: userReleases } = await supabase
        .from("releases")
        .select("id, title")
        .eq("user_id", profile.user_id)
        .eq("release_status", "released");

      if (userReleases && userReleases.length > 0) {
        const releaseIds = userReleases.map((r) => r.id);
        const { data: releaseSongs } = await supabase
          .from("release_songs")
          .select("song_id, release_id, songs(id, title, band_id, status)")
          .in("release_id", releaseIds);
        
        for (const rs of (releaseSongs || [])) {
          const song = rs.songs as any;
          if (song && !songMap.has(song.id)) {
            const release = userReleases.find(r => r.id === (rs as any).release_id);
            songMap.set(song.id, {
              ...song,
              release_id: release?.id || null,
              release_title: release?.title || "Released",
            });
          }
        }
      }
      
      const result = Array.from(songMap.values());
      console.log("🎬 Music Video - Total available songs:", result.length);
      return result;
    },
    enabled: !!profile?.user_id,
  });

  // Fetch music videos with song audio data
  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["music-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("music_videos")
        .select("*, generation_started_at, generation_completed_at, generation_error")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const songIds = data?.map((v) => v.song_id).filter(Boolean) || [];
      if (songIds.length === 0) return (data || []) as MusicVideo[];

      const { data: songs } = await supabase
        .from("songs")
        .select("id, title, audio_url, audio_generation_status")
        .in("id", songIds);

      return (data || []).map((video) => ({
        ...video,
        songs: songs?.find((s) => s.id === video.song_id) || null,
      })) as MusicVideo[];
    },
    // Auto-refetch every 10 seconds if there are videos being generated
    refetchInterval: (data) => {
      const hasGenerating = data?.state?.data?.some((v: MusicVideo) => v.status === "generating");
      return hasGenerating ? 10 * 1000 : false;
    },
  });

  // Fetch my videos
  const myVideos = videos.filter((v) => releasedSongs.some((s: any) => s.id === v.song_id));

  // Fetch trending videos
  const trendingVideos = [...videos].sort((a, b) => b.hype_score - a.hype_score).slice(0, 10);

  // Create music video mutation
  const createVideoMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.id || !selectedSong) throw new Error("Missing required data");
      const budget = parseInt(videoBudget);

      if (profile.cash < budget) {
        throw new Error("Insufficient funds");
      }

      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: profile.cash - budget })
        .eq("id", profile.id);
      if (cashError) throw cashError;

      let qualityScore = Math.min(100, budget / 100 + 20);
      if (videoStyle === "premium") qualityScore += 20;
      if (videoStyle === "deluxe") qualityScore += 40;

      const song = releasedSongs.find((s: any) => s.id === selectedSong);

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
          hype_score: Math.floor(Math.random() * 50) + 30,
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

  // TV Show placement mutation
  const placeTvShowMutation = useMutation({
    mutationFn: async ({ videoId, showId }: { videoId: string; showId: string }) => {
      if (!profile?.id) throw new Error("Not logged in");
      
      const show = TV_SHOWS.find((s) => s.id === showId);
      if (!show) throw new Error("Invalid show");

      if (profile.cash < show.cost) {
        throw new Error("Insufficient funds");
      }

      // Deduct cost
      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: profile.cash - show.cost })
        .eq("id", profile.id);
      if (cashError) throw cashError;

      // Update video stats
      const video = videos.find((v) => v.id === videoId);
      if (!video) throw new Error("Video not found");

      const { error } = await supabase
        .from("music_videos")
        .update({
          views_count: video.views_count + show.viewBoost,
          hype_score: Math.min(100, video.hype_score + show.hypeBoost),
        })
        .eq("id", videoId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const show = TV_SHOWS.find((s) => s.id === variables.showId);
      queryClient.invalidateQueries({ queryKey: ["music-videos"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      toast({
        title: `Placed on ${show?.name}!`,
        description: `+${show?.viewBoost.toLocaleString()} views, +${show?.hypeBoost} hype`,
      });
      setTvShowsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Placement Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Promote video mutation
  const promoteVideoMutation = useMutation({
    mutationFn: async ({ videoId, promoId }: { videoId: string; promoId: string }) => {
      if (!profile?.id) throw new Error("Not logged in");
      
      const promo = PROMO_OPTIONS.find((p) => p.id === promoId);
      if (!promo) throw new Error("Invalid promotion");

      if (profile.cash < promo.cost) {
        throw new Error("Insufficient funds");
      }

      const { error: cashError } = await supabase
        .from("profiles")
        .update({ cash: profile.cash - promo.cost })
        .eq("id", profile.id);
      if (cashError) throw cashError;

      const video = videos.find((v) => v.id === videoId);
      if (!video) throw new Error("Video not found");

      const { error } = await supabase
        .from("music_videos")
        .update({
          views_count: video.views_count + promo.viewBoost,
          earnings: video.earnings + Math.floor(promo.viewBoost * 0.002),
        })
        .eq("id", videoId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const promo = PROMO_OPTIONS.find((p) => p.id === variables.promoId);
      queryClient.invalidateQueries({ queryKey: ["music-videos"] });
      queryClient.invalidateQueries({ queryKey: ["game-data"] });
      toast({
        title: `Promotion Active!`,
        description: `${promo?.name} will boost your video by +${promo?.viewBoost.toLocaleString()} views`,
      });
      setPromoteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Promotion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Generate AI video for existing music video
  const generateAiVideoMutation = useMutation({
    mutationFn: async (video: MusicVideo) => {
      if (!profile?.is_vip) throw new Error("VIP subscription required");
      
      // Parse existing metadata
      let metadata: any = {};
      try {
        metadata = video.description ? JSON.parse(video.description) : {};
      } catch {
        metadata = {};
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke('generate-music-video', {
        body: {
          videoId: video.id,
          songTitle: video.songs?.title || video.title,
          visualTheme: metadata.visual_theme || "cinematic",
          artStyle: metadata.art_style || "professional",
          sceneDescriptions: metadata.scene_descriptions || [
            "Performance footage with dramatic lighting",
            "Dynamic camera movements",
            "High energy concert visuals"
          ],
          mood: metadata.mood || "energetic",
          songAudioUrl: video.songs?.audio_url,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["music-videos"] });
      toast({
        title: "🎬 AI Video Generation Started!",
        description: data?.estimatedTime 
          ? `Your video is being generated. This typically takes ${data.estimatedTime}.` 
          : "Your video is being generated. This typically takes 2-5 minutes.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate video",
        variant: "destructive",
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

  const displayVideos = activeTab === "my" ? myVideos : activeTab === "trending" ? trendingVideos : videos;

  const budgetOptions = [
    { value: "2500", label: "$2,500 - Basic" },
    { value: "5000", label: "$5,000 - Standard" },
    { value: "10000", label: "$10,000 - Professional" },
    { value: "25000", label: "$25,000 - Premium" },
    { value: "50000", label: "$50,000 - Deluxe" },
  ];

  const openTvShows = (video: MusicVideo) => {
    setSelectedVideo(video);
    setTvShowsDialogOpen(true);
  };

  const openPromote = (video: MusicVideo) => {
    setSelectedVideo(video);
    setPromoteDialogOpen(true);
  };

  const openAnalytics = (video: MusicVideo) => {
    setSelectedVideo(video);
    setAnalyticsDialogOpen(true);
  };

  const openViewer = (video: MusicVideo) => {
    setSelectedVideo(video);
    setViewerDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Music Videos</h1>
          <p className="text-muted-foreground">Create, release, and track your music video success</p>
        </div>
        <div className="flex items-center gap-2">
          {/* VIP AI Video Generator */}
          <VipVideoCreationDialog
            songs={releasedSongs}
            isVip={profile?.is_vip || false}
            profileCash={profile?.cash || 0}
          />
          
          {/* Standard video creation */}
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
              {songsLoading ? (
                <div className="text-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Loading your songs...</p>
                </div>
              ) : releasedSongs.length === 0 ? (
                <div className="text-center py-8">
                  <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="font-semibold mb-2">No Recorded Songs Found</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    You need to record songs in the Recording Studio first. 
                    Any song with status "recorded" can be used for music videos.
                  </p>
                  <Button variant="outline" onClick={() => (window.location.href = "/recording-studio")}>
                    Go to Recording Studio
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
            <div className="text-2xl font-bold">{myVideos.reduce((sum, v) => sum + v.views_count, 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${myVideos.reduce((sum, v) => sum + v.earnings, 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Hype Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {myVideos.length > 0 ? Math.round(myVideos.reduce((sum, v) => sum + v.hype_score, 0) / myVideos.length) : 0}
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
              <CardContent className="p-12 text-center text-muted-foreground">Loading videos...</CardContent>
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
              {displayVideos.map((video) => {
                const productionInfo = video.status === "production" ? ProductionProgress({ video }) : null;
                const isMyVideo = releasedSongs.some((s: any) => s.id === video.song_id);

                return (
                  <Card key={video.id} className="overflow-hidden">
                    <div 
                      className="aspect-video flex items-center justify-center cursor-pointer relative group overflow-hidden"
                      style={{
                        background: video.status === "released"
                          ? "linear-gradient(135deg, hsl(var(--primary) / 0.25) 0%, hsl(var(--secondary) / 0.15) 50%, hsl(var(--primary) / 0.1) 100%)"
                          : video.status === "production"
                          ? "linear-gradient(135deg, hsl(var(--secondary) / 0.2) 0%, hsl(var(--muted) / 0.3) 100%)"
                          : video.status === "generating"
                          ? "linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, hsl(280 50% 30% / 0.2) 100%)"
                          : "linear-gradient(135deg, hsl(var(--muted) / 0.3) 0%, hsl(var(--muted) / 0.2) 100%)",
                      }}
                      onClick={() => (video.status === "released" || video.status === "generating") && openViewer(video)}
                    >
                      {/* Decorative waveform lines */}
                      <div className="absolute inset-0 flex items-end justify-center gap-[2px] px-4 pb-3 opacity-30">
                        {Array.from({ length: 24 }).map((_, i) => (
                          <div
                            key={i}
                            className="w-1 rounded-t bg-primary/50"
                            style={{
                              height: `${15 + Math.sin(i * 0.5 + (video.hype_score || 0) * 0.1) * 25 + Math.random() * 10}%`,
                            }}
                          />
                        ))}
                      </div>
                      
                      {/* Center play icon */}
                      <div className="relative z-10 flex flex-col items-center gap-2">
                        {video.status === "released" ? (
                          <div className="w-14 h-14 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center backdrop-blur-sm group-hover:bg-primary/30 group-hover:scale-110 transition-all">
                            <Play className="h-7 w-7 text-primary fill-primary/30 ml-0.5" />
                          </div>
                        ) : video.status === "generating" ? (
                          <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center animate-pulse">
                            <Film className="h-7 w-7 text-primary/70" />
                          </div>
                        ) : video.status === "production" ? (
                          <div className="w-14 h-14 rounded-full bg-secondary/20 border border-secondary/30 flex items-center justify-center">
                            <Clock className="h-7 w-7 text-muted-foreground/70" />
                          </div>
                        ) : (
                          <Film className="h-12 w-12 text-muted-foreground/40" />
                        )}
                      </div>

                      {/* Views count overlay for released */}
                      {video.status === "released" && video.views_count > 0 && (
                        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded text-xs text-white/80 backdrop-blur-sm">
                          <Eye className="h-3 w-3" />
                          {video.views_count >= 1000000
                            ? `${(video.views_count / 1000000).toFixed(1)}M`
                            : video.views_count >= 1000
                            ? `${(video.views_count / 1000).toFixed(0)}K`
                            : video.views_count}
                        </div>
                      )}

                      {/* Hover overlay */}
                      {video.status === "released" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{video.title}</CardTitle>
                          <CardDescription className="truncate">{video.songs?.title || "Unknown Song"}</CardDescription>
                        </div>
                        <Badge
                          variant={
                            video.status === "released" ? "default" : 
                            video.status === "production" ? "secondary" : 
                            video.status === "generating" ? "outline" :
                            video.status === "failed" ? "destructive" :
                            "outline"
                          }
                          className={video.status === "generating" ? "animate-pulse" : ""}
                        >
                          {video.status === "generating" ? "🎬 Generating..." : 
                           video.status === "failed" ? "⚠️ Failed" :
                           video.status}
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

                          {/* Song Preview */}
                          {video.songs?.audio_url && (
                            <div className="pt-2">
                              <SongPlayer
                                audioUrl={video.songs.audio_url}
                                title={video.songs.title}
                                compact
                              />
                            </div>
                          )}

                          {video.release_date && (
                            <div className="text-xs text-muted-foreground">
                              Released {formatDistanceToNow(new Date(video.release_date), { addSuffix: true })}
                            </div>
                          )}

                          {isMyVideo && (
                            <div className="flex gap-2 flex-wrap">
                              <Button size="sm" className="flex-1" onClick={() => openViewer(video)}>
                                <Play className="mr-2 h-3 w-3" />
                                Watch
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openAnalytics(video)}>
                                <BarChart3 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          
                          {isMyVideo && (
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="flex-1" onClick={() => openTvShows(video)}>
                                <Tv className="mr-2 h-3 w-3" />
                                TV Shows
                              </Button>
                              <Button variant="outline" size="sm" className="flex-1" onClick={() => openPromote(video)}>
                                <Megaphone className="mr-2 h-3 w-3" />
                                Promote
                              </Button>
                            </div>
                          )}

                          {/* Generate AI Video button for videos without video_url */}
                          {isMyVideo && profile?.is_vip && !video.video_url && (
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              className="w-full"
                              onClick={() => generateAiVideoMutation.mutate(video)}
                              disabled={generateAiVideoMutation.isPending}
                            >
                              <Film className="mr-2 h-3 w-3" />
                              {generateAiVideoMutation.isPending ? "Generating..." : "Generate AI Video"}
                            </Button>
                          )}

                          {/* Show badge if video already has AI video */}
                          {video.video_url && (
                            <Badge className="bg-primary/20 text-primary border-primary/30 w-full justify-center">
                              <Film className="mr-1 h-3 w-3" />
                              AI Video Ready
                            </Badge>
                          )}
                        </>
                      )}

                      {video.status === "generating" && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">AI Video Generating...</p>
                              <p className="text-xs text-muted-foreground">
                                This typically takes 2-5 minutes. The video will appear automatically.
                              </p>
                            </div>
                          </div>
                          {video.generation_started_at && (
                            <p className="text-xs text-muted-foreground text-center">
                              Started {formatDistanceToNow(new Date(video.generation_started_at), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      )}

                      {video.status === "failed" && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                            <p className="text-sm font-medium text-destructive">Video Generation Failed</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {video.generation_error || "An error occurred during generation. Your funds have been refunded."}
                            </p>
                          </div>
                          {isMyVideo && profile?.is_vip && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full"
                              onClick={() => generateAiVideoMutation.mutate(video)}
                              disabled={generateAiVideoMutation.isPending}
                            >
                              <Film className="mr-2 h-3 w-3" />
                              Retry AI Video Generation
                            </Button>
                          )}
                        </div>
                      )}

                      {video.status === "production" && productionInfo && (
                        <div className="space-y-3">
                          {productionInfo.element}
                          {isMyVideo && productionInfo.isComplete && (
                            <Button
                              className="w-full"
                              onClick={() => releaseVideoMutation.mutate(video.id)}
                              disabled={releaseVideoMutation.isPending}
                            >
                              <Rocket className="mr-2 h-4 w-4" />
                              {releaseVideoMutation.isPending ? "Releasing..." : "Release to PooTube!"}
                            </Button>
                          )}
                          {isMyVideo && !productionInfo.isComplete && (
                            <Button className="w-full" variant="secondary" disabled>
                              <Clock className="mr-2 h-4 w-4 animate-spin" />
                              In Production...
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* TV Shows Dialog */}
      <Dialog open={tvShowsDialogOpen} onOpenChange={setTvShowsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tv className="h-5 w-5" />
              TV Show Placement
            </DialogTitle>
            <DialogDescription>
              Get your video on TV to boost views and hype. Higher fame unlocks better shows.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3 pr-4">
              {TV_SHOWS.map((show) => {
                const canAfford = (profile?.cash || 0) >= show.cost;
                const hasFame = (profile?.fame || 0) >= show.fameRequired;
                const canBook = canAfford && hasFame;

                return (
                  <Card key={show.id} className={!canBook ? "opacity-50" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{show.name}</h4>
                          <div className="text-sm text-muted-foreground space-x-3">
                            <span className="text-green-500">+{show.viewBoost.toLocaleString()} views</span>
                            <span className="text-orange-500">+{show.hypeBoost} hype</span>
                          </div>
                          {!hasFame && (
                            <p className="text-xs text-destructive mt-1">Requires {show.fameRequired} fame</p>
                          )}
                        </div>
                        <div className="text-right">
                          <Button
                            size="sm"
                            disabled={!canBook || placeTvShowMutation.isPending}
                            onClick={() => selectedVideo && placeTvShowMutation.mutate({ videoId: selectedVideo.id, showId: show.id })}
                          >
                            ${show.cost.toLocaleString()}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Promote Dialog */}
      <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Promote Video
            </DialogTitle>
            <DialogDescription>Boost your video with paid promotion campaigns.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3 pr-4">
              {PROMO_OPTIONS.map((promo) => {
                const canAfford = (profile?.cash || 0) >= promo.cost;

                return (
                  <Card key={promo.id} className={!canAfford ? "opacity-50" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">{promo.name}</h4>
                          <p className="text-xs text-muted-foreground">{promo.description}</p>
                          <span className="text-sm text-green-500">+{promo.viewBoost.toLocaleString()} views</span>
                        </div>
                        <div className="text-right">
                          <Button
                            size="sm"
                            disabled={!canAfford || promoteVideoMutation.isPending}
                            onClick={() => selectedVideo && promoteVideoMutation.mutate({ videoId: selectedVideo.id, promoId: promo.id })}
                          >
                            ${promo.cost.toLocaleString()}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={analyticsDialogOpen} onOpenChange={setAnalyticsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Video Analytics: {selectedVideo?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <VideoAnalytics
              video={{
                id: selectedVideo.id,
                title: selectedVideo.title,
                views_count: selectedVideo.views_count,
                earnings: selectedVideo.earnings,
                hype_score: selectedVideo.hype_score,
                production_quality: selectedVideo.production_quality,
                budget: selectedVideo.budget,
                status: selectedVideo.status,
                release_date: selectedVideo.release_date,
                created_at: selectedVideo.created_at,
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Music Video Viewer Dialog */}
      <MusicVideoViewerDialog
        video={selectedVideo}
        open={viewerDialogOpen}
        onOpenChange={setViewerDialogOpen}
        onViewLogged={() => {
          // Increment view count when watched for 10+ seconds
          if (selectedVideo) {
            supabase
              .from("music_videos")
              .update({ views_count: selectedVideo.views_count + 1 })
              .eq("id", selectedVideo.id)
              .then(() => queryClient.invalidateQueries({ queryKey: ["music-videos"] }));
          }
        }}
      />
    </div>
  );
};

export default MusicVideos;
