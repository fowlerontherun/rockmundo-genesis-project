import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Lock, ShoppingCart, Check } from "lucide-react";
import { ClothingItem } from "@/hooks/useSkinStore";

interface ItemPreviewDialogProps {
  item: ClothingItem | null;
  isOwned: boolean;
  onClose: () => void;
  onPurchase: (item: ClothingItem) => void;
}

const rarityColors: Record<string, string> = {
  common: "bg-muted text-muted-foreground",
  uncommon: "bg-success/20 text-success",
  rare: "bg-primary/20 text-primary",
  epic: "bg-accent/20 text-accent",
  legendary: "bg-warning/20 text-warning",
};

export const ItemPreviewDialog = ({
  item,
  isOwned,
  onClose,
  onPurchase,
}: ItemPreviewDialogProps) => {
  if (!item) return null;

  const colorVariants = item.color_variants as string[] | null;

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {item.name}
            {item.is_limited_edition && (
              <Sparkles className="h-4 w-4 text-warning" />
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview Area */}
          <div className="aspect-square bg-gradient-to-br from-muted to-muted/50 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-2">
                {item.category === "shirt" && "👕"}
                {item.category === "pants" && "👖"}
                {item.category === "jacket" && "🧥"}
                {item.category === "shoes" && "👟"}
                {item.category === "accessory" && "💎"}
                {item.category === "hat" && "🎩"}
              </div>
              <p className="text-sm text-muted-foreground">3D Preview Coming Soon</p>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="capitalize">
                {item.category}
              </Badge>
              <Badge className={rarityColors[item.rarity || "common"]}>
                {item.rarity || "common"}
              </Badge>
            </div>

            {item.description && (
              <p className="text-sm text-muted-foreground">{item.description}</p>
            )}

            {/* Color Variants */}
            {colorVariants && colorVariants.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Available Colors</p>
                <div className="flex gap-2">
                  {colorVariants.map((color, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full border-2 border-border"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Price & Actions */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                {item.is_premium && <Lock className="h-4 w-4 text-warning" />}
                <span className="text-xl font-bold">
                  ${item.price?.toLocaleString() || "Free"}
                </span>
              </div>

              {isOwned ? (
                <Button disabled className="gap-2">
                  <Check className="h-4 w-4" />
                  Owned
                </Button>
              ) : (
                <Button onClick={() => onPurchase(item)} className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Purchase
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
