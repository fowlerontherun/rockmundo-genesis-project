import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Users, TrendingUp, Music } from "lucide-react";
import { Link } from "react-router-dom";

interface Band {
  id: string;
  name: string;
  genre: string | null;
  fame: number;
  chemistry_level: number;
  description: string | null;
  _count: {
    band_members: number;
  };
}

export default function BandBrowser() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data: bands, isLoading } = useQuery({
    queryKey: ["band-search", debouncedQuery],
    queryFn: async () => {
      let query = supabase
        .from("bands")
        .select(`
          id,
          name,
          genre,
          fame,
          chemistry_level,
          description,
          band_members(count)
        `, { count: "exact" })
        .eq("status", "active")
        .order("fame", { ascending: false })
        .limit(20);

      if (debouncedQuery && debouncedQuery.length >= 2) {
        query = query.or(`name.ilike.%${debouncedQuery}%,genre.ilike.%${debouncedQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get song counts for each band
      const bandIds = (data || []).map(b => b.id);
      const { data: songCounts } = await supabase
        .from("songs")
        .select("band_id")
        .in("band_id", bandIds)
        .in("status", ["recorded", "released"]);

      const songCountMap = new Map<string, number>();
      songCounts?.forEach(s => {
        songCountMap.set(s.band_id, (songCountMap.get(s.band_id) || 0) + 1);
      });
      
      return (data || []).map(band => ({
        ...band,
        _count: {
          band_members: band.band_members?.length || 0
        },
        song_count: songCountMap.get(band.id) || 0,
      })) as (Band & { song_count: number })[];
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
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Browse Bands</h1>
        <p className="text-muted-foreground">Discover active bands and their members</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Band Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by band name or genre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading bands...</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && bands && bands.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">
              {debouncedQuery ? "No bands found matching your search." : "No active bands found."}
            </p>
          </CardContent>
        </Card>
      )}

      {bands && bands.length > 0 && (
        <div className="space-y-3">
          {bands.map((band) => (
            <Card key={band.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-lg">{band.name}</span>
                    {band.genre && (
                      <Badge variant="secondary">{band.genre}</Badge>
                    )}
                  </div>

                  {band.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {band.description}
                    </p>
                  )}

                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{band._count.band_members} members</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Music className="h-4 w-4" />
                      <span>{band.song_count} songs</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      <span>{band.fame || 0} fame</span>
                    </div>
                  </div>
                </div>

                <Link to={`/band/${band.id}`}>
                  <Button variant="outline" size="sm">
                    View Band
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
