import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, User, Music } from "lucide-react";
import { Link } from "react-router-dom";

interface PlayerProfile {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  bands?: Array<{
    name: string;
    genre: string | null;
  }>;
}

export default function PlayerSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const { data: players, isLoading } = useQuery({
    queryKey: ["player-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];

      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio, user_id")
        .or(`username.ilike.%${debouncedQuery}%,display_name.ilike.%${debouncedQuery}%`)
        .limit(20);

      if (error) throw error;
      if (!profiles) return [];

      // Fetch band memberships separately
      const playerIds = profiles.map(p => p.user_id);
      const { data: memberships } = await supabase
        .from("band_members")
        .select("user_id, bands!band_members_band_id_fkey(name, genre)")
        .in("user_id", playerIds);

      // Merge the data
      return profiles.map(profile => ({
        ...profile,
        bands: memberships
          ?.filter((m: any) => m.user_id === profile.user_id)
          .map((m: any) => m.bands) || []
      })) as PlayerProfile[];
    },
    enabled: debouncedQuery.length >= 2,
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
        <h1 className="text-3xl font-bold">Search Players</h1>
        <p className="text-muted-foreground">Find other musicians and view their profiles</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Player Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search by username or display name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <Button onClick={handleSearch} disabled={searchQuery.length < 2}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Searching...</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && debouncedQuery.length >= 2 && players && players.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">No players found matching your search.</p>
          </CardContent>
        </Card>
      )}

      {players && players.length > 0 && (
        <div className="space-y-3">
          {players.map((player) => (
            <Card key={player.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={player.avatar_url || undefined} />
                  <AvatarFallback>
                    <User className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {player.display_name || player.username}
                    </span>
                    {player.display_name && (
                      <span className="text-sm text-muted-foreground">
                        @{player.username}
                      </span>
                    )}
                  </div>

                  {player.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-1">{player.bio}</p>
                  )}

                  {player.bands && player.bands.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {player.bands.map((band, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          <Music className="mr-1 h-3 w-3" />
                          {band.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Link to={`/player/${player.id}`}>
                  <Button variant="outline" size="sm">
                    View Profile
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
