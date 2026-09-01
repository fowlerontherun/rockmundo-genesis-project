import { useEffect, useMemo, useState } from "react";
import { MapPin, MessageSquare, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { sendDirectMessage } from "@/features/direct-messages/services/directMessages";
import { useToast } from "@/hooks/use-toast";

interface BandMemberLocationsProps {
  bandId: string;
  currentProfileId?: string | null;
}

type LocationMember = {
  memberId: string;
  profileId: string | null;
  displayName: string;
  avatarUrl: string | null;
  cityId: string | null;
  cityName: string | null;
  countryName: string | null;
  isTouringMember: boolean;
};

export function BandMemberLocations({ bandId, currentProfileId }: BandMemberLocationsProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<LocationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const loadLocations = async (showRefreshState = false) => {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: bandMembers, error: memberError } = await supabase
        .from("band_members")
        .select("id, profile_id, user_id, role, is_touring_member")
        .eq("band_id", bandId)
        .order("joined_at", { ascending: true });

      if (memberError) throw memberError;

      const profileIds = (bandMembers ?? [])
        .map((member) => member.profile_id)
        .filter((id): id is string => Boolean(id));

      const { data: profiles, error: profileError } = profileIds.length
        ? await supabase
            .from("profiles")
            .select("id, display_name, username, avatar_url, current_city_id")
            .in("id", profileIds)
        : { data: [], error: null };

      if (profileError) throw profileError;

      const cityIds = (profiles ?? [])
        .map((profile) => profile.current_city_id)
        .filter((id): id is string => Boolean(id));

      const { data: cities, error: cityError } = cityIds.length
        ? await supabase
            .from("cities")
            .select("id, name, country")
            .in("id", Array.from(new Set(cityIds)))
        : { data: [], error: null };

      if (cityError) throw cityError;

      const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
      const citiesById = new Map((cities ?? []).map((city) => [city.id, city]));

      setMembers(
        (bandMembers ?? []).map((member) => {
          const profile = member.profile_id ? profilesById.get(member.profile_id) : null;
          const city = profile?.current_city_id ? citiesById.get(profile.current_city_id) : null;

          return {
            memberId: member.id,
            profileId: member.profile_id,
            displayName:
              profile?.display_name ||
              profile?.username ||
              (member.is_touring_member ? member.role : null) ||
              "Band member",
            avatarUrl: profile?.avatar_url ?? null,
            cityId: profile?.current_city_id ?? null,
            cityName: city?.name ?? null,
            countryName: city?.country ?? null,
            isTouringMember: Boolean(member.is_touring_member),
          };
        }),
      );
    } catch (error) {
      console.error("Failed to load band member locations", error);
      toast({
        title: "Couldn't load member locations",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadLocations();
  }, [bandId]);

  const currentMember = useMemo(
    () => members.find((member) => member.profileId === currentProfileId),
    [currentProfileId, members],
  );

  const handleLocationMessage = async (member: LocationMember) => {
    if (!member.profileId || member.profileId === currentProfileId) return;

    const senderLocation = currentMember?.cityName
      ? ` I'm currently in ${currentMember.cityName}.`
      : "";
    const recipientLocation = member.cityName
      ? `RockMundo currently shows you in ${member.cityName}${member.countryName ? `, ${member.countryName}` : ""}.`
      : "RockMundo isn't currently showing a confirmed location for you.";
    const message = `${recipientLocation}${senderLocation} Please check you're in the right location for the band's upcoming activities.`;

    setSendingTo(member.profileId);
    try {
      await sendDirectMessage(member.profileId, message);
      toast({
        title: "Location message sent",
        description: `${member.displayName} has been asked to check their location.`,
      });
    } catch (error) {
      toast({
        title: "Message not sent",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Member Locations
          </CardTitle>
          <CardDescription>
            See where every band member currently is and quickly contact anyone who is in the wrong place.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadLocations(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-16 w-full" />
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No band members found.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {members.map((member) => {
              const isSelf = member.profileId === currentProfileId;
              const sameCity = Boolean(
                !isSelf &&
                currentMember?.cityId &&
                member.cityId &&
                currentMember.cityId === member.cityId,
              );
              const differentCity = Boolean(
                !isSelf &&
                currentMember?.cityId &&
                member.cityId &&
                currentMember.cityId !== member.cityId,
              );
              const canMessage = Boolean(member.profileId && !isSelf && !member.isTouringMember);

              return (
                <div
                  key={member.memberId}
                  className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.avatarUrl ?? undefined} alt={member.displayName} />
                      <AvatarFallback>{member.displayName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{member.displayName}</p>
                        {isSelf && <Badge variant="secondary">You</Badge>}
                        {sameCity && <Badge variant="secondary">Same location</Badge>}
                        {differentCity && <Badge variant="destructive">Different location</Badge>}
                        {member.isTouringMember && <Badge variant="outline">Touring</Badge>}
                      </div>
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {member.cityName
                          ? `${member.cityName}${member.countryName ? `, ${member.countryName}` : ""}`
                          : member.isTouringMember
                            ? "Touring member location unavailable"
                            : "Location unknown"}
                      </p>
                    </div>
                  </div>

                  {canMessage && (
                    <Button
                      type="button"
                      variant={differentCity ? "default" : "outline"}
                      size="sm"
                      disabled={sendingTo === member.profileId}
                      onClick={() => void handleLocationMessage(member)}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      {sendingTo === member.profileId ? "Sending..." : "Wrong location? Message"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
