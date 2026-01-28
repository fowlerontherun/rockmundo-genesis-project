import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Users, TrendingUp, Globe, MapPin, Music } from "lucide-react";
import { RegionalFameBreakdown } from "./RegionalFameBreakdown";

interface CharacterFameOverviewProps {
  profileId?: string;
}

const FAME_TIERS = [
  { min: 0, max: 100, name: "Unknown", color: "bg-muted" },
  { min: 100, max: 500, name: "Local Act", color: "bg-blue-500" },
  { min: 500, max: 2000, name: "Rising Star", color: "bg-green-500" },
  { min: 2000, max: 10000, name: "Regional Star", color: "bg-yellow-500" },
  { min: 10000, max: 50000, name: "National Star", color: "bg-orange-500" },
  { min: 50000, max: 200000, name: "International Star", color: "bg-red-500" },
  { min: 200000, max: Infinity, name: "Superstar", color: "bg-purple-500" },
];

const getFameTier = (fame: number) => {
  return FAME_TIERS.find(tier => fame >= tier.min && fame < tier.max) || FAME_TIERS[0];
};

const getProgressToNextTier = (fame: number) => {
  const currentTier = getFameTier(fame);
  const currentTierIndex = FAME_TIERS.indexOf(currentTier);
  const nextTier = FAME_TIERS[currentTierIndex + 1];
  
  if (!nextTier) return 100;
  
  const progressInTier = fame - currentTier.min;
  const tierRange = currentTier.max - currentTier.min;
  return Math.min(100, (progressInTier / tierRange) * 100);
};

export const CharacterFameOverview = ({ profileId }: CharacterFameOverviewProps) => {
  const { user } = useAuth();
  const userId = user?.id;

  // Fetch profile data
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["character-fame-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("fame, fans, display_name, username")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch band membership for comparison
  const { data: bandMembership } = useQuery({
    queryKey: ["character-band-membership", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("band_members")
        .select(`
          band_id,
          role,
          bands (
            id, name, fame, total_fans, genre
          )
        `)
        .eq("user_id", userId)
        .eq("member_status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Fetch recent fame events (from gigs, releases, etc.)
  const { data: recentActivity } = useQuery({
    queryKey: ["character-fame-activity", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("game_activity_logs")
        .select("*")
        .eq("user_id", userId)
        .in("activity_type", ["gig_completed", "song_released", "chart_entry", "radio_play"])
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  if (profileLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  const fame = profile?.fame || 0;
  const fans = profile?.fans || 0;
  const currentTier = getFameTier(fame);
  const progressToNext = getProgressToNextTier(fame);
  const nextTier = FAME_TIERS[FAME_TIERS.indexOf(currentTier) + 1];
  const band = bandMembership?.bands as any;

  return (
    <div className="space-y-4">
      {/* Fame Overview Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Your Fame & Fans
          </CardTitle>
          <CardDescription>
            Your personal reputation in the music industry
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Fame Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Fame Level</span>
                <Badge className={currentTier.color}>{currentTier.name}</Badge>
              </div>
              <div className="text-3xl font-bold">{fame.toLocaleString()}</div>
              {nextTier && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress to {nextTier.name}</span>
                    <span>{Math.round(progressToNext)}%</span>
                  </div>
                  <Progress value={progressToNext} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {(nextTier.min - fame).toLocaleString()} fame to next tier
                  </p>
                </div>
              )}
            </div>

            {/* Fans Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Fans</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold">{fans.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">
                Personal followers across all activities
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Band Comparison */}
        {band && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Music className="h-4 w-4" />
                Your Band: {band.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Band Fame</span>
                <Badge variant="secondary">{(band.fame || 0).toLocaleString()}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Band Fans</span>
                <span className="font-medium">{(band.total_fans || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Genre</span>
                <span className="text-sm">{band.genre || "Not set"}</span>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Your personal fame contributes to band fame and vice versa
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Regional Fame Breakdown for band */}
        {band && (
          <RegionalFameBreakdown bandId={band.id} compact defaultExpanded={false} />
        )}

        {/* Fame Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              How to Gain Fame
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span>Perform successful gigs</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span>Get songs on the charts</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-purple-500" />
                <span>Radio plays and streams</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-orange-500" />
                <span>Release albums and singles</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-pink-500" />
                <span>Social media engagement</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Recent Fame Activity */}
      {recentActivity && recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Fame Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentActivity.map((activity: any) => (
                <div 
                  key={activity.id} 
                  className="flex items-center justify-between rounded-lg border p-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm">{activity.activity_type.replace(/_/g, " ")}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(activity.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
