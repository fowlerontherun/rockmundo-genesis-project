import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserBand } from "@/hooks/useUserBand";
import { useAuth } from "@/hooks/use-auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Megaphone,
  MessageCircle,
  Mic2,
  Music,
  Instagram,
  Youtube,
  Radio,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  Loader2,
  Lock,
  Share2,
  Filter,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO, addMinutes, addDays, isBefore } from "date-fns";

interface PromotionActivity {
  id: string;
  activity_type: string;
  name: string;
  description: string;
  duration_minutes: number;
  cooldown_days: number;
  base_cost: number;
  base_fame_min: number;
  base_fame_max: number;
  base_fan_min: number;
  base_fan_max: number;
  requires_release: boolean;
  min_fame_required: number;
}

interface ActivePromotion {
  id: string;
  activity_type: string;
  status: string;
  scheduled_start: string;
  scheduled_end: string;
  promo_focus: string | null;
}

interface Cooldown {
  activity_type: string;
  cooldown_expires_at: string;
}

const activityIcons: Record<string, React.ElementType> = {
  reddit_ama: MessageCircle,
  twitch_listening_party: Music,
  instagram_live: Instagram,
  youtube_premiere: Youtube,
  twitter_spaces: Mic2,
  busking: Mic2,
  social_media_ads: Megaphone,
  street_team_flyers: Users,
};

const promoFocusOptions = [
  { value: 'general', label: 'General Band Promotion' },
  { value: 'new_release', label: 'New Release/Single' },
  { value: 'upcoming_tour', label: 'Upcoming Tour/Shows' },
  { value: 'merch', label: 'Merchandise' },
  { value: 'streaming', label: 'Streaming Platforms' },
];

