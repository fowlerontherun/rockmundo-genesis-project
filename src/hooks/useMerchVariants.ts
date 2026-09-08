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

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["merch-variants", merchandiseId] }),
      queryClient.invalidateQueries({ queryKey: ["player-merchandise"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async (input: VariantInput) => {
      if (!merchandiseId) throw new Error("No merchandise selected");
      const requestedAllocation = Math.max(0, input.stock_quantity ?? 0);
      const { data, error } = await (supabase as any)
        .from("merch_variants")
        .insert({
          merchandise_id: merchandiseId,
          size: input.size ?? null,
          color: input.color ?? null,
          sku: input.sku ?? null,
          stock_quantity: 0,
          cost_to_produce_override: input.cost_to_produce_override ?? null,
          selling_price_override: input.selling_price_override ?? null,
          is_active: input.is_active ?? true,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (requestedAllocation > 0) {
        const { error: allocationError } = await (supabase as any).rpc("allocate_merch_variant_stock", {
          p_variant_id: data.id,
          p_quantity: requestedAllocation,
        });
        if (allocationError) {
          await (supabase as any).from("merch_variants").delete().eq("id", data.id);
          throw allocationError;
        }
      }
      return requestedAllocation;
    },
    onSuccess: async (allocated) => {
      await invalidate();
      toast({
        title: "Variant created",
        description: allocated > 0 ? `${allocated} manufactured units were allocated from parent stock.` : "Variant created with no stock allocated yet.",
      });
    },
    onError: (e: Error) =>
      toast({ title: "Failed to create variant", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<MerchVariant> }) => {
      const safePatch = { ...patch };
      delete safePatch.stock_quantity;
      const { error } = await (supabase as any)
        .from("merch_variants")
        .update(safePatch)
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
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Variant removed", description: "Any unsold units were returned to the parent product." });
    },
  });

  const allocateMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      if (amount <= 0) throw new Error("Allocation must be greater than zero");
      const { error } = await (supabase as any).rpc("allocate_merch_variant_stock", {
        p_variant_id: id,
        p_quantity: amount,
      });
      if (error) throw error;
      return amount;
    },
    onSuccess: async (amount) => {
      await invalidate();
      toast({ title: "Stock allocated", description: `${amount} units moved from parent inventory into this variant.` });
    },
    onError: (e: Error) => toast({ title: "Allocation failed", description: e.message, variant: "destructive" }),
  });

  const releaseMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      if (amount <= 0) throw new Error("Release amount must be greater than zero");
      const { error } = await (supabase as any).rpc("release_merch_variant_stock", {
        p_variant_id: id,
        p_quantity: amount,
      });
      if (error) throw error;
      return amount;
    },
    onSuccess: async (amount) => {
      await invalidate();
      toast({ title: "Stock returned", description: `${amount} units moved back to unallocated parent inventory.` });
    },
    onError: (e: Error) => toast({ title: "Release failed", description: e.message, variant: "destructive" }),
  });

  return {
    variants,
    isLoading,
    createVariant: createMutation.mutate,
    updateVariant: updateMutation.mutate,
    deleteVariant: deleteMutation.mutate,
    allocateStock: allocateMutation.mutate,
    releaseStock: releaseMutation.mutate,
    isCreating: createMutation.isPending,
    isAllocating: allocateMutation.isPending || releaseMutation.isPending,
  };
};
