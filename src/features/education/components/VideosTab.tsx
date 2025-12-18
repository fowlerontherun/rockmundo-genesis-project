import { useState, useEffect } from "react";
import { Loader2, Play, Clock, Leaf } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { useEducationVideoPlaylists } from "../hooks/useEducationVideoPlaylists";
import { useWatchVideo, getCooldownStatus } from "../hooks/useWatchVideo";

export const VideosTab = () => {
  const {
    data,
    isLoading,
    isError,
    error,
  } = useEducationVideoPlaylists();
  const watchVideo = useWatchVideo();

  const [cooldownStatus, setCooldownStatus] = useState(getCooldownStatus());

  // Refresh cooldown status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldownStatus(getCooldownStatus());
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Refresh after watching
  useEffect(() => {
    if (watchVideo.isSuccess) {
      setCooldownStatus(getCooldownStatus());
    }
  }, [watchVideo.isSuccess]);

  const playlists = data ?? [];
  const errorMessage =
    error instanceof Error
      ? error.message
      : error
        ? "We couldn't load playlists. Please try again later."
        : "";

  const handleWatch = (videoId: string, videoName: string, category: string | null) => {
    watchVideo.mutate({
      videoId,
      videoName,
      skillSlug: category,
    });
  };

  const formatTimeRemaining = () => {
    if (!cooldownStatus.cooldownEndsAt) return "";
    const minutes = Math.ceil(
      (cooldownStatus.cooldownEndsAt.getTime() - Date.now()) / 60000
    );
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Learn From Videos</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Watch educational content to earn XP and improve your skills. Limit: 2 videos every 2 hours.
        </p>
      </div>

      {/* Cooldown Status */}
      <div className="flex items-center gap-4 p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            Videos Watched: {cooldownStatus.videosWatched}/{cooldownStatus.maxVideos}
          </span>
        </div>
        {!cooldownStatus.canWatch && cooldownStatus.cooldownEndsAt && (
          <div className="flex items-center gap-2 text-warning">
            <Clock className="h-4 w-4" />
            <span className="text-sm">
              Available in {formatTimeRemaining()}
            </span>
          </div>
        )}
      </div>

      {/* Cooldown Message */}
      {!cooldownStatus.canWatch && (
        <Alert className="border-warning/50 bg-warning/10">
          <Leaf className="h-4 w-4 text-warning" />
          <AlertTitle className="text-warning">Time for a break!</AlertTitle>
          <AlertDescription className="text-warning/80">
            You've watched {cooldownStatus.maxVideos} videos recently. Go touch some grass, 
            practice your instrument, or grab a snack. Come back in {formatTimeRemaining()}!
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading videos...
          </div>
        ) : isError ? (
          <div className="col-span-full">
            <Alert variant="destructive">
              <AlertTitle>Unable to load videos</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          </div>
        ) : playlists.length === 0 ? (
          <div className="col-span-full rounded-lg border border-dashed bg-muted/40 p-6 text-sm text-muted-foreground">
            No videos are available yet. Check back later for new learning content.
          </div>
        ) : (
          playlists.map((playlist) => (
            <Card key={playlist.key} className="transition-all hover:border-primary/50 hover:shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{playlist.title}</CardTitle>
                <CardDescription className="leading-relaxed">{playlist.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {playlist.resources.map((resource) => (
                  <div key={resource.id} className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">{resource.name}</p>
                        <p className="text-xs text-muted-foreground">{resource.format}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {resource.focus}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{resource.summary}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-primary font-medium">+15 XP</span>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={!cooldownStatus.canWatch || watchVideo.isPending}
                        onClick={() => handleWatch(resource.id, resource.name, resource.format)}
                      >
                        {watchVideo.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Play className="h-4 w-4 mr-1" />
                        )}
                        Watch
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
