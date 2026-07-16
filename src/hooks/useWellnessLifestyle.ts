import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

export interface LifestyleCatalogEntry {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  accent_color: string;
  bonuses: string[];
  penalties: string[];
  modifiers: Record<string, unknown>;
  switch_cost: number;
  sort_order: number;
}

export interface PlayerLifestyleRow {
  id: string;
  profile_id: string;
  lifestyle_slug: string;
  started_at: string;
  switch_available_at: string;
  total_switches: number;
}

export function useLifestyleCatalog() {
  return useQuery({
    queryKey: ["wellness-lifestyles-catalog"],
    queryFn: async (): Promise<LifestyleCatalogEntry[]> => {
      const { data, error } = await (supabase as any)
        .from("wellness_lifestyles")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function usePlayerLifestyle() {
  const { profileId } = useActiveProfile();
  return useQuery({
    queryKey: ["player-wellness-lifestyle", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<PlayerLifestyleRow | null> => {
      const { data, error } = await (supabase as any)
        .from("player_wellness_lifestyle")
        .select("*")
        .eq("profile_id", profileId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useSwitchLifestyle() {
  const qc = useQueryClient();
  const { profileId } = useActiveProfile();
  return useMutation({
    mutationFn: async (slug: string) => {
      const { data, error } = await (supabase as any).rpc("switch_wellness_lifestyle", { new_slug: slug });
      if (error) throw error;
      return data as PlayerLifestyleRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["player-wellness-lifestyle", profileId] });
      toast.success("Lifestyle updated");
    },
    onError: (e: any) => {
      toast.error(e?.message ?? "Couldn't switch lifestyle");
    },
  });
}
