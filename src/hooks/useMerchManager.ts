import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { generateRandomName } from "@/utils/nameGenerator";

export interface MerchManager {
  id: string;
  band_id: string;
  manager_name: string;
  monthly_salary: number;
  is_active: boolean;
  auto_restock_enabled: boolean;
  restock_threshold: number;
  restock_quantity: number;
  logistics_discount: number;
  hired_at: string;
  created_at: string;
}

export const useMerchManager = (bandId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: manager, isLoading } = useQuery({
    queryKey: ["merch-manager", bandId],
    queryFn: async () => {
      if (!bandId) return null;
      const { data, error } = await (supabase as any)
        .from("merch_managers")
        .select("*")
        .eq("band_id", bandId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data as MerchManager | null;
    },
    enabled: !!bandId,
  });

  const hireMutation = useMutation({
    mutationFn: async () => {
      if (!bandId) throw new Error("No band selected");
      const name = generateRandomName().split(" ").slice(0, 2).join(" ");
      const { error } = await (supabase as any)
        .from("merch_managers")
        .insert({
          band_id: bandId,
          manager_name: name,
          monthly_salary: 2000,
          is_active: true,
          auto_restock_enabled: true,
          restock_threshold: 10,
          restock_quantity: 50,
          logistics_discount: 0.02,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merch-manager", bandId] });
      toast({ title: "Manager hired!", description: "Your new merch manager is ready to work." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to hire manager", description: err.message, variant: "destructive" });
    },
  });

  const fireMutation = useMutation({
    mutationFn: async () => {
      if (!manager) throw new Error("No manager to fire");
      const { error } = await (supabase as any)
        .from("merch_managers")
        .update({ is_active: false })
        .eq("id", manager.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merch-manager", bandId] });
      toast({ title: "Manager fired", description: "Your merch manager has been let go." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to fire manager", description: err.message, variant: "destructive" });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<Pick<MerchManager, 'auto_restock_enabled' | 'restock_threshold' | 'restock_quantity'>>) => {
      if (!manager) throw new Error("No manager");
      const { error } = await (supabase as any)
        .from("merch_managers")
        .update(settings)
        .eq("id", manager.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merch-manager", bandId] });
    },
  });

  const logisticsRate = manager ? 0.05 - manager.logistics_discount : 0.05;

  return {
    manager,
    isLoading,
    logisticsRate,
    hireManager: hireMutation.mutate,
    isHiring: hireMutation.isPending,
    fireManager: fireMutation.mutate,
    isFiring: fireMutation.isPending,
    updateSettings: updateSettingsMutation.mutate,
  };
};