const SelfPromotionBrowser = () => {
  const { user } = useAuth();
  const { data: userBand, isLoading: bandLoading } = useUserBand();
  const queryClient = useQueryClient();
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [promoFocus, setPromoFocus] = useState<string>("general");
  const [costFilter, setCostFilter] = useState<string>("all");

  const bandId = userBand?.id;
  const bandFame = userBand?.fame || 0;
  const userId = user?.id;

  // Fetch player's personal cash balance from profiles
  const { data: playerProfile, isLoading: profileLoading } = useQuery({
    queryKey: ["player-profile-cash", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, cash")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const playerCash = playerProfile?.cash || 0;

  // Fetch available promotion activities from catalog
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["self-promotion-catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("self_promotion_catalog")
        .select("*")
        .eq("is_active", true)
        .order("min_fame_required", { ascending: true });

      if (error) throw error;
      return data as PromotionActivity[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch active/scheduled promotions
  const { data: activePromotions, isLoading: activeLoading } = useQuery({
    queryKey: ["self-promotions-active", bandId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("self_promotion_activities")
        .select("*")
        .eq("band_id", bandId)
        .in("status", ["scheduled", "in_progress"])
        .order("scheduled_start", { ascending: true });

      if (error) throw error;
      return data as ActivePromotion[];
    },
    enabled: !!bandId,
    staleTime: 60 * 1000,
  });

  // Fetch cooldowns
  const { data: cooldowns, isLoading: cooldownsLoading } = useQuery({
    queryKey: ["self-promotion-cooldowns", bandId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await (supabase as any)
        .from("self_promotion_cooldowns")
        .select("activity_type, cooldown_expires_at")
        .eq("band_id", bandId)
        .gt("cooldown_expires_at", now);

      if (error) throw error;
      return data as Cooldown[];
    },
    enabled: !!bandId,
    staleTime: 60 * 1000,
  });

  // Start promotion mutation
  const startPromotionMutation = useMutation({
    mutationFn: async ({ activityType, promoFocus }: { activityType: string; promoFocus: string }) => {
      if (!bandId || !userId) throw new Error("Band or user not found");
      
      const activity = activities?.find(a => a.activity_type === activityType);
      if (!activity) throw new Error("Activity not found");

      if (playerCash < activity.base_cost) {
        throw new Error(`Insufficient funds. Need $${activity.base_cost.toLocaleString()}, you have $${playerCash.toLocaleString()}`);
      }

      if (bandFame < activity.min_fame_required) {
        throw new Error(`Need ${activity.min_fame_required.toLocaleString()} fame for this activity`);
      }

      const cooldown = cooldowns?.find(c => c.activity_type === activityType);
      if (cooldown && isBefore(new Date(), parseISO(cooldown.cooldown_expires_at))) {
        throw new Error(`This activity is on cooldown until ${format(parseISO(cooldown.cooldown_expires_at), "MMM d, h:mm a")}`);
      }

      const startTime = new Date();
      const endTime = addMinutes(startTime, activity.duration_minutes);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Deduct from player's personal cash
      const { error: deductError } = await supabase
        .from("profiles")
        .update({ cash: playerCash - activity.base_cost })
        .eq("user_id", userId);

      if (deductError) throw deductError;

      const { data, error } = await (supabase as any)
        .from("self_promotion_activities")
        .insert({
          user_id: userId,
          band_id: bandId,
          activity_type: activityType,
          promo_focus: promoFocus,
          status: "in_progress",
          scheduled_start: startTime.toISOString(),
          scheduled_end: endTime.toISOString(),
          cost_paid: activity.base_cost,
          fame_gained: 0,
          fans_gained: 0,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from("player_scheduled_activities")
        .insert({
          user_id: userId,
          profile_id: profile.id,
          activity_type: "self_promotion",
          title: `Self Promo: ${activity.name}`,
          scheduled_start: startTime.toISOString(),
          scheduled_end: endTime.toISOString(),
          status: "in_progress",
          metadata: {
            self_promotion_id: data.id,
            activity_type: activityType,
            band_id: bandId,
            promo_focus: promoFocus,
          },
        });

      const cooldownExpires = addDays(new Date(), activity.cooldown_days);
      await (supabase as any)
        .from("self_promotion_cooldowns")
        .upsert({
          band_id: bandId,
          activity_type: activityType,
          cooldown_expires_at: cooldownExpires.toISOString(),
        }, {
          onConflict: "band_id,activity_type",
        });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["self-promotions-active", bandId] });
      queryClient.invalidateQueries({ queryKey: ["self-promotion-cooldowns", bandId] });
      queryClient.invalidateQueries({ queryKey: ["user-band-pr"] });
      queryClient.invalidateQueries({ queryKey: ["player-profile-cash", userId] });
      
      toast.success("Promotion started!", {
        description: "Your self-promotion activity is now in progress.",
      });
      setSelectedActivity(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to start promotion", { description: error.message });
    },
  });

  const isOnCooldown = (activityType: string): Date | null => {
    const cooldown = cooldowns?.find(c => c.activity_type === activityType);
    if (cooldown && isBefore(new Date(), parseISO(cooldown.cooldown_expires_at))) {
      return parseISO(cooldown.cooldown_expires_at);
    }
    return null;
  };

  const canAfford = (cost: number) => playerCash >= cost;
  const hasRequiredFame = (minFame: number) => bandFame >= minFame;

  const filteredActivities = activities?.filter(activity => {
    if (costFilter === "all") return true;
    if (costFilter === "free") return activity.base_cost === 0;
    if (costFilter === "low") return activity.base_cost > 0 && activity.base_cost <= 100;
    if (costFilter === "medium") return activity.base_cost > 100 && activity.base_cost <= 500;
    if (costFilter === "high") return activity.base_cost > 500;
    return true;
  });

  if (bandLoading || activitiesLoading || activeLoading || cooldownsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (!userBand) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            You need to be in a band to use self-promotion features.
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedActivityData = activities?.find(a => a.activity_type === selectedActivity);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Share2 className="h-8 w-8 text-primary" />
          Self-Promotion
        </h1>
        <p className="text-muted-foreground">
          Boost your fame and fans through DIY promotion activities. No media offers needed!
        </p>
      </div>

      {/* Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <p className="text-2xl font-bold">{activePromotions?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Fame</span>
            </div>
            <p className="text-2xl font-bold">{bandFame.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Fans</span>
            </div>
            <p className="text-2xl font-bold">{(userBand.total_fans || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">Balance</span>
            </div>
            <p className="text-2xl font-bold">${playerCash.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Select value={costFilter} onValueChange={setCostFilter}>
          <SelectTrigger className="w-full md:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Cost Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Costs</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="low">Low ($1-$100)</SelectItem>
            <SelectItem value="medium">Medium ($101-$500)</SelectItem>
            <SelectItem value="high">High ($500+)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Promotions */}
      {activePromotions && activePromotions.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Active Promotions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activePromotions.map((promo) => {
              const activity = activities?.find(a => a.activity_type === promo.activity_type);
              const Icon = activityIcons[promo.activity_type] || Megaphone;
              const endTime = parseISO(promo.scheduled_end);
              
              return (
                <div key={promo.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{activity?.name || promo.activity_type}</p>
                      <p className="text-xs text-muted-foreground">
                        Ends {formatDistanceToNow(endTime, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-amber-500/20 text-amber-400">
                    In Progress
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Selection Panel */}
      {selectedActivity && selectedActivityData && (
        <Card className="bg-card/80 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {(() => {
                const Icon = activityIcons[selectedActivity] || Megaphone;
                return <Icon className="h-5 w-5 text-primary" />;
              })()}
              {selectedActivityData.name}
            </CardTitle>
            <CardDescription>{selectedActivityData.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Duration: {selectedActivityData.duration_minutes} min</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>Cost: ${selectedActivityData.base_cost.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span>Fame: +{selectedActivityData.base_fame_min}-{selectedActivityData.base_fame_max}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span>Fans: +{selectedActivityData.base_fan_min}-{selectedActivityData.base_fan_max}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Promotion Focus</Label>
              <Select value={promoFocus} onValueChange={setPromoFocus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {promoFocusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedActivity(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={
                  !canAfford(selectedActivityData.base_cost) ||
                  !hasRequiredFame(selectedActivityData.min_fame_required) ||
                  !!isOnCooldown(selectedActivity) ||
                  startPromotionMutation.isPending
                }
                onClick={() => startPromotionMutation.mutate({ activityType: selectedActivity, promoFocus })}
              >
                {startPromotionMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Megaphone className="mr-2 h-4 w-4" />
                    Start Now
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Activities Grid */}
      <p className="text-sm text-muted-foreground">
        Showing {filteredActivities?.length || 0} of {activities?.length || 0} activities
      </p>

      {filteredActivities?.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No activities match your criteria
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActivities?.map((activity) => {
            const Icon = activityIcons[activity.activity_type] || Megaphone;
            const cooldownEnd = isOnCooldown(activity.activity_type);
            const affordable = canAfford(activity.base_cost);
            const hasFame = hasRequiredFame(activity.min_fame_required);
            const isLocked = !hasFame;
            const isDisabled = isLocked || !!cooldownEnd || !affordable;
            const isSelected = selectedActivity === activity.activity_type;

            return (
              <Card 
                key={activity.id} 
                className={`relative cursor-pointer transition-all hover:shadow-lg ${
                  isSelected ? 'border-primary bg-primary/5' : ''
                } ${isDisabled ? 'opacity-60' : ''}`}
                onClick={() => !isDisabled && setSelectedActivity(activity.activity_type)}
              >
                <CardContent className="p-4">
                  {isLocked && (
                    <div className="absolute top-2 right-2">
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3">
                    <div className={`rounded-lg p-2 ${isLocked ? 'bg-muted' : 'bg-primary/10'}`}>
                      <Icon className={`h-5 w-5 ${isLocked ? 'text-muted-foreground' : 'text-primary'}`} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <h4 className="font-medium text-sm">{activity.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {activity.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">
                          <Clock className="mr-1 h-3 w-3" />
                          {activity.duration_minutes}m
                        </Badge>
                        <Badge 
                          variant={affordable ? "outline" : "destructive"} 
                          className="text-xs"
                        >
                          <DollarSign className="mr-1 h-3 w-3" />
                          ${activity.base_cost.toLocaleString()}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                          +{activity.base_fame_min}-{activity.base_fame_max} fame
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-blue-500" />
                          +{activity.base_fan_min}-{activity.base_fan_max} fans
                        </span>
                      </div>

                      {isLocked && (
                        <p className="text-xs text-amber-500 mt-1">
                          Requires {activity.min_fame_required.toLocaleString()} fame
                        </p>
                      )}

                      {cooldownEnd && (
                        <p className="text-xs text-amber-500 mt-1">
                          Available {formatDistanceToNow(cooldownEnd, { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SelfPromotionBrowser;