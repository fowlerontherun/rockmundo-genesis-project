import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MerchVariant {
  id: string;
  merchandise_id: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  stock_quantity: number;
  cost_to_produce_override: number | null;
  selling_price_override: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VariantInput {
  size?: string | null;
  color?: string | null;
  sku?: string | null;
  stock_quantity?: number;
  cost_to_produce_override?: number | null;
  selling_price_override?: number | null;
  is_active?: boolean;
}

export const useMerchVariants = (merchandiseId: string | null) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: variants = [], isLoading } = useQuery({
    queryKey: ["merch-variants", merchandiseId],
    queryFn: async () => {
      if (!merchandiseId) return [] as MerchVariant[];
      const { data, error } = await (supabase as any)
        .from("merch_variants")
        .select("*")
        .eq("merchandise_id", merchandiseId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as MerchVariant[];
    },
    enabled: !!merchandiseId,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["merch-variants", merchandiseId] });

  const createMutation = useMutation({
    mutationFn: async (input: VariantInput) => {
      if (!merchandiseId) throw new Error("No merchandise selected");
      const { error } = await (supabase as any)
        .from("merch_variants")
        .insert({
          merchandise_id: merchandiseId,
          size: input.size ?? null,
          color: input.color ?? null,
          sku: input.sku ?? null,
          stock_quantity: input.stock_quantity ?? 0,
          cost_to_produce_override: input.cost_to_produce_override ?? null,
          selling_price_override: input.selling_price_override ?? null,
          is_active: input.is_active ?? true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Variant created" });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to create variant", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<MerchVariant> }) => {
      const { error } = await (supabase as any)
        .from("merch_variants")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("merch_variants")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Variant removed" });
    },
  });

  const restockMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const variant = variants.find((v) => v.id === id);
      if (!variant) throw new Error("Variant not found");
      const { error } = await (supabase as any)
        .from("merch_variants")
        .update({ stock_quantity: variant.stock_quantity + amount })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Variant restocked" });
    },
  });

  return {
    variants,
    isLoading,
    createVariant: createMutation.mutate,
    updateVariant: updateMutation.mutate,
    deleteVariant: deleteMutation.mutate,
    restockVariant: restockMutation.mutate,
    isCreating: createMutation.isPending,
  };
};
