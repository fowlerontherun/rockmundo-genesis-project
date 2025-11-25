import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Music, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function PlayerProfile() {
  const { playerId } = useParams();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["player-profile", playerId],
    queryFn: async () => {
      if (!playerId) throw new Error("No player ID");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, user_id, username, display_name, avatar_url, bio, created_at")
        .eq("id", playerId)
        .single();

      if (profileError) throw profileError;
      if (!profile) return null;

      // Fetch band memberships separately
      const { data: memberships, error: membershipsError } = await supabase
        .from("band_members")
        .select(`
          id,
          instrument_role,
          vocal_role,
          role,
          joined_at,
          band_id,
          bands!band_members_band_id_fkey(id, name, genre, fame, chemistry_level)
        `)
        .eq("user_id", profile.user_id);

      if (membershipsError) throw membershipsError;

      return {
        ...profile,
        band_members: memberships || []
      };
    },
    enabled: !!playerId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading profile...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Player not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback>
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-2xl font-bold">
                  {profile.display_name || profile.username}
                </h1>
                {profile.display_name && (
                  <p className="text-muted-foreground">@{profile.username}</p>
                )}
              </div>

              {profile.bio && (
                <p className="text-sm">{profile.bio}</p>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Joined {format(new Date(profile.created_at), "MMMM yyyy")}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Bands
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!profile.band_members || profile.band_members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not a member of any bands yet.</p>
          ) : (
            <div className="space-y-4">
              {profile.band_members.map((membership: any) => (
                <div key={membership.id}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{membership.bands.name}</span>
                        {membership.bands.genre && (
                          <Badge variant="secondary">{membership.bands.genre}</Badge>
                        )}
                        <Badge variant={membership.role === "leader" ? "default" : "outline"}>
                          {membership.role}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {membership.instrument_role}
                        {membership.vocal_role && ` / ${membership.vocal_role}`}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>Fame: {membership.bands.fame || 0}</span>
                        <span>Chemistry: {membership.bands.chemistry_level || 0}</span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Joined {format(new Date(membership.joined_at), "MMM yyyy")}
                    </div>
                  </div>
                  {membership !== profile.band_members[profile.band_members.length - 1] && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
