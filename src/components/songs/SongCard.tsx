import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Music, Info, ListPlus, Clock, Flame, Star } from "lucide-react";
import { SongRehearsalStatus } from "./SongRehearsalStatus";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SongCardProps {
  song: {
    id: string;
    title: string;
    genre: string;
    quality_score: number;
    created_at: string;
    duration_display?: string;
    duration_seconds?: number | null;
    catalog_status?: string;
    status?: string;
    user_id?: string;
    band_id?: string | null;
    hype?: number | null;
    fame?: number | null;
    bands?: {
      name: string;
    } | null;
  };
  onViewDetails: (songId: string) => void;
}

export const SongCard = ({ song, onViewDetails }: SongCardProps) => {
  const { data: userBand } = useQuery({
    queryKey: ["user-band", song.user_id],
    queryFn: async () => {
      if (!song.user_id) return null;
      const { data } = await supabase
        .from("band_members")
        .select("bands!band_members_band_id_fkey(id, name)")
        .eq("user_id", song.user_id)
        .maybeSingle();
      return data?.bands;
    },
    enabled: !!song.user_id,
  });

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "3:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
          {(song.hype ?? 0) > 0 && (
            <Badge variant="outline" className="gap-1 bg-orange-500/10 text-orange-500 border-orange-500/20">
              <Flame className="h-3 w-3" />
              {song.hype} Hype
            </Badge>
          )}
          {(song.fame ?? 0) > 0 && (
            <Badge variant="outline" className="gap-1 bg-purple-500/10 text-purple-500 border-purple-500/20">
              <Star className="h-3 w-3" />
              {song.fame} Fame
            </Badge>
          )}
          {song.status && (
            <Badge variant={song.status === "recorded" ? "default" : song.status === "draft" ? "secondary" : "outline"}>
              {song.status === "recorded" ? "Recorded" : song.status === "draft" ? "Draft" : song.status}
            </Badge>
          )}
          {song.catalog_status && (
            <Badge variant="secondary">{song.catalog_status}</Badge>
          )}
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {song.duration_display || formatDuration(song.duration_seconds)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <SongRehearsalStatus songId={song.id} bandId={song.band_id || userBand?.id} />
        </div>

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
