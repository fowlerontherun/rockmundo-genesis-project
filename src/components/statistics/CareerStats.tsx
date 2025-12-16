import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, MapPin, Clock, DollarSign, Calendar, Trophy } from "lucide-react";

export function CareerStats() {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["career-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get profile data
      const { data: profile } = await supabase
        .from("profiles")
        .select("total_hours_played, created_at, cash, fame, fans")
        .eq("user_id", user.id)
        .single();

      // Get band count
      const { count: bandCount } = await supabase
        .from("band_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Get gigs played
      const { count: gigsPlayed } = await supabase
        .from("gigs")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      // Get cities visited (unique venues)
      const { data: venueData } = await supabase
        .from("gigs")
        .select("venues(city_id)")
        .eq("status", "completed");
      
      const uniqueCities = new Set(
        venueData?.map((g: any) => g.venues?.city_id).filter(Boolean)
      ).size;

      // Get total earnings
      const { data: earnings } = await supabase
        .from("band_earnings")
        .select("amount")
        .eq("earned_by_user_id", user.id);

      const totalEarnings = earnings?.reduce((sum, e) => sum + e.amount, 0) || 0;

      // Get achievements unlocked
      const { count: achievements } = await supabase
        .from("player_achievements")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("unlocked_at", "is", null);

      return {
        hoursPlayed: profile?.total_hours_played || 0,
        joinDate: profile?.created_at,
        currentCash: profile?.cash || 0,
        fame: profile?.fame || 0,
        fans: profile?.fans || 0,
        bandCount: bandCount || 0,
        gigsPlayed: gigsPlayed || 0,
        citiesVisited: uniqueCities,
        totalEarnings,
        achievements: achievements || 0,
      };
    },
    enabled: !!user?.id,
  });

  if (!stats) return <div>Loading career stats...</div>;

  const statCards = [
    { label: "Hours Played", value: `${stats.hoursPlayed.toFixed(1)}h`, icon: Clock },
    { label: "Total Earnings", value: `$${stats.totalEarnings.toLocaleString()}`, icon: DollarSign },
    { label: "Bands Joined", value: stats.bandCount, icon: Briefcase },
    { label: "Gigs Played", value: stats.gigsPlayed, icon: Calendar },
    { label: "Cities Visited", value: stats.citiesVisited, icon: MapPin },
    { label: "Achievements", value: stats.achievements, icon: Trophy },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Career Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Started Playing</p>
                <p className="text-xs text-muted-foreground">
                  {stats.joinDate ? new Date(stats.joinDate).toLocaleDateString() : "Unknown"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Current Fame</p>
                <p className="text-xs text-muted-foreground">{stats.fame.toLocaleString()} fame points</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2 rounded bg-muted/50">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Current Balance</p>
                <p className="text-xs text-muted-foreground">${stats.currentCash.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
