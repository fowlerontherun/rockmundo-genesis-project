import {
  Zap,
  Heart,
  Star,
  Brain,
  Clock,
  BookOpen,
  Sparkles,
  Package,
  Volume2,
  Network,
  Battery,
  Flame,
  Wine,
  PenTool,
  Mic,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UnderworldProduct } from "@/hooks/useUnderworldStore";

const iconMap: Record<string, LucideIcon> = {
  Zap,
  Heart,
  Star,
  Brain,
  BookOpen,
  Sparkles,
  Package,
  Volume2,
  Network,
  Battery,
  Flame,
  Wine,
  PenTool,
  Mic,
};

const rarityStyles: Record<string, { border: string; badge: string; glow: string }> = {
  common: {
    border: "border-muted",
    badge: "bg-muted text-muted-foreground",
    glow: "",
  },
  uncommon: {
    border: "border-emerald-500/50",
    badge: "bg-emerald-500/20 text-emerald-400",
    glow: "shadow-emerald-500/10",
  },
  rare: {
    border: "border-blue-500/50",
    badge: "bg-blue-500/20 text-blue-400",
    glow: "shadow-blue-500/10",
  },
  epic: {
    border: "border-purple-500/50",
    badge: "bg-purple-500/20 text-purple-400",
    glow: "shadow-purple-500/20",
  },
  legendary: {
    border: "border-amber-500/50",
    badge: "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400",
    glow: "shadow-amber-500/30",
  },
};

const categoryIcons: Record<string, LucideIcon> = {
  consumable: Zap,
  booster: Sparkles,
  skill_book: BookOpen,
  collectible: Star,
};

interface ProductCardProps {
  product: UnderworldProduct;
  onPurchase: (product: UnderworldProduct) => void;
  userBalance: number;
}

export const ProductCard = ({ product, onPurchase, userBalance }: ProductCardProps) => {
  const rarity = product.rarity || "common";
  const styles = rarityStyles[rarity] || rarityStyles.common;
  const Icon = iconMap[product.icon_name || "Package"] || Package;
  const CategoryIcon = categoryIcons[product.category] || Package;

  const canAfford = product.price_cash ? userBalance >= product.price_cash : false;
  const effects = product.effects || {};

  // Format effect descriptions
  const getEffectDescription = (): string[] => {
    const descriptions: string[] = [];
    if (effects.health) descriptions.push(`+${effects.health} Health`);
    if (effects.energy) descriptions.push(`+${effects.energy} Energy`);
    if (effects.xp) descriptions.push(`+${effects.xp} XP`);
    if (effects.fame) descriptions.push(`+${effects.fame} Fame`);
    if (effects.xp_multiplier) descriptions.push(`+${((effects.xp_multiplier as number) - 1) * 100}% XP`);
    if (effects.fame_multiplier) descriptions.push(`+${((effects.fame_multiplier as number) - 1) * 100}% Fame`);
    if (effects.energy_regen) descriptions.push(`+${((effects.energy_regen as number) - 1) * 100}% Energy Regen`);
    if (effects.all_multiplier) descriptions.push(`+${((effects.all_multiplier as number) - 1) * 100}% All Gains`);
    if (effects.skill_slug && effects.skill_xp) {
      descriptions.push(`+${effects.skill_xp} ${String(effects.skill_slug).charAt(0).toUpperCase() + String(effects.skill_slug).slice(1)} XP`);
    }
    return descriptions;
  };

  const effectDescriptions = getEffectDescription();

  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:scale-[1.02]",
        styles.border,
        styles.glow && `shadow-lg ${styles.glow}`
      )}
    >
      {/* Rarity glow effect */}
      {rarity === "legendary" && (
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5" />
      )}
      {rarity === "epic" && (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5" />
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold leading-tight">{product.name}</h3>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="gap-1 text-xs">
                  <CategoryIcon className="h-3 w-3" />
                  {product.category}
                </Badge>
                <Badge className={cn("text-xs capitalize", styles.badge)}>
                  {rarity}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {product.description}
        </p>

        {/* Effects */}
        <div className="flex flex-wrap gap-1">
          {effectDescriptions.map((effect, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {effect}
            </Badge>
          ))}
          {product.duration_hours && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              {product.duration_hours}h
            </Badge>
          )}
        </div>

        {/* Lore (tooltip on hover would be better, but showing truncated) */}
        {product.lore && (
          <p className="text-xs italic text-muted-foreground/70 line-clamp-2">
            "{product.lore}"
          </p>
        )}

        {/* Price & Buy */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-lg font-bold text-primary">
            ${product.price_cash?.toLocaleString()}
          </div>
          <Button
            onClick={() => onPurchase(product)}
            disabled={!canAfford}
            size="sm"
            className="gap-2"
          >
            {canAfford ? "Buy Now" : "Can't Afford"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
