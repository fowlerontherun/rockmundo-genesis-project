import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Music, Users, Flame, Star, MapPin } from "lucide-react";
import { format } from "date-fns";

export const BandGainsNews = () => {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  // Get user's bands
  const { data: userBands } = useQuery({
    queryKey: ["user-bands", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("band_members")
        .select("band_id, bands(id, name)")
        .eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const bandIds = userBands?.map((b) => b.band_id) || [];

  // Get fame gains today from band_fame_history
  const { data: fameGains } = useQuery({
    queryKey: ["news-fame-gains", bandIds, today],
    queryFn: async () => {
      if (bandIds.length === 0) return [];
      const { data, error } = await supabase
        .from("band_fame_history")
        .select("band_id, fame_change, scope, event_type, country, recorded_at, cities(name)")
        .in("band_id", bandIds)
        .gte("recorded_at", `${today}T00:00:00`)
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: bandIds.length > 0,
  });

  // Get gig outcomes (fan gains) today with venue and city info
  const { data: gigOutcomes } = useQuery({
    queryKey: ["news-gig-outcomes", bandIds, today],
    queryFn: async () => {
      if (bandIds.length === 0) return [];
      const { data, error } = await supabase
        .from("gig_outcomes")
        .select(`
          casual_fans_gained,
          dedicated_fans_gained,
          superfans_gained,
          fame_gained,
          completed_at,
          gig_id,
          gigs!inner(band_id, venue_id, bands(name), venues(name, cities(name, country)))
        `)
        .gte("completed_at", `${today}T00:00:00`)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      // Filter to user's bands
      return (data || []).filter((o: any) => bandIds.includes(o.gigs?.band_id));
    },
    enabled: bandIds.length > 0,
  });

  // Aggregate by band with location info
  const bandStats = new Map<string, { 
    name: string; 
    fame: number; 
    casual: number; 
    dedicated: number; 
    superfans: number;
    locations: Set<string>;
  }>();

  userBands?.forEach((b: any) => {
    bandStats.set(b.band_id, {
      name: b.bands?.name || "Unknown",
      fame: 0,
      casual: 0,
      dedicated: 0,
      superfans: 0,
      locations: new Set(),
    });
  });

  fameGains?.forEach((fg: any) => {
    const stats = bandStats.get(fg.band_id);
    if (stats) {
      stats.fame += fg.fame_change || 0;
      if (fg.country) {
        const cityName = fg.cities?.name;
        stats.locations.add(cityName ? `${cityName}, ${fg.country}` : fg.country);
      }
    }
  });

  gigOutcomes?.forEach((go: any) => {
    const bandId = go.gigs?.band_id;
    const stats = bandStats.get(bandId);
    if (stats) {
      stats.casual += go.casual_fans_gained || 0;
      stats.dedicated += go.dedicated_fans_gained || 0;
      stats.superfans += go.superfans_gained || 0;
      // Also add fame from gig_outcomes if band_fame_history is empty
      if (!fameGains?.some((fg) => fg.band_id === bandId)) {
        stats.fame += go.fame_gained || 0;
      }
      // Add location from gig venue
      const venue = go.gigs?.venues;
      if (venue?.cities?.name && venue?.cities?.country) {
        stats.locations.add(`${venue.cities.name}, ${venue.cities.country}`);
      }
    }
  });

  const bandsWithGains = Array.from(bandStats.values()).filter(
    (b) => b.fame > 0 || b.casual > 0 || b.dedicated > 0 || b.superfans > 0
  );

  if (bandsWithGains.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Music className="h-5 w-5 text-primary" />
          Your Bands Today
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {bandsWithGains.map((band, index) => (
          <div key={index} className="p-3 rounded-lg bg-muted/50 space-y-2">
            <h4 className="font-semibold">{band.name}</h4>
            <div className="flex flex-wrap gap-3 text-sm">
              {band.fame > 0 && (
                <div className="flex items-center gap-1">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span>Fame: </span>
                  <Badge variant="outline" className="text-xs">+{band.fame.toLocaleString()}</Badge>
                </div>
              )}
              {(band.casual > 0 || band.dedicated > 0 || band.superfans > 0) && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span>New Fans: </span>
                  {band.casual > 0 && (
                    <Badge variant="secondary" className="text-xs">+{band.casual} casual</Badge>
                  )}
                  {band.dedicated > 0 && (
                    <Badge variant="secondary" className="text-xs">+{band.dedicated} dedicated</Badge>
                  )}
                  {band.superfans > 0 && (
                    <Badge className="text-xs">+{band.superfans} superfans</Badge>
                  )}
                </div>
              )}
            </div>
            {band.locations.size > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>From: {Array.from(band.locations).join(", ")}</span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
