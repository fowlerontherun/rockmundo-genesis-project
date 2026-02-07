import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, TrendingUp, Users, Clock, Music, Flame, ImageOff } from "lucide-react";
import { DikCokEngagement } from "./DikCokEngagement";
import { formatDistanceToNow } from "date-fns";

interface DikCokVideoDetailProps {
  video: {
    id: string;
    title: string;
    description?: string;
    views: number;
    hype_gained: number;
    fan_gain: number;
    trending_tag?: string;
    engagement_velocity?: string;
    created_at?: string;
    thumbnail_url?: string;
    band?: {
      name: string;
      genre?: string;
    };
    video_type?: {
      name: string;
      category: string;
      difficulty?: string;
    };
    track?: {
      title: string;
    };
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DikCokVideoDetail = ({ video, open, onOpenChange }: DikCokVideoDetailProps) => {
  if (!video) return null;

  const velocityColors = {
    Exploding: "bg-red-500 text-white",
    Trending: "bg-orange-500 text-white",
    Stable: "bg-blue-500 text-white",
    Niche: "bg-gray-500 text-white",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {video.title}
            {video.engagement_velocity && (
              <Badge className={velocityColors[video.engagement_velocity as keyof typeof velocityColors] || ""}>
                {video.engagement_velocity}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Video Preview with Thumbnail */}
          <div className="aspect-video rounded-lg relative overflow-hidden">
            {video.thumbnail_url ? (
              <img
                src={video.thumbnail_url}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <ImageOff className="h-16 w-16 text-muted-foreground/30" />
              </div>
            )}
            {video.trending_tag && (
              <Badge className="absolute top-3 left-3 bg-accent">#{video.trending_tag}</Badge>
            )}
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center shadow-lg">
                <div className="ml-1.5 w-0 h-0 border-l-[20px] border-l-primary border-y-[12px] border-y-transparent" />
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <Eye className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-bold">{video.views.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Views</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Flame className="h-5 w-5 mx-auto mb-1 text-destructive" />
                <p className="text-lg font-bold">{video.hype_gained}</p>
                <p className="text-xs text-muted-foreground">Hype</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-accent-foreground" />
                <p className="text-lg font-bold">+{video.fan_gain}</p>
                <p className="text-xs text-muted-foreground">Fans</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{video.video_type?.difficulty || "Easy"}</p>
                <p className="text-xs text-muted-foreground">Difficulty</p>
              </CardContent>
            </Card>
          </div>

          {/* Video Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{video.band?.name}</span>
              {video.band?.genre && (
                <Badge variant="outline">{video.band.genre}</Badge>
              )}
            </div>

            {video.description && (
              <p className="text-muted-foreground">{video.description}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {video.video_type && (
                <Badge variant="secondary">
                  <Music className="h-3 w-3 mr-1" />
                  {video.video_type.name}
                </Badge>
              )}
              {video.video_type?.category && (
                <Badge variant="outline">{video.video_type.category}</Badge>
              )}
              {video.track && (
                <Badge variant="outline">
                  <Music className="h-3 w-3 mr-1" />
                  {video.track.title}
                </Badge>
              )}
            </div>

            {video.created_at && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Posted {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
              </p>
            )}
          </div>

          {/* Engagement Section */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-3">Engagement</h4>
            <DikCokEngagement videoId={video.id} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};