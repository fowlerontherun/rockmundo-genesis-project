import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hammer, Package, ScrollText, Recycle, ShoppingCart } from "lucide-react";
import { useCraftingSystem } from "@/hooks/useCraftingSystem";
import { usePlayerEquipment } from "@/hooks/usePlayerEquipment";
import { CraftingRecipeCard } from "@/components/crafting/CraftingRecipeCard";
import { MaterialInventory } from "@/components/crafting/MaterialInventory";
import { CraftingProgress } from "@/components/crafting/CraftingProgress";
import { SalvagePanel } from "@/components/crafting/SalvagePanel";
import { CraftedItemReveal } from "@/components/crafting/CraftedItemReveal";

const CraftingWorkshop = () => {
  const {
    materialsCatalog,
    playerMaterials,
    recipes,
    blueprints,
    sessions,
    isLoading,
    purchaseMaterial,
    isPurchasing,
    startCrafting,
    isCrafting,
    collectCraft,
    isCollecting,
  } = useCraftingSystem();

  const { data: equipmentData } = usePlayerEquipment();
  const equipment = equipmentData?.items || [];

  const [revealData, setRevealData] = useState<{
    open: boolean;
    recipeName: string;
    qualityRoll: number;
    bonusStats: Record<string, number> | null;
  }>({ open: false, recipeName: "", qualityRoll: 0, bonusStats: null });

  const unlockedRecipeIds = new Set(blueprints.map((b) => b.recipe_id));
  const activeSessions = sessions.filter((s) => s.status === "in_progress" || s.status === "completed");

  const handleCollect = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    collectCraft(sessionId, {
      onSuccess: (result: any) => {
        setRevealData({
          open: true,
          recipeName: session?.recipe?.name || "Crafted Item",
          qualityRoll: result.qualityRoll,
          bonusStats: result.bonusStats,
        });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Hammer className="w-5 h-5 text-primary" />
            Crafting Workshop
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Build custom instruments from raw materials
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs">
            {blueprints.length} Blueprints
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {activeSessions.length} Active
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="blueprints">
        <TabsList className="w-full">
          <TabsTrigger value="blueprints" className="text-xs">
            <ScrollText className="w-3.5 h-3.5 mr-1" /> Blueprints
          </TabsTrigger>
          <TabsTrigger value="materials" className="text-xs">
            <Package className="w-3.5 h-3.5 mr-1" /> Materials
          </TabsTrigger>
          <TabsTrigger value="shop" className="text-xs">
            <ShoppingCart className="w-3.5 h-3.5 mr-1" /> Shop
          </TabsTrigger>
          <TabsTrigger value="progress" className="text-xs">
            <Hammer className="w-3.5 h-3.5 mr-1" /> Active
            {activeSessions.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center rounded-full">
                {activeSessions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="salvage" className="text-xs">
            <Recycle className="w-3.5 h-3.5 mr-1" /> Salvage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blueprints">
          {recipes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No recipes available yet. Check back soon!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recipes.map((recipe) => (
                <CraftingRecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  materialsCatalog={materialsCatalog}
                  playerMaterials={playerMaterials}
                  isUnlocked={unlockedRecipeIds.has(recipe.id)}
                  onCraft={(recipeId) => startCrafting({ recipeId })}
                  isCrafting={isCrafting}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="materials">
          <MaterialInventory
            materialsCatalog={materialsCatalog}
            playerMaterials={playerMaterials}
            onPurchase={(_id, _qty) => {}}
            isPurchasing={false}
            mode="inventory"
          />
        </TabsContent>

        <TabsContent value="shop">
          <MaterialInventory
            materialsCatalog={materialsCatalog}
            playerMaterials={playerMaterials}
            onPurchase={(materialId, quantity) => purchaseMaterial({ materialId, quantity })}
            isPurchasing={isPurchasing}
            mode="shop"
          />
        </TabsContent>

        <TabsContent value="progress">
          <CraftingProgress
            sessions={sessions}
            onCollect={handleCollect}
            isCollecting={isCollecting}
          />
        </TabsContent>

        <TabsContent value="salvage">
          <SalvagePanel equipment={equipment} />
        </TabsContent>
      </Tabs>

      <CraftedItemReveal
        open={revealData.open}
        onClose={() => setRevealData((prev) => ({ ...prev, open: false }))}
        recipeName={revealData.recipeName}
        qualityRoll={revealData.qualityRoll}
        bonusStats={revealData.bonusStats}
      />
    </div>
  );
};

export default CraftingWorkshop;
