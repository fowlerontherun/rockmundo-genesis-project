import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { 
  Search, Music, Users, TrendingUp, ThumbsUp, ThumbsDown, 
  User, ExternalLink, Loader2 
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function BandSearch() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch bands with search
  const { data: bands, isLoading } = useQuery({
    queryKey: ["band-search", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("bands")
        .select(`
          id,
          name,
          genre,
          description,
          fame,
          chemistry_level,
          cohesion_score,
          total_fans,
          logo_url,
          created_at,
          status,
          band_members(
            id,
            role,
            instrument_role,
            vocal_role,
            user_id,
            profiles:user_id(display_name, username, avatar_url)
          )
        `)
        .eq("status", "active")
        .order("fame", { ascending: false })
        .limit(50);

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,genre.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch user's ratings
  const { data: userRatings } = useQuery({
    queryKey: ["user-band-ratings", user?.id],
    queryFn: async () => {
      if (!user) return {};
      const { data, error } = await supabase
        .from("band_ratings")
        .select("band_id, rating")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.reduce((acc, r) => ({ ...acc, [r.band_id]: r.rating }), {} as Record<string, string>);
    },
    enabled: !!user,
  });

  // Fetch rating counts for all bands
  const { data: ratingCounts } = useQuery({
    queryKey: ["band-rating-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("band_ratings")
        .select("band_id, rating");
      if (error) throw error;
      
      const counts: Record<string, { up: number; down: number }> = {};
      data.forEach((r) => {
        if (!counts[r.band_id]) counts[r.band_id] = { up: 0, down: 0 };
        counts[r.band_id][r.rating as "up" | "down"]++;
      });
      return counts;
    },
  });

  // Rate band mutation
  const rateMutation = useMutation({
    mutationFn: async ({ bandId, rating }: { bandId: string; rating: "up" | "down" }) => {
      if (!user) throw new Error("Must be logged in to rate");
      
      const currentRating = userRatings?.[bandId];
      
      if (currentRating === rating) {
        // Remove rating
        const { error } = await supabase
          .from("band_ratings")
          .delete()
          .eq("band_id", bandId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        // Upsert rating
        const { error } = await supabase
          .from("band_ratings")
          .upsert(
            { band_id: bandId, user_id: user.id, rating },
            { onConflict: "band_id,user_id" }
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-band-ratings"] });
      queryClient.invalidateQueries({ queryKey: ["band-rating-counts"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Band Search</h1>
          <p className="text-muted-foreground">Discover bands and rate them</p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by band name or genre..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !bands?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No bands found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bands.map((band) => {
            const counts = ratingCounts?.[band.id] || { up: 0, down: 0 };
            const userRating = userRatings?.[band.id];
            
            return (
              <Card key={band.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={band.logo_url || undefined} />
                      <AvatarFallback>
                        <Music className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{band.name}</CardTitle>
                      <Badge variant="secondary" className="mt-1">
                        {band.genre || "Unknown Genre"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1 text-sm font-medium">
                        <TrendingUp className="h-3 w-3" />
                        {band.fame || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Fame</p>
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium">{band.chemistry_level || 0}</div>
                      <p className="text-xs text-muted-foreground">Chemistry</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1 text-sm font-medium">
                        <Users className="h-3 w-3" />
                        {band.total_fans || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Fans</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Members Preview */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Members ({band.band_members?.length || 0})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {band.band_members?.slice(0, 4).map((member: any) => (
                        <div key={member.id} className="flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={member.profiles?.avatar_url || undefined} />
                            <AvatarFallback>
                              <User className="h-2 w-2" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[80px]">
                            {member.profiles?.display_name || member.profiles?.username || member.instrument_role}
                          </span>
                        </div>
                      ))}
                      {(band.band_members?.length || 0) > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{band.band_members.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant={userRating === "up" ? "default" : "outline"}
                        size="sm"
                        onClick={() => rateMutation.mutate({ bandId: band.id, rating: "up" })}
                        disabled={rateMutation.isPending || !user}
                        className={cn(
                          "gap-1",
                          userRating === "up" && "bg-green-600 hover:bg-green-700"
                        )}
                      >
                        <ThumbsUp className="h-4 w-4" />
                        <span>{counts.up}</span>
                      </Button>
                      <Button
                        variant={userRating === "down" ? "default" : "outline"}
                        size="sm"
                        onClick={() => rateMutation.mutate({ bandId: band.id, rating: "down" })}
                        disabled={rateMutation.isPending || !user}
                        className={cn(
                          "gap-1",
                          userRating === "down" && "bg-red-600 hover:bg-red-700"
                        )}
                      >
                        <ThumbsDown className="h-4 w-4" />
                        <span>{counts.down}</span>
                      </Button>
                    </div>
                    
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/band/${band.id}`}>
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
