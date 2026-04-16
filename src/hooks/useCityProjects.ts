import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import type { CityProject, CityProjectType } from "@/types/city-projects";

// All available project types
export function useCityProjectTypes() {
  return useQuery({
    queryKey: ["city-project-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("city_project_types")
        .select("*")
        .order("category")
        .order("base_cost");
      if (error) throw error;
      return (data || []) as unknown as CityProjectType[];
    },
  });
}

// Projects for a specific city
export function useCityProjects(cityId: string | undefined) {
  return useQuery({
    queryKey: ["city-projects", cityId],
    queryFn: async () => {
      if (!cityId) return [];
      const { data, error } = await supabase
        .from("city_projects")
        .select("*, project_type:city_project_types(*)")
        .eq("city_id", cityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CityProject[];
    },
    enabled: !!cityId,
  });
}

// Propose a new project
export function useProposeCityProject() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async ({
      cityId,
      projectTypeId,
      costOverride,
    }: {
      cityId: string;
      projectTypeId: string;
      costOverride?: number;
    }) => {
      if (!profileId) throw new Error("Must be logged in");

      // Verify mayor + fetch mayor row
      const { data: mayor, error: mayorError } = await supabase
        .from("city_mayors")
        .select("id")
        .eq("city_id", cityId)
        .eq("profile_id", profileId)
        .eq("is_current", true)
        .single();

      if (mayorError || !mayor) throw new Error("Only the current mayor can propose projects");

      // Fetch project type
      const { data: projectType, error: ptError } = await supabase
        .from("city_project_types")
        .select("*")
        .eq("id", projectTypeId)
        .single();
      if (ptError || !projectType) throw new Error("Project type not found");

      // Check treasury
      const { data: treasury } = await supabase
        .from("city_treasury")
        .select("balance, pending_commitments")
        .eq("city_id", cityId)
        .maybeSingle();

      const cost = costOverride ?? projectType.base_cost;
      const balance = treasury?.balance ?? 0;
      const committed = treasury?.pending_commitments ?? 0;
      const available = balance - committed;

      if (available < cost) {
        throw new Error(`Treasury has only $${available.toLocaleString()} available; need $${cost.toLocaleString()}`);
      }

      // Insert project
      const completesAt = new Date(Date.now() + projectType.duration_days * 24 * 60 * 60 * 1000);
      const { data: project, error: insertError } = await supabase
        .from("city_projects")
        .insert({
          city_id: cityId,
          mayor_id: mayor.id,
          project_type_id: projectTypeId,
          name: projectType.name,
          description: projectType.description,
          cost,
          duration_days: projectType.duration_days,
          status: 'in_progress',
          completes_at: completesAt.toISOString(),
          effects: projectType.effects,
          approval_change: projectType.approval_change,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Reserve funds
      if (treasury) {
        await supabase
          .from("city_treasury")
          .update({ pending_commitments: committed + cost })
          .eq("city_id", cityId);
      }

      // Log action
      await supabase.from("mayor_actions_log").insert({
        city_id: cityId,
        mayor_id: mayor.id,
        action_type: 'project_proposed',
        amount: cost,
        target_id: project.id,
        notes: `Proposed: ${projectType.name}`,
      });

      return project;
    },
    onSuccess: (_, { cityId }) => {
      queryClient.invalidateQueries({ queryKey: ["city-projects", cityId] });
      queryClient.invalidateQueries({ queryKey: ["city-treasury", cityId] });
      queryClient.invalidateQueries({ queryKey: ["mayor-actions-log", cityId] });
      toast.success("Project proposed and funds reserved!");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// Cancel a project
export function useCancelCityProject() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async ({ projectId, cityId }: { projectId: string; cityId: string }) => {
      if (!profileId) throw new Error("Must be logged in");

      const { data: project, error: pe } = await supabase
        .from("city_projects")
        .select("cost, status, mayor_id")
        .eq("id", projectId)
        .single();
      if (pe || !project) throw new Error("Project not found");
      if (project.status !== 'in_progress') throw new Error("Only in-progress projects can be cancelled");

      const { error } = await supabase
        .from("city_projects")
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq("id", projectId);
      if (error) throw error;

      // Refund 50% to treasury, release commitments
      const { data: treasury } = await supabase
        .from("city_treasury")
        .select("balance, pending_commitments")
        .eq("city_id", cityId)
        .maybeSingle();

      if (treasury) {
        const refund = Math.floor(project.cost * 0.5);
        await supabase
          .from("city_treasury")
          .update({
            pending_commitments: Math.max(0, (treasury.pending_commitments ?? 0) - project.cost),
            balance: (treasury.balance ?? 0) - (project.cost - refund),
          })
          .eq("city_id", cityId);
      }

      // Increase corruption slightly
      if (project.mayor_id) {
        const { data: mayor } = await supabase
          .from("city_mayors")
          .select("corruption_score, approval_rating")
          .eq("id", project.mayor_id)
          .single();
        if (mayor) {
          await supabase
            .from("city_mayors")
            .update({
              corruption_score: Math.min(100, (mayor.corruption_score ?? 0) + 3),
              approval_rating: Math.max(0, (mayor.approval_rating ?? 50) - 2),
            })
            .eq("id", project.mayor_id);
        }
      }

      await supabase.from("mayor_actions_log").insert({
        city_id: cityId,
        mayor_id: project.mayor_id,
        action_type: 'project_cancelled',
        amount: project.cost,
        target_id: projectId,
        notes: 'Cancelled in-progress project (50% refund)',
      });
    },
    onSuccess: (_, { cityId }) => {
      queryClient.invalidateQueries({ queryKey: ["city-projects", cityId] });
      queryClient.invalidateQueries({ queryKey: ["city-treasury", cityId] });
      queryClient.invalidateQueries({ queryKey: ["city-mayor", cityId] });
      toast.success("Project cancelled (50% of funds refunded)");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// City treasury
export function useCityTreasury(cityId: string | undefined) {
  return useQuery({
    queryKey: ["city-treasury", cityId],
    queryFn: async () => {
      if (!cityId) return null;
      const { data, error } = await supabase
        .from("city_treasury")
        .select("*")
        .eq("city_id", cityId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!cityId,
  });
}

// Mayor actions log
export function useMayorActionsLog(cityId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ["mayor-actions-log", cityId, limit],
    queryFn: async () => {
      if (!cityId) return [];
      const { data, error } = await supabase
        .from("mayor_actions_log")
        .select("*")
        .eq("city_id", cityId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!cityId,
  });
}
