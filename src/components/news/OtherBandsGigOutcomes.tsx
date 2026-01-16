import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic2, Star, Users, Flame, MapPin } from "lucide-react";
import { format } from "date-fns";

export const OtherBandsGigOutcomes = () => {
  const { user } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");

  // Get user's bands to exclude
  const { data: userBands } = useQuery({
    queryKey: ["user-bands", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const userBandIds = userBands?.map((b) => b.band_id) || [];

  // Get other bands' gig outcomes today
  const { data: otherGigs } = useQuery({
    queryKey: ["news-other-gigs", userBandIds, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gig_outcomes")
        .select(`
          overall_rating,
          actual_attendance,
          fame_gained,
          casual_fans_gained,
          dedicated_fans_gained,
          venue_name,
          completed_at,
          gigs!inner(
            band_id,
            scheduled_date,
            bands(name, genre),
            venues(cities(name))
          )
        `)
        .gte("completed_at", `${today}T00:00:00`)
        .order("completed_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      // Filter out user's bands
      return (data || []).filter((o: any) => !userBandIds.includes(o.gigs?.band_id));
    },
    enabled: true,
  });

  if (!otherGigs || otherGigs.length === 0) {
    return null;
  }

  const renderStars = (rating: number | null) => {
    const stars = Math.round((rating || 0) / 20); // Assuming 0-100 scale
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${i < stars ? "text-warning fill-warning" : "text-muted-foreground"}`}
          />
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mic2 className="h-5 w-5 text-primary" />
          Other Bands' Gigs Today
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {otherGigs.slice(0, 5).map((gig: any, index: number) => {
          const band = gig.gigs?.bands;
          const venue = gig.gigs?.venues;
          const city = venue?.cities;
          
          return (
            <div key={index} className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="font-semibold">{band?.name || "Unknown Band"}</h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {gig.venue_name}
                    {city?.name && `, ${city.name}`}
                  </p>
                </div>
                {renderStars(gig.overall_rating)}
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                {gig.actual_attendance && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{gig.actual_attendance.toLocaleString()} attended</span>
                  </div>
                )}
                {gig.fame_gained && gig.fame_gained > 0 && (
                  <div className="flex items-center gap-1">
                    <Flame className="h-3 w-3 text-orange-500" />
                    <Badge variant="outline" className="text-xs">+{gig.fame_gained}</Badge>
                  </div>
                )}
                {band?.genre && (
                  <Badge variant="secondary" className="text-xs">{band.genre}</Badge>
                )}
              </div>
            </div>
          );
        })}
        {otherGigs.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">
            +{otherGigs.length - 5} more gigs today
          </p>
        )}
      </CardContent>
    </Card>
  );
};
