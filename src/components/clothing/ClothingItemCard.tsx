import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Star } from "lucide-react";
import {
  CATEGORY_EMOJIS,
  RARITY_COLORS,
  type ClothingCategory,
} from "@/utils/clothingQuality";
import type { MarketplaceItem } from "@/hooks/useClothingMarketplace";

interface ClothingItemCardProps {
  item: MarketplaceItem;
  onPurchase?: (item: MarketplaceItem) => void;
  isOwn?: boolean;
}

export const ClothingItemCard = ({ item, onPurchase, isOwn }: ClothingItemCardProps) => {
  const emoji = CATEGORY_EMOJIS[item.category as ClothingCategory] || "👕";
  const rarityClass = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 group">
      <div className="relative h-32 bg-card flex items-center justify-center">
        <span className="text-5xl group-hover:scale-110 transition-transform">{emoji}</span>
        <Badge
          variant="outline"
          className={`absolute top-2 right-2 text-xs capitalize ${rarityClass}`}
        >
          {item.rarity}
        </Badge>
      </div>

      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground capitalize">{item.category}</span>
          <span className="text-xs text-muted-foreground capitalize">{item.genre_style.replace("_", " ")}</span>
        </div>

        <h4 className="font-medium text-foreground truncate">{item.name}</h4>

        {item.brand && (
          <p className="text-xs text-muted-foreground truncate">
            by {item.brand.brand_name}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-warning" />
            Q:{item.quality_score}
          </span>
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-primary" />
            S:{item.style_score}
          </span>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="font-bold text-foreground">
            ${item.sale_price.toLocaleString()}
          </span>
          {isOwn ? (
            <span className="text-xs text-muted-foreground">
              Stock: {item.stock_quantity}
            </span>
          ) : onPurchase ? (
            <Button size="sm" onClick={() => onPurchase(item)} className="gap-1">
              <ShoppingCart className="h-3 w-3" />
              Buy
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};
