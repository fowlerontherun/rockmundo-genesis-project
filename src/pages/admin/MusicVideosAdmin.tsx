import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminRoute } from "@/components/AdminRoute";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Video, 
  RefreshCw, 
  Play, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileVideo,
  Eye,
  ExternalLink,
  Trash2,
  Wand2
} from "lucide-react";
import { format } from "date-fns";

interface MusicVideoAdmin {
  id: string;
  title: string;
  status: string;
  video_url: string | null;
  description: string | null;
  generation_started_at: string | null;
  generation_error: string | null;
  views_count: number;
  created_at: string;
  updated_at: string;
  song_id: string;
  songs?: {
    title: string;
    audio_url: string | null;
  } | null;
  bands?: {
    name: string;
  } | null;
}

const MusicVideosAdmin = () => {
  const queryClient = useQueryClient();
  const [selectedVideo, setSelectedVideo] = useState<MusicVideoAdmin | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch all music videos
  const { data: videos = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-music-videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("music_videos")
        .select(`
          id,
          title,
          status,
          video_url,
          description,
          generation_started_at,
          generation_error,
          views_count,
          created_at,
          updated_at,
          song_id,
          songs(title, audio_url)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as MusicVideoAdmin[];
    },
  });

  // Generate video for existing entry
  const generateVideoMutation = useMutation({
    mutationFn: async (video: MusicVideoAdmin) => {
      let metadata: any = {};
      try {
        metadata = video.description ? JSON.parse(video.description) : {};
      } catch {
        metadata = {};
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("generate-music-video", {
        body: {
          videoId: video.id,
          songTitle: video.songs?.title || video.title,
          visualTheme: metadata.visual_theme || "cinematic",
          artStyle: metadata.art_style || "professional",
          sceneDescriptions: metadata.scene_descriptions || [
            "Dynamic performance footage with dramatic lighting",
            "Close-up shots with artistic camera movements",
            "High energy concert visuals"
          ],
          mood: metadata.mood || "energetic",
          songAudioUrl: video.songs?.audio_url,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-music-videos"] });
      toast.success("Video generation initiated!");
    },
    onError: (error: any) => {
      toast.error(`Generation failed: ${error.message}`);
    },
  });

  // Reset stuck video status
  const resetStatusMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase
        .from("music_videos")
        .update({ 
          status: "production",
          generation_error: null,
        })
        .eq("id", videoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-music-videos"] });
      toast.success("Status reset to production");
    },
    onError: (error: any) => {
      toast.error(`Reset failed: ${error.message}`);
    },
  });

  // Clear video URL (for testing regeneration)
  const clearVideoUrlMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase
        .from("music_videos")
        .update({ video_url: null })
        .eq("id", videoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-music-videos"] });
      toast.success("Video URL cleared");
    },
    onError: (error: any) => {
      toast.error(`Clear failed: ${error.message}`);
    },
  });

  const getStatusBadge = (video: MusicVideoAdmin) => {
    if (video.video_url) {
      return (
        <Badge className="bg-green-600">
          <CheckCircle className="mr-1 h-3 w-3" />
          Video Ready
        </Badge>
      );
    }
    if (video.status === "generating") {
      return (
        <Badge className="bg-yellow-600">
          <Clock className="mr-1 h-3 w-3 animate-spin" />
          Generating
        </Badge>
      );
    }
    if (video.generation_error) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="mr-1 h-3 w-3" />
          Error
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        <FileVideo className="mr-1 h-3 w-3" />
        {video.status}
      </Badge>
    );
  };

  const parseMetadata = (description: string | null) => {
    if (!description) return null;
    try {
      return JSON.parse(description);
    } catch {
      return { raw: description };
    }
  };

  // Stats
  const totalVideos = videos.length;
  const withVideoUrl = videos.filter(v => v.video_url).length;
  const generating = videos.filter(v => v.status === "generating").length;
  const withErrors = videos.filter(v => v.generation_error).length;

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Music Videos Admin</h1>
            <p className="text-muted-foreground">Debug and manage AI-generated music videos</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Videos</CardDescription>
              <CardTitle className="text-3xl">{totalVideos}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>With AI Video</CardDescription>
              <CardTitle className="text-3xl text-green-600">{withVideoUrl}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Generating</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{generating}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>With Errors</CardDescription>
              <CardTitle className="text-3xl text-red-600">{withErrors}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Videos Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              All Music Videos
            </CardTitle>
            <CardDescription>
              Click on a row to view details and metadata
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Song</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Video URL</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : videos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No music videos found
                      </TableCell>
                    </TableRow>
                  ) : (
                    videos.map((video) => (
                      <TableRow 
                        key={video.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedVideo(video)}
                      >
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {video.title}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {video.songs?.title || "—"}
                        </TableCell>
                        <TableCell>{getStatusBadge(video)}</TableCell>
                        <TableCell>
                          {video.video_url ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewUrl(video.video_url);
                              }}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Preview
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">No video</span>
                          )}
                        </TableCell>
                        <TableCell>{video.views_count.toLocaleString()}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(video.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            {!video.video_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => generateVideoMutation.mutate(video)}
                                disabled={generateVideoMutation.isPending}
                              >
                                <Wand2 className="h-4 w-4" />
                              </Button>
                            )}
                            {video.status === "generating" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => resetStatusMutation.mutate(video.id)}
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            )}
                            {video.video_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => clearVideoUrlMutation.mutate(video.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Video Detail Dialog */}
        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedVideo?.title}</DialogTitle>
              <DialogDescription>
                Video ID: {selectedVideo?.id}
              </DialogDescription>
            </DialogHeader>
            
            {selectedVideo && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">{getStatusBadge(selectedVideo)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Song</label>
                    <p className="mt-1">{selectedVideo.songs?.title || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Views</label>
                    <p className="mt-1">{selectedVideo.views_count.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p className="mt-1">
                      {format(new Date(selectedVideo.created_at), "PPpp")}
                    </p>
                  </div>
                </div>

                {/* Video URL */}
                {selectedVideo.video_url && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Video URL</label>
                    <div className="mt-1 p-2 bg-muted rounded text-sm break-all">
                      <a 
                        href={selectedVideo.video_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {selectedVideo.video_url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Song Audio URL */}
                {selectedVideo.songs?.audio_url && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Song Audio URL</label>
                    <div className="mt-1 p-2 bg-muted rounded text-sm break-all">
                      <a 
                        href={selectedVideo.songs.audio_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {selectedVideo.songs.audio_url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Generation Error */}
                {selectedVideo.generation_error && (
                  <div>
                    <label className="text-sm font-medium text-destructive">Generation Error</label>
                    <div className="mt-1 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                      {selectedVideo.generation_error}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Metadata (Description)</label>
                  <pre className="mt-1 p-3 bg-muted rounded text-xs overflow-auto max-h-[200px]">
                    {JSON.stringify(parseMetadata(selectedVideo.description), null, 2)}
                  </pre>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  {!selectedVideo.video_url && (
                    <Button
                      onClick={() => generateVideoMutation.mutate(selectedVideo)}
                      disabled={generateVideoMutation.isPending}
                    >
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate AI Video
                    </Button>
                  )}
                  {selectedVideo.video_url && (
                    <>
                      <Button onClick={() => setPreviewUrl(selectedVideo.video_url)}>
                        <Play className="mr-2 h-4 w-4" />
                        Preview Video
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => clearVideoUrlMutation.mutate(selectedVideo.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear & Regenerate
                      </Button>
                    </>
                  )}
                  {selectedVideo.status === "generating" && (
                    <Button
                      variant="outline"
                      onClick={() => resetStatusMutation.mutate(selectedVideo.id)}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Reset Status
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Video Preview Dialog */}
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Video Preview</DialogTitle>
            </DialogHeader>
            {previewUrl && (
              <div className="aspect-video bg-black rounded overflow-hidden">
                <video
                  src={previewUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                  onError={(e) => {
                    console.error("Video playback error:", e);
                    toast.error("Failed to play video. The URL may be invalid or expired.");
                  }}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminRoute>
  );
};

export default MusicVideosAdmin;
