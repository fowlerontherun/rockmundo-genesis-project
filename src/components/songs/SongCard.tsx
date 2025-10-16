import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Music, Info, ListPlus, Clock } from "lucide-react";

interface SongCardProps {
  song: {
    id: string;
    title: string;
    genre: string;
    quality_score: number;
    created_at: string;
    duration_display?: string;
    catalog_status?: string;
    bands?: {
      name: string;
    } | null;
  };
  onViewDetails: (songId: string) => void;
}

export const SongCard = ({ song, onViewDetails }: SongCardProps) => {
  const getQualityColor = (quality: number) => {
    if (quality >= 1500) return "bg-purple-500/10 text-purple-500 border-purple-500/20";
    if (quality >= 1000) return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    if (quality >= 500) return "bg-green-500/10 text-green-500 border-green-500/20";
    return "bg-amber-500/10 text-amber-500 border-amber-500/20";
  };

  const getQualityLabel = (quality: number) => {
    if (quality >= 1500) return "Exceptional";
    if (quality >= 1000) return "High";
    if (quality >= 500) return "Medium";
    return "Low";
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate">{song.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {song.bands?.name || "Solo Artist"}
            </p>
          </div>
          <Music className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{song.genre}</Badge>
          <Badge className={getQualityColor(song.quality_score)}>
            {getQualityLabel(song.quality_score)} ({song.quality_score})
          </Badge>
          {song.catalog_status && (
            <Badge variant="secondary">{song.catalog_status}</Badge>
          )}
        </div>

        {song.duration_display && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{song.duration_display}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onViewDetails(song.id)}
          >
            <Info className="mr-2 h-4 w-4" />
            Details
          </Button>
          <Button variant="outline" size="sm">
            <ListPlus className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Created {new Date(song.created_at).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
};
