import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Zap, Heart, Star, Sparkles, BookOpen, Package, Clock, Loader2, DollarSign } from "lucide-react";
import type { InventoryItem } from "@/hooks/useUnderworldInventory";

const rarityStyles: Record<string, string> = {
  common: "border-muted bg-muted/20",
  uncommon: "border-green-500/50 bg-green-500/10",
  rare: "border-blue-500/50 bg-blue-500/10",
  epic: "border-purple-500/50 bg-purple-500/10",
  legendary: "border-yellow-500/50 bg-yellow-500/10",
};

const categoryIcons: Record<string, React.ElementType> = {
  consumable: Zap,
  booster: Sparkles,
  skill_book: BookOpen,
  collectible: Package,
};

interface ItemDetailDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUse: () => void;
  isUsing: boolean;
}

export const ItemDetailDialog = ({
  item,
  open,
  onOpenChange,
  onUse,
  isUsing,
}: ItemDetailDialogProps) => {
  if (!item || !item.product) return null;

  const product = item.product;
  const effects = product.effects || {};
  const CategoryIcon = categoryIcons[product.category] || Package;
  const rarityClass = rarityStyles[product.rarity] || rarityStyles.common;

  const getEffectDescription = (key: string, value: number | string) => {
    const effectLabels: Record<string, string> = {
      health: "Health",
      energy: "Energy",
      xp: "Experience",
      fame: "Fame",
      cash: "Cash",
      xp_multiplier: "XP Multiplier",
      fame_multiplier: "Fame Multiplier",
      energy_regen: "Energy Regen",
      all_multiplier: "All Stats Multiplier",
      skill_xp: "Skill XP",
      skill_slug: "Skill",
    };
    return { label: effectLabels[key] || key, value: String(value) };
  };

  const effectIcons: Record<string, React.ElementType> = {
    health: Heart,
    energy: Zap,
    xp: Star,
    fame: Sparkles,
    cash: DollarSign,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-md border-2 ${rarityClass}`}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <CategoryIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">{product.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="capitalize">
                  {product.category.replace("_", " ")}
                </Badge>
                <Badge variant="secondary" className="capitalize">
                  {product.rarity}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {product.description && (
            <p className="text-muted-foreground">{product.description}</p>
          )}

          {product.lore && (
            <div className="rounded-lg bg-muted/30 p-3 italic text-sm text-muted-foreground border-l-2 border-primary/50">
              "{product.lore}"
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Effects</h4>
            <div className="grid gap-2">
              {Object.entries(effects).map(([key, value]) => {
                if (key === "skill_slug") return null;
                const { label, value: displayValue } = getEffectDescription(key, value);
                const Icon = effectIcons[key] || Sparkles;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="text-sm">{label}</span>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`font-mono ${Number(value) < 0 ? 'text-destructive border-destructive/50' : 'text-green-600 border-green-500/50'}`}
                    >
                      {Number(value) >= 0 ? '+' : ''}{displayValue}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {product.duration_hours && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Duration: {product.duration_hours} hours</span>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Purchased: {new Date(item.created_at).toLocaleDateString()}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={onUse} disabled={isUsing}>
            {isUsing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Using...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Use Item
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
