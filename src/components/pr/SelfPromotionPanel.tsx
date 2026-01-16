import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle,
  Lock,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO, addMinutes, addDays, isBefore } from "date-fns";

interface SelfPromotionPanelProps {
  bandId: string;
  bandFame: number;
  bandBalance: number;
  userId: string;
}

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

export function SelfPromotionPanel({ bandId, bandFame, bandBalance, userId }: SelfPromotionPanelProps) {
  const queryClient = useQueryClient();
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [promoFocus, setPromoFocus] = useState<string>("general");

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
      const activity = activities?.find(a => a.activity_type === activityType);
      if (!activity) throw new Error("Activity not found");

      // Check balance
      if (bandBalance < activity.base_cost) {
        throw new Error(`Insufficient funds. Need $${activity.base_cost.toLocaleString()}`);
      }

      // Check fame requirement
      if (bandFame < activity.min_fame_required) {
        throw new Error(`Need ${activity.min_fame_required.toLocaleString()} fame for this activity`);
      }

      // Check cooldown
      const cooldown = cooldowns?.find(c => c.activity_type === activityType);
      if (cooldown && isBefore(new Date(), parseISO(cooldown.cooldown_expires_at))) {
        throw new Error(`This activity is on cooldown until ${format(parseISO(cooldown.cooldown_expires_at), "MMM d, h:mm a")}`);
      }

      // Create the scheduled activity
      const startTime = new Date();
      const endTime = addMinutes(startTime, activity.duration_minutes);

      // Get user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (!profile) throw new Error("Profile not found");

      // Deduct cost from band
      const { error: deductError } = await supabase
        .from("bands")
        .update({ band_balance: bandBalance - activity.base_cost })
        .eq("id", bandId);

      if (deductError) throw deductError;

      // Create self-promotion activity
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

      // Create scheduled activity for the player
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

      // Set cooldown
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["self-promotions-active", bandId] });
      queryClient.invalidateQueries({ queryKey: ["self-promotion-cooldowns", bandId] });
      queryClient.invalidateQueries({ queryKey: ["user-band-pr"] });
      
      toast.success("Promotion started!", {
        description: `Your self-promotion activity is now in progress.`,
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

  const canAfford = (cost: number) => bandBalance >= cost;
  const hasRequiredFame = (minFame: number) => bandFame >= minFame;

  if (activitiesLoading || activeLoading || cooldownsLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const selectedActivityData = activities?.find(a => a.activity_type === selectedActivity);

  return (
    <div className="space-y-6">
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

      {/* Available Activities */}
      <Card className="bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Self-Promotion Activities
          </CardTitle>
          <CardDescription>
            Boost your fame and fans through DIY promotion. No media offers needed!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {activities?.map((activity) => {
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
                    className={`relative cursor-pointer transition-all hover:border-primary/50 ${
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
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
