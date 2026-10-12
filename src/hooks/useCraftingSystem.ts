import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";
import { computeSalvageYields } from "@/utils/salvageYields";
import type { LuthieryBuildSelection } from "@/data/luthieryWorkbench";

export interface CraftingMaterial {
  id: string;
  name: string;
  category: string;
  rarity: string;
  quality_tier: number;
  base_cost: number;
  description: string | null;
  image_url: string | null;
}

export interface PlayerCraftingMaterial {
  id: string;
  profile_id: string;
  material_id: string;
  quantity: number;
  acquired_at: string;
  material?: CraftingMaterial;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  result_category: string;
  result_subcategory: string | null;
  required_skill_slug: string;
  min_skill_level: number;
  materials_required: { material_id: string; quantity: number }[];
  base_craft_time_minutes: number;
  difficulty_tier: number;
  rarity_output: string;
  description: string | null;
}

export interface CraftingSession {
  id: string;
  profile_id: string;
  recipe_id: string;
  started_at: string;
  completes_at: string;
  status: string;
  quality_roll: number | null;
  bonus_stats: Record<string, number> | null;
  result_equipment_id: string | null;
  recipe?: CraftingRecipe;
}

export interface CraftingBlueprint {
  id: string;
  profile_id: string;
  recipe_id: string;
  unlocked_at: string;
  source: string;
  recipe?: CraftingRecipe;
}

export interface LuthieryCraftResult {
  status: "completed" | "already_completed";
  craftId: string;
  equipmentId: string;
  playerEquipmentId: string;
  instrumentName: string;
  instrumentKind: "electric_guitar" | "electric_bass";
  rarity: string;
  qualityRoll: number;
  finalQuality: number;
  finalStats: Record<string, number>;
  xpAwarded?: number;
  xpSkillSlug?: string;
  skillProgress?: Record<string, unknown>;
  buildSpec: Record<string, unknown>;
}

export interface CreateLuthieryCraftInput {
  selection: LuthieryBuildSelection;
  idempotencyKey: string;
}

