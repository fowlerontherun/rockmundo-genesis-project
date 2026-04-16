import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { toast } from "sonner";

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
        .order("started_at", { ascending: false });
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

      // Check balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("cash")
        .eq("id", profileId)
        .single();

      if (!profile || profile.cash < totalCost) throw new Error("Insufficient funds");

      // Deduct cost
      await supabase
        .from("profiles")
        .update({ cash: profile.cash - totalCost })
        .eq("id", profileId);

      // Upsert material inventory
      const existing = playerMaterials.find((pm) => pm.material_id === materialId);
      if (existing) {
        const { error } = await (supabase as any)
          .from("player_crafting_materials")
          .update({ quantity: existing.quantity + quantity })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("player_crafting_materials")
          .insert({ profile_id: profileId, material_id: materialId, quantity });
        if (error) throw error;
      }
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

      // Check materials
      for (const req of recipe.materials_required) {
        const owned = playerMaterials.find((pm) => pm.material_id === req.material_id);
        if (!owned || owned.quantity < req.quantity) {
          throw new Error("Missing required materials");
        }
      }

      // Deduct materials
      for (const req of recipe.materials_required) {
        const owned = playerMaterials.find((pm) => pm.material_id === req.material_id)!;
        const newQty = owned.quantity - req.quantity;
        if (newQty <= 0) {
          await (supabase as any)
            .from("player_crafting_materials")
            .delete()
            .eq("id", owned.id);
        } else {
          await (supabase as any)
            .from("player_crafting_materials")
            .update({ quantity: newQty })
            .eq("id", owned.id);
        }
      }

      // Create session
      const completesAt = new Date(Date.now() + recipe.base_craft_time_minutes * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from("crafting_sessions")
        .insert({
          profile_id: profileId,
          recipe_id: recipeId,
          completes_at: completesAt,
          status: "in_progress",
        })
        .select()
        .single();
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
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) throw new Error("Session not found");
      if (new Date(session.completes_at) > new Date()) throw new Error("Not ready yet");

      // Quality roll: 0-100, influenced by difficulty
      const baseRoll = Math.random() * 100;
      const qualityRoll = Math.min(100, Math.max(0, baseRoll));
      const bonusStats: Record<string, number> = {};

      if (qualityRoll >= 95) {
        bonusStats.fame_bonus = 15;
        bonusStats.quality_bonus = 20;
      } else if (qualityRoll >= 80) {
        bonusStats.fame_bonus = 10;
        bonusStats.quality_bonus = 10;
      } else if (qualityRoll >= 60) {
        bonusStats.quality_bonus = 5;
      } else if (qualityRoll < 20) {
        bonusStats.quality_penalty = -10;
      }

      const { error } = await (supabase as any)
        .from("crafting_sessions")
        .update({
          status: "collected",
          quality_roll: qualityRoll,
          bonus_stats: bonusStats,
        })
        .eq("id", sessionId);
      if (error) throw error;

      return { qualityRoll, bonusStats };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["crafting-sessions", profileId] });
      const label = result.qualityRoll >= 95 ? "Masterwork" : result.qualityRoll >= 80 ? "Excellent" : result.qualityRoll >= 60 ? "Superior" : result.qualityRoll >= 40 ? "Quality" : result.qualityRoll >= 20 ? "Standard" : "Flawed";
      toast.success(`Crafting complete! Quality: ${label}`);
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
  };
};
