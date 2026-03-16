import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, TrendingUp, Music, User } from "lucide-react";
import { format } from "date-fns";
import { BandSongsSection } from "@/components/band/BandSongsSection";
import { BandApplicationDialog } from "@/components/band/BandApplicationDialog";
import { useTranslation } from "@/hooks/useTranslation";
import { useActiveProfile } from "@/hooks/useActiveProfile";

export default function BandProfile() {
  const { t } = useTranslation();
  const { bandId } = useParams();
  const { profileId } = useActiveProfile();

  const { data: band, isLoading } = useQuery({
    queryKey: ["band-profile", bandId],
    queryFn: async () => {
      if (!bandId) throw new Error("No band ID");

      const { data, error } = await supabase
        .from("bands")
        .select(`
          id,
          name,
          genre,
          description,
          fame,
          chemistry_level,
          cohesion_score,
          created_at,
          logo_url,
          is_recruiting,
          band_members(
            id,
            instrument_role,
            vocal_role,
            role,
            joined_at,
            profile_id,
            profiles:profile_id(
              id,
              username,
              display_name,
              avatar_url
            )
          )
        `)
        .eq("id", bandId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!bandId,
  });

  // Check if user is already a member
  const isMember = band?.band_members?.some(
    (m: any) => m.profile_id === profileId
  );

  // Check if user already applied
  const { data: existingApplication } = useQuery({
    queryKey: ["band-application", bandId, profileId],
    queryFn: async () => {
      if (!bandId || !profileId) return null;
      const { data } = await supabase
        .from("band_applications")
        .select("id, status")
        .eq("band_id", bandId)
        .eq("applicant_profile_id", profileId)
        .maybeSingle();
      return data;
    },
    enabled: !!bandId && !!profileId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading band...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!band) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Band not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canApply = band.is_recruiting && !isMember && !existingApplication && profileId;

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            {band.logo_url ? (
              <img
                src={band.logo_url}
                alt={band.name}
                className="h-24 w-24 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-lg bg-muted">
                <Music className="h-12 w-12 text-muted-foreground" />
              </div>
            )}

            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{band.name}</h1>
                {band.genre && <Badge variant="secondary">{band.genre}</Badge>}
                {band.is_recruiting && (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    Recruiting
                  </Badge>
                )}
              </div>

              {band.description && (
                <p className="text-sm">{band.description}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>{band.fame || 0} Fame</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{band.chemistry_level || 0} Chemistry</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Cohesion:</span>
                  <span>{band.cohesion_score || 0}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  {band.created_at && `Formed ${format(new Date(band.created_at), "MMMM yyyy")}`}
                </p>
                {/* Apply button */}
                {canApply && (
                  <BandApplicationDialog
                    bandId={band.id}
                    bandName={band.name}
                    profileId={profileId!}
                  />
                )}
                {existingApplication && (
                  <Badge variant="outline" className="text-xs">
                    {existingApplication.status === 'pending' ? 'Application Pending' : `Application ${existingApplication.status}`}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Band Members ({band.band_members?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!band.band_members || band.band_members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : (
            <div className="space-y-4">
              {band.band_members.map((member: any, idx: number) => (
                <div key={member.id}>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.profiles?.avatar_url || undefined} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {member.profiles?.display_name || member.profiles?.username || "Unknown"}
                        </span>
                        <Badge variant={member.role === "leader" ? "default" : "outline"}>
                          {member.role}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.instrument_role}
                        {member.vocal_role && ` / ${member.vocal_role}`}
                      </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {member.joined_at ? `Joined ${format(new Date(member.joined_at), "MMM yyyy")}` : ''}
                    </div>
                  </div>
                  {idx < band.band_members.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Songs Section */}
      <BandSongsSection bandId={band.id} bandName={band.name} />
    </div>
  );
}
