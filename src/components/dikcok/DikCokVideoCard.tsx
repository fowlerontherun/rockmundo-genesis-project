import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, TrendingUp, Users, ImageOff } from "lucide-react";
import { motion } from "framer-motion";

interface DikCokVideoCardProps {
  video: {
    id: string;
    title: string;
    description?: string;
    views: number;
    hype_gained: number;
    fan_gain: number;
    trending_tag?: string;
    engagement_velocity?: string;
    thumbnail_url?: string;
    band?: {
      name: string;
      genre?: string;
    };
    video_type?: {
      name: string;
      category: string;
    };
  };
  onView?: (id: string) => void;
}

export const DikCokVideoCard = ({ video, onView }: DikCokVideoCardProps) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onView?.(video.id)}
      className="cursor-pointer"
    >
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <div className="aspect-[9/16] relative overflow-hidden">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <ImageOff className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
          
          {/* Overlay badges */}
          {video.trending_tag && (
            <Badge className="absolute top-2 left-2 bg-accent">
              #{video.trending_tag}
            </Badge>
          )}
          {video.engagement_velocity === "Exploding" && (
            <Badge className="absolute top-2 right-2 bg-destructive">
              🔥 Viral
            </Badge>
          )}
          
          {/* Play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
              <div className="ml-1 w-0 h-0 border-l-[16px] border-l-primary border-y-[10px] border-y-transparent" />
            </div>
          </div>
        </div>
        <CardContent className="p-3 space-y-2">
          <div>
            <h3 className="font-semibold line-clamp-1">{video.title}</h3>
            <p className="text-sm text-muted-foreground">{video.band?.name}</p>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>{video.views.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>{video.hype_gained}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>+{video.fan_gain}</span>
            </div>
          </div>

          <div className="flex gap-1">
            <Badge variant="outline" className="text-xs">
              {video.video_type?.name}
            </Badge>
            {video.video_type?.category && (
              <Badge variant="secondary" className="text-xs">
                {video.video_type.category}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};