import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

export interface HolidayDestination {
  name: string;
  durations: number[];
  costPerDay: number;
  healthPerDay: number;
  description: string;
  emoji: string;
}

export const HOLIDAY_DESTINATIONS: HolidayDestination[] = [
  { name: "Local Staycation", durations: [3, 5], costPerDay: 20, healthPerDay: 15, description: "Rest at home", emoji: "🏠" },
  { name: "Beach Resort", durations: [5, 7], costPerDay: 80, healthPerDay: 20, description: "Sun and relaxation", emoji: "🏖️" },
  { name: "Mountain Cabin", durations: [3, 7], costPerDay: 50, healthPerDay: 18, description: "Fresh air and peace", emoji: "🏔️" },
  { name: "Tropical Island", durations: [7, 14], costPerDay: 150, healthPerDay: 25, description: "Ultimate getaway", emoji: "🌴" },
  { name: "Countryside Retreat", durations: [3, 5], costPerDay: 40, healthPerDay: 17, description: "Quiet countryside", emoji: "🌻" },
  { name: "Spa Resort", durations: [5, 7], costPerDay: 120, healthPerDay: 22, description: "Luxury pampering", emoji: "🧖" },
];

export interface PlayerHoliday {
  id: string;
  user_id: string;
  destination: string;
  started_at: string;
  ends_at: string;
  duration_days: number;
  cost: number;
  health_boost_per_day: number;
  status: string;
  created_at: string;
}

export function useHolidays() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch active holiday
  const { data: activeHoliday, isLoading } = useQuery({
    queryKey: ["active-holiday", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("player_holidays")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as PlayerHoliday | null;
    },
    enabled: !!user?.id,
  });

  // Check cooldown (14 days since last completed holiday)
  const { data: canBookHoliday } = useQuery({
    queryKey: ["holiday-cooldown", user?.id],
    queryFn: async () => {
      if (!user?.id) return true;
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data } = await supabase
        .from("player_holidays")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["completed", "active"])
        .gte("created_at", fourteenDaysAgo.toISOString())
        .limit(1);

      return !data || data.length === 0;
    },
    enabled: !!user?.id,
  });

  // Book a holiday
  const bookHolidayMutation = useMutation({
    mutationFn: async ({ destination, durationDays }: { destination: HolidayDestination; durationDays: number }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const totalCost = destination.costPerDay * durationDays;

      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("user_id", user.id)
        .single();

      if ((profile?.cash ?? 0) < totalCost) {
        throw new Error(`Not enough cash. Need $${totalCost}`);
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);

      // Create holiday record
      const { error: holidayError } = await supabase
        .from("player_holidays")
        .insert({
          user_id: user.id,
          destination: destination.name,
          started_at: startDate.toISOString(),
          ends_at: endDate.toISOString(),
          duration_days: durationDays,
          cost: totalCost,
          health_boost_per_day: destination.healthPerDay,
          status: "active",
        });

      if (holidayError) throw holidayError;

      // Create blocking scheduled activity (blocks everything except songwriting)
      await (supabase as any).from("player_scheduled_activities").insert({
        user_id: user.id,
        activity_type: "holiday",
        scheduled_start: startDate.toISOString(),
        scheduled_end: endDate.toISOString(),
        title: `Holiday: ${destination.name}`,
        description: `${durationDays}-day ${destination.description.toLowerCase()}`,
        status: "in_progress",
        metadata: { songwriting_allowed: true },
      });

      // Deduct cost
      await supabase.from("profiles").update({ cash: (profile?.cash ?? 0) - totalCost }).eq("user_id", user.id);

      // Immediate health boost for first day
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("health")
        .eq("user_id", user.id)
        .single();

      const newHealth = Math.min(100, (currentProfile?.health ?? 0) + destination.healthPerDay);
      await supabase.from("profiles").update({ health: newHealth }).eq("user_id", user.id);

      return { destination: destination.name, durationDays, totalCost };
    },
    onSuccess: ({ destination, durationDays, totalCost }) => {
      queryClient.invalidateQueries({ queryKey: ["active-holiday"] });
      queryClient.invalidateQueries({ queryKey: ["holiday-cooldown"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`Booked ${durationDays}-day holiday to ${destination}! Cost: $${totalCost}`);
    },
    onError: (err) => toast.error(err.message),
  });

  // Cancel holiday early
  const cancelHolidayMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !activeHoliday) throw new Error("No active holiday");

      await supabase
        .from("player_holidays")
        .update({ status: "cancelled" })
        .eq("id", activeHoliday.id);

      // Complete the scheduled activity
      await (supabase as any)
        .from("player_scheduled_activities")
        .update({ status: "completed" })
        .eq("user_id", user.id)
        .eq("activity_type", "holiday")
        .eq("status", "in_progress");

      return {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-holiday"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.info("Holiday cancelled. No refund for remaining days.");
    },
    onError: (err) => toast.error(err.message),
  });

  // Calculate days remaining
  const daysRemaining = activeHoliday
    ? Math.max(0, Math.ceil((new Date(activeHoliday.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    activeHoliday,
    canBookHoliday: canBookHoliday ?? true,
    isLoading,
    bookHoliday: bookHolidayMutation.mutate,
    isBooking: bookHolidayMutation.isPending,
    cancelHoliday: cancelHolidayMutation.mutate,
    isCancelling: cancelHolidayMutation.isPending,
    daysRemaining,
  };
}
