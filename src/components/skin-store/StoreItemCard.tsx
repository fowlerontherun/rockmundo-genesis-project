import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Lock, Sparkles, Star, Crown } from "lucide-react";
import { CountdownTimer } from "./CountdownTimer";
import { ClothingItem } from "@/hooks/useSkinStore";

interface StoreItemCardProps {
  item: ClothingItem;
  isOwned: boolean;
  onPurchase: (item: ClothingItem) => void;
  onPreview?: (item: ClothingItem) => void;
}

const rarityColors: Record<string, string> = {
  common: "border-muted-foreground/30 text-muted-foreground",
  uncommon: "border-success/50 text-success",
  rare: "border-primary/50 text-primary",
  epic: "border-accent/50 text-accent",
  legendary: "border-warning/50 text-warning",
};

const rarityIcons: Record<string, React.ReactNode> = {
  common: null,
  uncommon: <Star className="h-3 w-3" />,
  rare: <Sparkles className="h-3 w-3" />,
  epic: <Sparkles className="h-3 w-3" />,
  legendary: <Crown className="h-3 w-3" />,
};

const categoryIcons: Record<string, string> = {
  shirt: "👕",
  pants: "👖",
  jacket: "🧥",
  shoes: "👟",
  accessory: "🎸",
  hat: "🎩",
};

export const StoreItemCard = ({
  item,
  isOwned,
  onPurchase,
  onPreview,
}: StoreItemCardProps) => {
  const rarity = item.rarity || "common";
  const rarityClass = rarityColors[rarity] || rarityColors.common;
  const isLimited = item.is_limited_edition && item.expiry_date;

  return (
    <Card
      className={`relative overflow-hidden hover:shadow-electric transition-all duration-300 group ${
        item.featured ? "ring-2 ring-warning/50" : ""
      }`}
    >
      {/* Featured Badge */}
      {item.featured && (
        <div className="absolute top-0 right-0 bg-warning text-warning-foreground px-2 py-0.5 text-xs font-semibold rounded-bl-lg z-10">
          Featured
        </div>
      )}

      {/* Item Preview */}
      <div className="relative h-36 bg-card flex items-center justify-center">
        <span className="text-5xl">
          {categoryIcons[item.category] || "👕"}
        </span>
        
        {/* Color Variants Preview */}
        {item.color_variants && Array.isArray(item.color_variants) && (
          <div className="absolute bottom-2 left-2 flex gap-1">
            {(item.color_variants as string[]).slice(0, 4).map((color, idx) => (
              <div
                key={idx}
                className="w-4 h-4 rounded-full border border-border"
                style={{ backgroundColor: color }}
              />
            ))}
            {item.color_variants.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{item.color_variants.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Owned Overlay */}
        {isOwned && (
          <div className="absolute inset-0 bg-success/20 flex items-center justify-center">
            <div className="bg-success rounded-full p-2">
              <Check className="h-6 w-6 text-success-foreground" />
            </div>
          </div>
        )}
      </div>

      <CardContent className="p-3">
        {/* Rarity & Category */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground capitalize">
            {item.category}
          </span>
          {rarity !== "common" && (
            <Badge variant="outline" className={`text-xs ${rarityClass}`}>
              {rarityIcons[rarity]}
              <span className="ml-1 capitalize">{rarity}</span>
            </Badge>
          )}
        </div>

        {/* Name */}
        <h4 className="font-medium text-foreground truncate mb-2">
          {item.name}
        </h4>

        {/* Limited Time Countdown */}
        {isLimited && (
          <div className="mb-2">
            <CountdownTimer endDate={item.expiry_date!} className="text-xs" />
          </div>
        )}

        {/* Price & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {item.is_premium ? (
              <Lock className="h-3.5 w-3.5 text-warning" />
            ) : null}
            <span className="font-bold text-foreground">
              ${item.price?.toLocaleString() || "Free"}
            </span>
          </div>

          {isOwned ? (
            <Button variant="outline" size="sm" disabled>
              Owned
            </Button>
          ) : (
            <div className="flex gap-1">
              {onPreview && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPreview(item)}
                >
                  Try
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={() => onPurchase(item)}
              >
                Buy
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
