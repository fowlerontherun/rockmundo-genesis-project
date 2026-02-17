import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CalendarClock, Heart, Zap, AlertTriangle, Flame, CheckCircle2, Clock } from "lucide-react";
import { createScheduledActivity } from "@/hooks/useActivityBooking";
import { addDays, setHours, setMinutes } from "date-fns";

interface PromoTourCardProps {
  releaseId: string;
  releaseTitle: string;
  bandId: string;
  bandFame?: number;
  playerCash: number;
  playerHealth: number;
  playerEnergy: number;
  userId: string;
}

const PROMO_DAILY_ACTIVITIES = [
  { label: "Radio Call-Ins & Podcast Taping", hype: 25, healthDrain: 15, energyCost: 20 },
  { label: "In-Store Signing & Street Flyering", hype: 30, healthDrain: 20, energyCost: 25 },
  { label: "Social Media Marathon & Fan Meet", hype: 35, healthDrain: 12, energyCost: 15 },
  { label: "Press Junket & Magazine Interviews", hype: 28, healthDrain: 18, energyCost: 22 },
  { label: "Music Video Promo & TV Appearances", hype: 40, healthDrain: 16, energyCost: 20 },
  { label: "Club DJ Set & Listening Party", hype: 32, healthDrain: 22, energyCost: 28 },
  { label: "Acoustic Sessions & Live Streams", hype: 38, healthDrain: 14, energyCost: 18 },
];

const PROMO_PACKAGES = [
  {
    id: "quick_blitz",
    name: "Quick Blitz",
    days: 3,
    dailyCost: 200,
    description: "3 intense days of radio, signings, and social media.",
    healthWarning: "Moderate",
    warningColor: "text-yellow-500",
  },
  {
    id: "standard_push",
    name: "Standard Push",
    days: 5,
    dailyCost: 250,
    description: "5-day promo blitz covering press, podcasts, and events.",
    healthWarning: "Heavy",
    warningColor: "text-orange-500",
  },
  {
    id: "full_campaign",
    name: "Full Campaign",
    days: 7,
    dailyCost: 300,
    description: "Week-long exhaustive campaign hitting every media channel.",
    healthWarning: "Brutal",
    warningColor: "text-destructive",
  },
];

