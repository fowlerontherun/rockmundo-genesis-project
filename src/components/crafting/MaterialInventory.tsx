import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import type { CraftingMaterial, PlayerCraftingMaterial } from "@/hooks/useCraftingSystem";

const RARITY_COLORS: Record<string, string> = {
  common: "bg-muted text-muted-foreground",
  uncommon: "bg-green-500/20 text-green-400 border-green-500/30",
  rare: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  epic: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  legendary: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const CATEGORY_EMOJI: Record<string, string> = {
  wood: "🪵",
  electronics: "⚡",
  hardware: "🔩",
  strings: "🎸",
  finish: "🎨",
  pedal_components: "🎛️",
  amp_components: "🔊",
};

interface MaterialInventoryProps {
  materialsCatalog: CraftingMaterial[];
  playerMaterials: PlayerCraftingMaterial[];
  onPurchase: (materialId: string, quantity: number) => void;
  isPurchasing: boolean;
  mode?: "inventory" | "shop";
}

export const MaterialInventory = ({
  materialsCatalog,
  playerMaterials,
  onPurchase,
  isPurchasing,
  mode = "inventory",
}: MaterialInventoryProps) => {
  const categories = ["wood", "electronics", "hardware", "strings", "finish", "pedal_components", "amp_components"];

  const displayMaterials = mode === "inventory"
    ? materialsCatalog.filter((m) => playerMaterials.some((pm) => pm.material_id === m.id && pm.quantity > 0))
    : materialsCatalog;

  if (mode === "inventory" && displayMaterials.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No materials in inventory yet.</p>
        <p className="text-xs mt-1">Purchase materials from the Shop tab or earn them from gigs!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map((cat) => {
        const catMaterials = displayMaterials.filter((m) => m.category === cat);
        if (catMaterials.length === 0) return null;

        return (
          <div key={cat}>
            <h3 className="text-sm font-semibold mb-2 capitalize flex items-center gap-1.5">
              {CATEGORY_EMOJI[cat]} {cat}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {catMaterials.map((mat) => {
                const owned = playerMaterials.find((pm) => pm.material_id === mat.id);
                const qty = owned?.quantity || 0;

                return (
                  <Card key={mat.id} className="border-border/50">
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{mat.name}</span>
                          <Badge className={RARITY_COLORS[mat.rarity] || RARITY_COLORS.common} variant="outline">
                            {mat.rarity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{mat.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {mode === "inventory" ? (
                          <Badge variant="secondary" className="text-xs">×{qty}</Badge>
                        ) : (
                          <>
                            <span className="text-xs text-muted-foreground">${mat.base_cost}</span>
                            {qty > 0 && <Badge variant="secondary" className="text-xs">×{qty}</Badge>}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isPurchasing}
                              onClick={() => onPurchase(mat.id, 1)}
                              className="h-7 px-2"
                            >
                              <ShoppingCart className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
