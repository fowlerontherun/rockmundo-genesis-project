import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Hammer, Lock, CheckCircle, AlertTriangle } from "lucide-react";
import type { CraftingRecipe, CraftingMaterial, PlayerCraftingMaterial } from "@/hooks/useCraftingSystem";

const RARITY_COLORS: Record<string, string> = {
  common: "bg-muted text-muted-foreground",
  uncommon: "bg-green-500/20 text-green-400 border-green-500/30",
  rare: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  epic: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  legendary: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

interface CraftingRecipeCardProps {
  recipe: CraftingRecipe;
  materialsCatalog: CraftingMaterial[];
  playerMaterials: PlayerCraftingMaterial[];
  isUnlocked: boolean;
  onCraft: (recipeId: string) => void;
  isCrafting: boolean;
}

export const CraftingRecipeCard = ({
  recipe,
  materialsCatalog,
  playerMaterials,
  isUnlocked,
  onCraft,
  isCrafting,
}: CraftingRecipeCardProps) => {
  const materialsReq = recipe.materials_required || [];
  const hasAllMaterials = materialsReq.every((req) => {
    const owned = playerMaterials.find((pm) => pm.material_id === req.material_id);
    return owned && owned.quantity >= req.quantity;
  });

  const canCraft = isUnlocked && hasAllMaterials;

  return (
    <Card className={`border ${isUnlocked ? "border-border" : "border-border/50 opacity-60"}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {!isUnlocked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
              <h4 className="font-semibold text-sm truncate">{recipe.name}</h4>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{recipe.description}</p>
          </div>
          <Badge className={RARITY_COLORS[recipe.rarity_output] || RARITY_COLORS.common} variant="outline">
            {recipe.rarity_output}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>⏱ {recipe.base_craft_time_minutes}min</span>
          <span>📊 Tier {recipe.difficulty_tier}</span>
          <span>🎯 Lv.{recipe.min_skill_level}+</span>
        </div>

        {/* Materials list */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Materials Required:</p>
          <div className="grid gap-1">
            {materialsReq.map((req, i) => {
              const mat = materialsCatalog.find((m) => m.id === req.material_id);
              const owned = playerMaterials.find((pm) => pm.material_id === req.material_id);
              const ownedQty = owned?.quantity || 0;
              const enough = ownedQty >= req.quantity;

              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className={enough ? "text-foreground" : "text-destructive"}>
                    {mat?.name || "Unknown Material"}
                  </span>
                  <span className={enough ? "text-green-400" : "text-destructive"}>
                    {ownedQty}/{req.quantity}
                    {enough ? <CheckCircle className="inline w-3 h-3 ml-1" /> : <AlertTriangle className="inline w-3 h-3 ml-1" />}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <Button
          size="sm"
          className="w-full"
          disabled={!canCraft || isCrafting}
          onClick={() => onCraft(recipe.id)}
        >
          <Hammer className="w-3.5 h-3.5 mr-1" />
          {!isUnlocked ? "Blueprint Locked" : !hasAllMaterials ? "Missing Materials" : "Start Crafting"}
        </Button>
      </CardContent>
    </Card>
  );
};