export const PromoTourCard = ({
  releaseId,
  releaseTitle,
  bandId,
  bandFame = 0,
  playerCash,
  playerHealth,
  playerEnergy,
  userId,
}: PromoTourCardProps) => {
  const queryClient = useQueryClient();
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [timeSlot, setTimeSlot] = useState<"morning" | "afternoon">("morning");

  // Fetch active promo tour for this release
  const { data: activeTour } = useQuery({
    queryKey: ["promo-tour", releaseId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("promotional_campaigns" as any) as any)
        .select("*")
        .eq("release_id", releaseId)
        .eq("campaign_type", "promo_tour")
        .in("status", ["active", "scheduled"])
        .maybeSingle();
      if (error) throw error;
      return data as any | null;
    },
  });

  // Fetch completed promo day activities for this tour
  const { data: completedDays } = useQuery({
    queryKey: ["promo-tour-days", releaseId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("player_scheduled_activities")
        .select("*")
        .eq("user_id", userId)
        .eq("activity_type", "release_promo")
        .eq("metadata->>release_id", releaseId)
        .in("status", ["completed", "scheduled", "in_progress"]);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!activeTour,
  });

  const fameMultiplier = 1 + Math.min(bandFame, 5000) / 5000; // up to 2x at 5000 fame

  const bookPromoTour = useMutation({
    mutationFn: async (packageId: string) => {
      const pkg = PROMO_PACKAGES.find((p) => p.id === packageId);
      if (!pkg) throw new Error("Invalid package");

      const totalCost = pkg.dailyCost * pkg.days;
      if (playerCash < totalCost) throw new Error(`Not enough cash (need $${totalCost.toLocaleString()})`);
      if (playerHealth <= 30) throw new Error("Your health is too low to start a promo tour. Rest first!");

      // Create scheduled activities for each day
      const startHour = timeSlot === "morning" ? 8 : 13;
      const tomorrow = addDays(new Date(), 1);

      for (let day = 0; day < pkg.days; day++) {
        const dayDate = addDays(tomorrow, day);
        const start = setMinutes(setHours(dayDate, startHour), 0);
        const end = setMinutes(setHours(dayDate, startHour + 6), 0);
        const activity = PROMO_DAILY_ACTIVITIES[day % PROMO_DAILY_ACTIVITIES.length];

        await createScheduledActivity({
          userId,
          bandId,
          activityType: "release_promo" as any,
          scheduledStart: start,
          scheduledEnd: end,
          title: `Promo: ${activity.label}`,
          description: `Day ${day + 1} of ${pkg.name} for "${releaseTitle}"`,
          metadata: {
            release_id: releaseId,
            package_id: pkg.id,
            day_number: day + 1,
            total_days: pkg.days,
            hype_value: Math.round(activity.hype * fameMultiplier),
            health_drain: activity.healthDrain,
            energy_cost: activity.energyCost,
            daily_cost: pkg.dailyCost,
          },
        });
      }

      // Create campaign record
      const startDate = addDays(new Date(), 1);
      const endDate = addDays(startDate, pkg.days);

      await (supabase.from("promotional_campaigns" as any) as any).insert({
        release_id: releaseId,
        campaign_type: "promo_tour",
        campaign_name: `${pkg.name} Promo Tour`,
        budget: totalCost,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: "active",
        effects: {
          package_id: pkg.id,
          total_days: pkg.days,
          daily_cost: pkg.dailyCost,
          time_slot: timeSlot,
          fame_multiplier: fameMultiplier,
        },
      });

      // Deduct cost from player cash
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", userId)
        .single();

      if (profile) {
        await supabase
          .from("profiles")
          .update({ cash: (profile.cash ?? 0) - totalCost })
          .eq("user_id", userId);
      }

      return pkg;
    },
    onSuccess: (pkg) => {
      queryClient.invalidateQueries({ queryKey: ["promo-tour", releaseId] });
      queryClient.invalidateQueries({ queryKey: ["promo-tour-days", releaseId] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`${pkg.name} booked!`, {
        description: `${pkg.days} promo days scheduled starting tomorrow`,
      });
      setSelectedPackage("");
    },
    onError: (error) => toast.error("Booking failed", { description: error.message }),
  });

  const selectedPkg = PROMO_PACKAGES.find((p) => p.id === selectedPackage);

  // Active tour progress view
  if (activeTour) {
    const totalDays = (activeTour.effects as any)?.total_days || 3;
    const daysCompleted = completedDays?.filter((d: any) => d.status === "completed").length || 0;
    const daysScheduled = completedDays?.filter((d: any) => d.status === "scheduled" || d.status === "in_progress").length || 0;
    const progress = (daysCompleted / totalDays) * 100;
    const totalHypeEstimate = completedDays?.reduce(
      (sum: number, d: any) => sum + (d.metadata?.hype_value || 0),
      0
    ) || 0;

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Promo Tour in Progress</CardTitle>
          </div>
          <CardDescription>{activeTour.campaign_name} for "{releaseTitle}"</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>Progress: {daysCompleted}/{totalDays} days</span>
            <Badge variant={daysCompleted === totalDays ? "default" : "secondary"}>
              {daysCompleted === totalDays ? (
                <><CheckCircle2 className="h-3 w-3 mr-1" />Complete</>
              ) : (
                <><Clock className="h-3 w-3 mr-1" />{daysScheduled} remaining</>
              )}
            </Badge>
          </div>
          <Progress value={progress} className="h-3" />

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-2 rounded-lg bg-secondary/50">
              <p className="text-muted-foreground">Hype Earned</p>
              <p className="font-bold text-primary">+{totalHypeEstimate}</p>
            </div>
            <div className="p-2 rounded-lg bg-secondary/50">
              <p className="text-muted-foreground">Budget Spent</p>
              <p className="font-bold">${activeTour.budget?.toLocaleString()}</p>
            </div>
          </div>

          {completedDays && completedDays.length > 0 && (
            <div className="space-y-1">
              {completedDays.map((day: any, idx: number) => (
                <div key={day.id} className="flex items-center justify-between text-xs p-2 border rounded">
                  <span className="truncate flex-1">{day.title}</span>
                  <Badge
                    variant={day.status === "completed" ? "default" : "outline"}
                    className="text-[10px] ml-2"
                  >
                    {day.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Booking view
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Promo Tour</CardTitle>
        </div>
        <CardDescription>
          Hit the streets, airwaves, and socials to build hype for "{releaseTitle}"
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedPackage} onValueChange={setSelectedPackage}>
          <SelectTrigger>
            <SelectValue placeholder="Choose promo tour package..." />
          </SelectTrigger>
          <SelectContent>
            {PROMO_PACKAGES.map((pkg) => (
              <SelectItem key={pkg.id} value={pkg.id}>
                {pkg.name} — {pkg.days} days (${(pkg.dailyCost * pkg.days).toLocaleString()})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedPkg && (
          <div className="space-y-3">
            <div className="p-3 bg-secondary/50 rounded-lg text-sm space-y-2">
              <p>{selectedPkg.description}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-500" />
                  <span>~{Math.round(selectedPkg.days * 30 * fameMultiplier)} total hype</span>
                </div>
                <div className="flex items-center gap-1">
                  <Heart className="h-3 w-3 text-red-500" />
                  <span className={selectedPkg.warningColor}>{selectedPkg.healthWarning} impact</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-yellow-500" />
                  <span>~{selectedPkg.days * 20} energy drain</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>6 hrs/day blocked</span>
                </div>
              </div>
              <p className="text-muted-foreground mt-1">
                Total cost: <span className="font-bold">${(selectedPkg.dailyCost * selectedPkg.days).toLocaleString()}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Time Slot</Label>
              <RadioGroup
                value={timeSlot}
                onValueChange={(v) => setTimeSlot(v as "morning" | "afternoon")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="morning" id="morning" />
                  <Label htmlFor="morning" className="text-sm">Morning (8am–2pm)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="afternoon" id="afternoon" />
                  <Label htmlFor="afternoon" className="text-sm">Afternoon (1pm–7pm)</Label>
                </div>
              </RadioGroup>
            </div>

            {playerHealth <= 30 && (
              <div className="flex items-center gap-2 text-destructive text-xs p-2 border border-destructive/30 rounded">
                <AlertTriangle className="h-4 w-4" />
                Health too low — rest before booking a promo tour
              </div>
            )}

            {playerCash < selectedPkg.dailyCost * selectedPkg.days && (
              <div className="flex items-center gap-2 text-destructive text-xs p-2 border border-destructive/30 rounded">
                <AlertTriangle className="h-4 w-4" />
                Not enough cash (need ${(selectedPkg.dailyCost * selectedPkg.days).toLocaleString()})
              </div>
            )}
          </div>
        )}

        <Button
          onClick={() => bookPromoTour.mutate(selectedPackage)}
          disabled={
            !selectedPackage ||
            bookPromoTour.isPending ||
            playerHealth <= 30 ||
            (selectedPkg ? playerCash < selectedPkg.dailyCost * selectedPkg.days : true)
          }
          className="w-full"
        >
          {bookPromoTour.isPending ? "Booking..." : "Book Promo Tour"}
        </Button>
      </CardContent>
    </Card>
  );
};
