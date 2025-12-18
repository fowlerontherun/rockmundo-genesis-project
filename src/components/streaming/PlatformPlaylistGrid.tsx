import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListMusic, Users, Star, DollarSign } from "lucide-react";
import { useState } from "react";
import { GENRE_SELECT_OPTIONS } from "@/data/genres";

interface PlatformPlaylistGridProps {
  platformId: string;
  brandColor?: string;
  onSubmit?: (playlistId: string) => void;
}

const genres = [
  { value: "all", label: "All Genres" },
  ...GENRE_SELECT_OPTIONS,
];

export function PlatformPlaylistGrid({ platformId, brandColor = "#6366f1", onSubmit }: PlatformPlaylistGridProps) {
  const [genreFilter, setGenreFilter] = useState("all");

  const { data: playlists, isLoading } = useQuery<any[]>({
    queryKey: ["platform-playlists", platformId, genreFilter],
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .eq("platform_id", platformId)
        .order("follower_count", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!platformId,
  });

  const formatFollowers = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  const getPlaylistIcon = (genre: string) => {
    const colors: Record<string, string> = {
      Pop: "bg-pink-500",
      Rock: "bg-red-500",
      "Hip-Hop": "bg-amber-500",
      Electronic: "bg-cyan-500",
      "R&B": "bg-purple-500",
      Country: "bg-orange-500",
      Jazz: "bg-blue-500",
      Classical: "bg-slate-500",
    };
    return colors[genre] || "bg-primary";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={genreFilter} onValueChange={setGenreFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by genre" />
          </SelectTrigger>
          <SelectContent>
            {genres.map((genre) => (
              <SelectItem key={genre.value} value={genre.value}>
                {genre.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Badge variant="outline">{playlists?.length || 0} playlists</Badge>
      </div>

      {!playlists?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ListMusic className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">No Playlists Found</p>
            <p className="text-sm text-muted-foreground">
              No playlists available for this platform yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {playlists.map((playlist: any) => (
            <Card key={playlist.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div 
                className="h-24 flex items-center justify-center"
                style={{ backgroundColor: brandColor + "20" }}
              >
                <div className={`h-16 w-16 rounded-lg ${getPlaylistIcon(playlist.genre)} flex items-center justify-center`}>
                  <ListMusic className="h-8 w-8 text-white" />
                </div>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base truncate">{playlist.playlist_name || playlist.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {playlist.description || `A curated ${playlist.genre} playlist`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{formatFollowers(playlist.follower_count || 0)} followers</span>
                  </div>
                  <Badge variant="secondary">{playlist.genre || "Various"}</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  {playlist.is_editorial && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      Editorial
                    </Badge>
                  )}
                  {playlist.submission_cost > 0 && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {playlist.submission_cost} to submit
                    </span>
                  )}
                </div>

                <Button 
                  className="w-full" 
                  size="sm"
                  style={{ backgroundColor: brandColor }}
                  onClick={() => onSubmit?.(playlist.id)}
                >
                  Submit Song
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
