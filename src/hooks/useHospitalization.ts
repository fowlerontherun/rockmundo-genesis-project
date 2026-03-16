import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
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
  profile_id?: string;
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
  const { profileId, profile: activeProfile } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: nearestHospital, isLoading: hospitalLoading } = useQuery({
    queryKey: ["nearest-hospital", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("current_city_id")
        .eq("id", profileId)
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
    enabled: !!profileId,
  });

  const { data: activeHospitalization, isLoading: hospitalizationLoading } = useQuery({
    queryKey: ["active-hospitalization", profileId],
    queryFn: async () => {
      if (!profileId) return null;
      const { data } = await (supabase as any)
        .from("player_hospitalizations")
        .select("*")
        .eq("profile_id", profileId)
        .eq("status", "admitted")
        .order("admitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return data as Hospitalization | null;
    },
    enabled: !!profileId,
  });

  const checkInMutation = useMutation({
    mutationFn: async (params?: { conditionId?: string; reason?: string }) => {
      if (!user?.id || !profileId || !nearestHospital) throw new Error("No hospital available");

      const { data: profile } = await supabase
        .from("profiles")
        .select("health, cash")
        .eq("id", profileId)
        .single();

      if (!profile) throw new Error("Profile not found");

      const health = profile.health ?? 100;
      const reason = params?.reason || "health_collapse";

      if (reason === "health_collapse" && health > 30) {
        throw new Error("Health must be below 30 to check in for health collapse");
      }

      const stayDays = params?.conditionId ? 2 : (health <= 10 ? 3 : health <= 20 ? 2 : 1);
      const dischargeAt = new Date();
      dischargeAt.setDate(dischargeAt.getDate() + stayDays);

      const totalCost = nearestHospital.is_free ? 0 : nearestHospital.cost_per_day * stayDays;

      if (!nearestHospital.is_free && profile.cash < totalCost) {
        throw new Error(`Not enough cash for hospital stay ($${totalCost} needed)`);
      }

      const { error: hospError } = await (supabase as any)
        .from("player_hospitalizations")
        .insert({
          user_id: user.id,
          profile_id: profileId,
          hospital_id: nearestHospital.id,
          admitted_at: new Date().toISOString(),
          expected_discharge_at: dischargeAt.toISOString(),
          status: "admitted",
          total_cost: totalCost,
          health_on_admission: health,
          reason,
          condition_id: params?.conditionId || null,
        });

      if (hospError) throw hospError;

      await (supabase as any).from("player_scheduled_activities").insert({
        user_id: user.id,
        profile_id: profileId,
        activity_type: "hospital",
        scheduled_start: new Date().toISOString(),
        scheduled_end: dischargeAt.toISOString(),
        title: `Hospital Stay - ${nearestHospital.name}`,
        description: `Recovering at ${nearestHospital.name} for ${stayDays} day(s)`,
        status: "in_progress",
      });

      if (totalCost > 0) {
        await supabase
          .from("profiles")
          .update({ cash: profile.cash - totalCost })
          .eq("id", profileId);
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

  const dischargeMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profileId || !activeHospitalization) throw new Error("No active hospitalization");

      const admittedAt = new Date(activeHospitalization.admitted_at);
      const now = new Date();
      const hoursSpent = (now.getTime() - admittedAt.getTime()) / (1000 * 60 * 60);

      const recoveryPerHour = 50 / 10;
      const healthGain = Math.min(100, Math.round(recoveryPerHour * hoursSpent));

      await supabase
        .from("player_hospitalizations")
        .update({
          status: "discharged",
          actual_discharge_at: now.toISOString(),
        })
        .eq("id", activeHospitalization.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("health")
        .eq("id", profileId)
        .single();

      const newHealth = Math.min(100, (profile?.health ?? 0) + healthGain);
      await supabase
        .from("profiles")
        .update({
          health: newHealth,
          rest_required_until: null,
          last_health_update: now.toISOString(),
        })
        .eq("id", profileId);

      await (supabase as any)
        .from("player_scheduled_activities")
        .update({ status: "completed" })
        .eq("profile_id", profileId)
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
    // Get active profile for this user
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, current_city_id, health")
      .eq("user_id", userId)
      .eq("is_active", true)
      .is("died_at", null)
      .maybeSingle();

    if (!profile?.current_city_id) return;

    const { data: hospitals } = await supabase
      .from("hospitals")
      .select("*")
      .eq("city_id", profile.current_city_id)
      .order("effectiveness_rating", { ascending: false })
      .limit(1);

    const hospital = hospitals?.[0];
    if (!hospital) return;

    const stayDays = 2;
    const dischargeAt = new Date();
    dischargeAt.setDate(dischargeAt.getDate() + stayDays);

    await supabase.from("player_hospitalizations").insert({
      user_id: userId,
      profile_id: profile.id,
      hospital_id: hospital.id,
      admitted_at: new Date().toISOString(),
      expected_discharge_at: dischargeAt.toISOString(),
      status: "admitted",
      total_cost: hospital.is_free ? 0 : hospital.cost_per_day * stayDays,
      health_on_admission: profile.health ?? 0,
    });

    await (supabase as any).from("player_scheduled_activities").insert({
      user_id: userId,
      profile_id: profile.id,
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
