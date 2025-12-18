import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Lock, Star, TrendingUp, Users, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { MerchItemRequirement, QUALITY_TIERS, checkMerchUnlocked, getUnlockProgress } from "@/hooks/useMerchRequirements";

interface MerchItemCardProps {
  item: MerchItemRequirement;
  playerFame: number;
  playerFans: number;
  playerLevel: number;
  onSelect?: (item: MerchItemRequirement) => void;
  isSelected?: boolean;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Apparel: <span className="text-lg">👕</span>,
  Accessories: <span className="text-lg">🎒</span>,
  Collectibles: <span className="text-lg">🖼️</span>,
  Experiences: <span className="text-lg">🎤</span>,
  Digital: <span className="text-lg">💿</span>,
  Bundles: <span className="text-lg">📦</span>,
};

export const MerchItemCard = ({
  item,
  playerFame,
  playerFans,
  playerLevel,
  onSelect,
  isSelected,
}: MerchItemCardProps) => {
  const { unlocked, reason } = checkMerchUnlocked(item, playerFame, playerFans, playerLevel);
  const progress = getUnlockProgress(item, playerFame, playerFans, playerLevel);
  const qualityInfo = QUALITY_TIERS[item.base_quality_tier];

  return (
    <Card 
      className={cn(
        "relative transition-all hover:shadow-md cursor-pointer",
        !unlocked && "opacity-75",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={() => unlocked && onSelect?.(item)}
    >
      {!unlocked && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-lg">
          <div className="text-center p-4">
            <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">{reason}</p>
            <Progress value={progress * 100} className="mt-2 h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">{Math.round(progress * 100)}% progress</p>
          </div>
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {CATEGORY_ICONS[item.category] || <span className="text-lg">📦</span>}
            <CardTitle className="text-sm line-clamp-1">{item.item_type}</CardTitle>
          </div>
          <Badge variant="outline" className={cn("text-xs", qualityInfo.color)}>
            {qualityInfo.label}
          </Badge>
        </div>
        <CardDescription className="text-xs line-clamp-2">
          {item.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Star className="h-3 w-3" />
            <span>{item.min_fame.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{item.min_fans.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Award className="h-3 w-3" />
            <span>Lv {item.min_level}</span>
          </div>
        </div>

        {/* Cost & Multipliers */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">${item.base_cost} cost</span>
          <div className="flex items-center gap-1 text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>{qualityInfo.salesMultiplier}x sales</span>
          </div>
        </div>

        {unlocked && (
          <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => onSelect?.(item)}>
            Select
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
