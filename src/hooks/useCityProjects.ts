import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import type { CityProject, CityProjectType } from "@/types/city-projects";

const PROJECT_ERROR_MESSAGES: Record<string, string> = {
  city_governance_auth_required: "You must be logged in to manage city projects.",
  city_governance_profile_forbidden: "That character does not belong to your account.",
  city_project_mayor_required: "Only the current mayor can manage city projects.",
  city_project_type_not_found: "That city project is no longer available.",
  city_project_skill_required: "Your politics skills do not meet this project's requirement.",
  city_project_insufficient_treasury: "The city treasury does not have enough available funds.",
  city_project_not_found: "City project not found.",
  city_project_not_in_progress: "Only an in-progress project can be cancelled.",
};

function projectError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String((error as any)?.message ?? error ?? "Unknown error");
  const code = Object.keys(PROJECT_ERROR_MESSAGES).find((key) => raw.includes(key));
  return new Error(code ? PROJECT_ERROR_MESSAGES[code] : raw);
}

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

// Projects for a specific city. Completion is handled by the server governance tick.
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
    refetchInterval: 60_000,
  });
}

// Propose a new project. The database calculates the skill discount and final price.
export function useProposeCityProject() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async ({
      cityId,
      projectTypeId,
    }: {
      cityId: string;
      projectTypeId: string;
    }) => {
      if (!profileId) throw new Error("Must be logged in");

      const { data, error } = await (supabase as any).rpc("propose_city_project", {
        p_city_id: cityId,
        p_project_type_id: projectTypeId,
        p_profile_id: profileId,
      });
      if (error) throw projectError(error);
      return data;
    },
    onSuccess: (_, { cityId }) => {
      queryClient.invalidateQueries({ queryKey: ["city-projects", cityId] });
      queryClient.invalidateQueries({ queryKey: ["city-treasury", cityId] });
      queryClient.invalidateQueries({ queryKey: ["mayor-actions-log", cityId] });
      toast.success("Project started and treasury funds reserved.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// Cancel a project through the same transaction authority that settles projects.
export function useCancelCityProject() {
  const queryClient = useQueryClient();
  const { profileId } = useActiveProfile();

  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string; cityId: string }) => {
      if (!profileId) throw new Error("Must be logged in");

      const { data, error } = await (supabase as any).rpc("cancel_city_project", {
        p_project_id: projectId,
        p_profile_id: profileId,
      });
      if (error) throw projectError(error);
      return data;
    },
    onSuccess: (_, { cityId }) => {
      queryClient.invalidateQueries({ queryKey: ["city-projects", cityId] });
      queryClient.invalidateQueries({ queryKey: ["city-treasury", cityId] });
      queryClient.invalidateQueries({ queryKey: ["city-mayor", cityId] });
      queryClient.invalidateQueries({ queryKey: ["mayor-actions-log", cityId] });
      toast.success("Project cancelled. 50% of its cost was recorded as sunk expenditure.");
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