export const useCraftingSystem = () => {
  const { profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  // Fetch all crafting materials catalog
  const { data: materialsCatalog = [], isLoading: materialsLoading } = useQuery({
    queryKey: ["crafting-materials-catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("crafting_materials")
        .select("*")
        .order("category")
        .order("quality_tier");
      if (error) throw error;
      return data as CraftingMaterial[];
    },
  });

  // Fetch player's material inventory
  const { data: playerMaterials = [], isLoading: playerMaterialsLoading } = useQuery({
    queryKey: ["player-crafting-materials", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("player_crafting_materials")
        .select("*, material:crafting_materials(*)")
        .eq("profile_id", profileId);
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        material: d.material || undefined,
      })) as PlayerCraftingMaterial[];
    },
    enabled: !!profileId,
  });

  // Fetch all recipes
  const { data: recipes = [], isLoading: recipesLoading } = useQuery({
    queryKey: ["crafting-recipes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("crafting_recipes")
        .select("*")
        .order("difficulty_tier")
        .order("name");
      if (error) throw error;
      return data as CraftingRecipe[];
    },
  });

  // Fetch player blueprints
  const { data: blueprints = [], isLoading: blueprintsLoading } = useQuery({
    queryKey: ["crafting-blueprints", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("crafting_blueprints")
        .select("*, recipe:crafting_recipes(*)")
        .eq("profile_id", profileId);
      if (error) throw error;
      return data as CraftingBlueprint[];
    },
    enabled: !!profileId,
  });

  // Fetch active crafting sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["crafting-sessions", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data, error } = await (supabase as any)
        .from("crafting_sessions")
        .select("*, recipe:crafting_recipes(*)")
        .eq("profile_id", profileId)
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as CraftingSession[];
    },
    enabled: !!profileId,
  });

  // Purchase material
  const purchaseMaterial = useMutation({
    mutationFn: async ({ materialId, quantity }: { materialId: string; quantity: number }) => {
      if (!profileId) throw new Error("Not authenticated");
      const material = materialsCatalog.find((m) => m.id === materialId);
      if (!material) throw new Error("Material not found");

      const totalCost = material.base_cost * quantity;


      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 999) throw new Error("Invalid material quantity");
      const { error } = await (supabase as any).rpc("purchase_crafting_material_atomic", {
        p_profile_id: profileId, p_material_id: materialId, p_quantity: quantity,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-crafting-materials", profileId] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Materials purchased!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Start crafting session
  const startCrafting = useMutation({
    mutationFn: async ({ recipeId, customName }: { recipeId: string; customName?: string }) => {
      if (!profileId) throw new Error("Not authenticated");
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) throw new Error("Recipe not found");


      const { data, error } = await (supabase as any).rpc("start_crafting_session_atomic", {
        p_profile_id: profileId, p_recipe_id: recipeId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crafting-sessions", profileId] });
      queryClient.invalidateQueries({ queryKey: ["player-crafting-materials", profileId] });
      toast.success("Crafting started!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Collect completed craft
  const collectCraft = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!profileId) throw new Error("Not authenticated");

      const { data, error } = await (supabase as any).rpc("collect_crafting_session_atomic", {
        p_profile_id: profileId, p_session_id: sessionId,
      });
      if (error) throw error;
      if (!data || typeof data.qualityRoll !== "number") throw new Error("Craft collection response missing");
      return { qualityRoll: data.qualityRoll as number,
        bonusStats: data.bonusStats as Record<string, number>,
        equipmentId: data.equipmentId as string };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["crafting-sessions", profileId] });
      const label = result.qualityRoll >= 95 ? "Masterwork" : result.qualityRoll >= 80 ? "Excellent" : result.qualityRoll >= 60 ? "Superior" : result.qualityRoll >= 40 ? "Quality" : result.qualityRoll >= 20 ? "Standard" : "Flawed";
      toast.success(`Crafting complete! Quality: ${label}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Authoritative custom Luthiery craft. The client submits design choices only;
  // inventory, unlocks, quality and final stats are resolved in one server transaction.
  const craftCustomLuthieryInstrument = useMutation({
    mutationFn: async ({ selection, idempotencyKey }: CreateLuthieryCraftInput) => {
      if (!profileId) throw new Error("No active character selected");
      if (!idempotencyKey) throw new Error("Missing craft request key");

      const design = {
        instrumentName: selection.instrumentName,
        instrumentKind: selection.instrumentKind,
        shapeId: selection.shapeId,
        colour: selection.colour,
        finishId: selection.finishId,
        decal: selection.decal,
        parts: selection.parts,
      };

      const { data, error } = await (supabase as any).rpc("create_custom_luthiery_instrument", {
        p_profile_id: profileId,
        p_design: design,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        const code = String(error.message ?? "");
        const friendly = code.includes("luthiery_material_stock_insufficient")
          ? "You no longer have enough of the selected materials."
          : code.includes("luthiery_active_profile_required")
            ? "This craft belongs to a different character. Refresh the workshop and try again."
            : code.includes("luthiery_shape_locked") || code.includes("luthiery_part_locked") || code.includes("luthiery_finish_locked")
              ? "Your Luthiery level no longer unlocks part of this build."
              : code.includes("luthiery_idempotency_key_conflict")
                ? "This craft request changed after confirmation. Review the build again."
                : code.includes("luthiery_client_outcome_not_allowed")
                  ? "Invalid craft request."
                  : error.message;
        throw new Error(friendly);
      }

      if (!data || typeof data !== "object") {
        throw new Error("The Luthiery service returned an invalid result");
      }

      return data as LuthieryCraftResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["player-crafting-materials", profileId] });
      queryClient.invalidateQueries({ queryKey: ["player-equipment", profileId] });
      queryClient.invalidateQueries({ queryKey: ["skill-progress"] });
      queryClient.invalidateQueries({ queryKey: ["progression-snapshot"] });
      const xpSuffix = result.xpAwarded ? ` +${result.xpAwarded} Luthiery XP` : "";
      toast.success(`${result.instrumentName} crafted successfully!${xpSuffix}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Salvage equipment into crafting materials
  const salvageEquipment = useMutation({
    mutationFn: async ({ equipmentId }: { equipmentId: string }) => {
      if (!profileId) throw new Error("Not authenticated");


      const { data, error } = await (supabase as any).rpc("salvage_equipment_atomic", {
        p_profile_id: profileId, p_equipment_id: equipmentId,
      });
      if (error) throw error;
      if (!data || !Array.isArray(data.yields)) throw new Error("Salvage response missing");
      const yields = (data.yields as Array<{materialId: string; quantity: number}>).map(y => ({
        materialId: y.materialId,
        quantity: y.quantity,
        material: materialsCatalog.find(m => m.id === y.materialId) ?? { name: "Material" } as CraftingMaterial,
      }));
      return { yields, itemName: String(data.itemName ?? "Equipment") };
    },
    onSuccess: ({ yields, itemName }) => {
      queryClient.invalidateQueries({ queryKey: ["player-equipment", profileId] });
      queryClient.invalidateQueries({ queryKey: ["player-crafting-materials", profileId] });
      const summary = yields
        .map((y) => `${y.quantity}× ${y.material.name}`)
        .join(", ");
      toast.success(`${itemName} salvaged: ${summary}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    materialsCatalog,
    playerMaterials,
    recipes,
    blueprints,
    sessions,
    isLoading: materialsLoading || playerMaterialsLoading || recipesLoading || blueprintsLoading || sessionsLoading,
    purchaseMaterial: purchaseMaterial.mutate,
    isPurchasing: purchaseMaterial.isPending,
    startCrafting: startCrafting.mutate,
    isCrafting: startCrafting.isPending,
    collectCraft: collectCraft.mutate,
    isCollecting: collectCraft.isPending,
    craftCustomLuthieryInstrument: craftCustomLuthieryInstrument.mutateAsync,
    isCraftingCustomLuthiery: craftCustomLuthieryInstrument.isPending,
    salvageEquipment: salvageEquipment.mutate,
    isSalvaging: salvageEquipment.isPending,
  };
};
