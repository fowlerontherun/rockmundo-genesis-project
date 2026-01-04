import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Users, Music, Star, TrendingUp, Eye } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface Band {
  id: string;
  name: string;
  artist_name: string | null;
  genre: string | null;
  fame: number | null;
  chemistry_level: number | null;
  description: string | null;
  total_fans: number | null;
  member_count: number;
  song_count: number;
}

export default function BandFinder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data: bands, isLoading } = useQuery({
    queryKey: ["band-finder", debouncedQuery],
    queryFn: async () => {
      let query = supabase
        .from("bands")
        .select(`
          id,
          name,
          artist_name,
          genre,
          fame,
          chemistry_level,
          description,
          total_fans,
          band_members(id)
        `)
        .eq("status", "active")
        .order("fame", { ascending: false })
        .limit(50);

      if (debouncedQuery) {
        query = query.or(`name.ilike.%${debouncedQuery}%,artist_name.ilike.%${debouncedQuery}%,genre.ilike.%${debouncedQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get song counts for each band
      const bandIds = data?.map(b => b.id) || [];
      const { data: songCounts } = await supabase
        .from("songs")
        .select("band_id")
        .in("band_id", bandIds)
        .in("status", ["recorded", "released"]);

      const songCountMap: Record<string, number> = {};
      songCounts?.forEach(s => {
        songCountMap[s.band_id] = (songCountMap[s.band_id] || 0) + 1;
      });

      return data?.map(band => ({
        ...band,
        member_count: Array.isArray(band.band_members) ? band.band_members.length : 0,
        song_count: songCountMap[band.id] || 0,
      })) as Band[];
    },
  });

  const handleSearch = () => {
    setDebouncedQuery(searchQuery);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Search className="h-8 w-8 text-primary" />
          Band Finder
        </h1>
        <p className="text-muted-foreground mt-1">
          Search and explore bands in the game
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by band name, artist name, or genre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Bands</CardTitle>
          <CardDescription>
            {bands?.length || 0} bands found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-400px)]">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : bands && bands.length > 0 ? (
              <div className="space-y-3">
                {bands.map((band) => (
                  <Card key={band.id} className="hover:bg-accent/50 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">{band.name}</h3>
                            {band.artist_name && (
                              <span className="text-sm text-muted-foreground">
                                ({band.artist_name})
                              </span>
                            )}
                          </div>
                          {band.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                              {band.description}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {band.genre && (
                              <Badge variant="secondary" className="text-xs">
                                <Music className="h-3 w-3 mr-1" />
                                {band.genre}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {band.member_count} members
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <Music className="h-3 w-3 mr-1" />
                              {band.song_count} songs
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              {band.fame?.toLocaleString() || 0} fame
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {band.total_fans?.toLocaleString() || 0} fans
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/bands/${band.id}/management`)}
                          className="ml-4 shrink-0"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Band
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No bands found. Try a different search.</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
