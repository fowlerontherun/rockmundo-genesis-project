import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { toast } from "sonner";

export interface Hospital {
  id: string;
  name: string;
  city_id: string;
  effectiveness_rating: number;
  cost_per_day: number;
  is_free: boolean;
}

export interface Hospitalization {
  id: string;
  user_id: string;
  hospital_id: string;
  admitted_at: string;
  expected_discharge_at: string;
  actual_discharge_at?: string | null;
  discharged_at?: string | null;
  status: string;
  total_cost: number;
  health_on_admission: number;
}

export function useHospitalization() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get the player's current city hospital
  const { data: nearestHospital, isLoading: hospitalLoading } = useQuery({
    queryKey: ["nearest-hospital", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      // Get player's current city
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_city_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.current_city_id) return null;

      const { data: hospitals } = await supabase
        .from("hospitals")
        .select("*")
        .eq("city_id", profile.current_city_id)
        .order("effectiveness_rating", { ascending: false })
        .limit(1);

      return (hospitals?.[0] as Hospital) || null;
    },
    enabled: !!user?.id,
  });

  // Get active hospitalization
  const { data: activeHospitalization, isLoading: hospitalizationLoading } = useQuery({
    queryKey: ["active-hospitalization", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("player_hospitalizations")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "admitted")
        .order("admitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return data as Hospitalization | null;
    },
    enabled: !!user?.id,
  });

  // Check in to hospital
  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !nearestHospital) throw new Error("No hospital available");

      const { data: profile } = await supabase
        .from("profiles")
        .select("health, cash")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const health = profile.health ?? 100;
      if (health > 30) throw new Error("Health must be below 30 to check in");

      // Calculate stay duration: 1-3 days based on how low health is
      const stayDays = health <= 10 ? 3 : health <= 20 ? 2 : 1;
      const dischargeAt = new Date();
      dischargeAt.setDate(dischargeAt.getDate() + stayDays);

      const totalCost = nearestHospital.is_free ? 0 : nearestHospital.cost_per_day * stayDays;

      if (!nearestHospital.is_free && profile.cash < totalCost) {
        throw new Error(`Not enough cash for hospital stay ($${totalCost} needed)`);
      }

      // Create hospitalization record
      const { error: hospError } = await supabase
        .from("player_hospitalizations")
        .insert({
          user_id: user.id,
          hospital_id: nearestHospital.id,
          admitted_at: new Date().toISOString(),
          expected_discharge_at: dischargeAt.toISOString(),
          status: "admitted",
          total_cost: totalCost,
          health_on_admission: health,
        });

      if (hospError) throw hospError;

      // Create a scheduled activity to block everything during stay
      await (supabase as any).from("player_scheduled_activities").insert({
        user_id: user.id,
        activity_type: "hospital",
        scheduled_start: new Date().toISOString(),
        scheduled_end: dischargeAt.toISOString(),
        title: `Hospital Stay - ${nearestHospital.name}`,
        description: `Recovering at ${nearestHospital.name} for ${stayDays} day(s)`,
        status: "in_progress",
      });

      // Deduct cost
      if (totalCost > 0) {
        await supabase
          .from("profiles")
          .update({ cash: profile.cash - totalCost })
          .eq("user_id", user.id);
      }

      return { stayDays, totalCost, hospitalName: nearestHospital.name };
    },
    onSuccess: ({ stayDays, totalCost, hospitalName }) => {
      queryClient.invalidateQueries({ queryKey: ["active-hospitalization"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`Admitted to ${hospitalName} for ${stayDays} day(s). Cost: $${totalCost}`);
    },
    onError: (err) => toast.error(err.message),
  });

  // Discharge (manual or auto)
  const dischargeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !activeHospitalization) throw new Error("No active hospitalization");

      // Calculate health recovery based on time spent
      const admittedAt = new Date(activeHospitalization.admitted_at);
      const now = new Date();
      const hoursSpent = (now.getTime() - admittedAt.getTime()) / (1000 * 60 * 60);

      // Recovery rate based on hospital effectiveness (default 50 if unknown)
      const recoveryPerHour = 50 / 10; // ~5 health per hour
      const healthGain = Math.min(100, Math.round(recoveryPerHour * hoursSpent));

      await supabase
        .from("player_hospitalizations")
        .update({
          status: "discharged",
          actual_discharge_at: now.toISOString(),
        })
        .eq("id", activeHospitalization.id);

      // Update health
      const { data: profile } = await supabase
        .from("profiles")
        .select("health")
        .eq("user_id", user.id)
        .single();

      const newHealth = Math.min(100, (profile?.health ?? 0) + healthGain);
      await supabase
        .from("profiles")
        .update({
          health: newHealth,
          rest_required_until: null,
          last_health_update: now.toISOString(),
        })
        .eq("user_id", user.id);

      // Complete the scheduled activity
      await (supabase as any)
        .from("player_scheduled_activities")
        .update({ status: "completed" })
        .eq("user_id", user.id)
        .eq("activity_type", "hospital")
        .eq("status", "in_progress");

      return { healthGain, newHealth };
    },
    onSuccess: ({ newHealth }) => {
      queryClient.invalidateQueries({ queryKey: ["active-hospitalization"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`Discharged from hospital. Health now at ${newHealth}%`);
    },
    onError: (err) => toast.error(err.message),
  });

  // Check if discharge is due
  const isDischargeDue = activeHospitalization
    ? new Date() >= new Date(activeHospitalization.expected_discharge_at)
    : false;

  return {
    nearestHospital,
    activeHospitalization,
    isLoading: hospitalLoading || hospitalizationLoading,
    checkIn: checkInMutation.mutate,
    isCheckingIn: checkInMutation.isPending,
    discharge: dischargeMutation.mutate,
    isDischarging: dischargeMutation.isPending,
    isDischargeDue,
  };
}

/**
 * Auto-hospitalize when health hits 0 - call from useHealthImpact
 */
export async function autoHospitalize(userId: string): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_city_id, health")
      .eq("user_id", userId)
      .single();

    if (!profile?.current_city_id) return;

    const { data: hospitals } = await supabase
      .from("hospitals")
      .select("*")
      .eq("city_id", profile.current_city_id)
      .order("effectiveness_rating", { ascending: false })
      .limit(1);

    const hospital = hospitals?.[0];
    if (!hospital) return;

    const stayDays = 2; // Default 2-day stay for auto-hospitalization
    const dischargeAt = new Date();
    dischargeAt.setDate(dischargeAt.getDate() + stayDays);

    await supabase.from("player_hospitalizations").insert({
      user_id: userId,
      hospital_id: hospital.id,
      admitted_at: new Date().toISOString(),
      expected_discharge_at: dischargeAt.toISOString(),
      status: "admitted",
      total_cost: hospital.is_free ? 0 : hospital.cost_per_day * stayDays,
      health_on_admission: profile.health ?? 0,
    });

    await (supabase as any).from("player_scheduled_activities").insert({
      user_id: userId,
      activity_type: "hospital",
      scheduled_start: new Date().toISOString(),
      scheduled_end: dischargeAt.toISOString(),
      title: `Emergency Hospital Stay - ${hospital.name}`,
      description: "Auto-admitted due to health collapse",
      status: "in_progress",
    });
  } catch (err) {
    console.error("Auto-hospitalization failed:", err);
  }
}
