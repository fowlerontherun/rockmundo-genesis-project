import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, Package, TrendingUp, Heart, 
  Speaker, Utensils, DoorClosed 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RiderStatsCardProps {
  rider: {
    id: string;
    name: string;
    tier: string;
    total_cost_estimate: number;
    is_default: boolean;
  };
  itemCounts?: {
    technical: number;
    hospitality: number;
    backstage: number;
    total: number;
  };
  bonuses?: {
    performance: number;
    morale: number;
  };
}

const TIER_COLORS: Record<string, string> = {
  basic: "bg-slate-500",
  standard: "bg-blue-500",
  professional: "bg-purple-500",
  star: "bg-amber-500",
  legendary: "bg-gradient-to-r from-amber-500 to-orange-500",
};

export function RiderStatsCard({ rider, itemCounts, bonuses }: RiderStatsCardProps) {
  const totalItems = itemCounts?.total || 0;
  const maxItems = rider.tier === "legendary" ? 100 : 
                   rider.tier === "star" ? 50 : 
                   rider.tier === "professional" ? 35 : 
                   rider.tier === "standard" ? 20 : 10;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{rider.name}</CardTitle>
          <Badge className={cn("text-white", TIER_COLORS[rider.tier])}>
            {rider.tier.charAt(0).toUpperCase() + rider.tier.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cost and Items */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              Est. Cost
            </div>
            <p className="text-lg font-semibold">
              ${(rider.total_cost_estimate || 0).toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              Items
            </div>
            <p className="text-lg font-semibold">
              {totalItems}/{maxItems}
            </p>
          </div>
        </div>

        {/* Item Breakdown */}
        {itemCounts && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Speaker className="h-3 w-3" />
                Technical
              </span>
              <span>{itemCounts.technical}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Utensils className="h-3 w-3" />
                Hospitality
              </span>
              <span>{itemCounts.hospitality}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <DoorClosed className="h-3 w-3" />
                Backstage
              </span>
              <span>{itemCounts.backstage}</span>
            </div>
          </div>
        )}

        {/* Bonuses */}
        {bonuses && (bonuses.performance > 0 || bonuses.morale > 0) && (
          <div className="flex gap-4 pt-2 border-t">
            {bonuses.performance > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-green-600">+{bonuses.performance}% perf</span>
              </div>
            )}
            {bonuses.morale > 0 && (
              <div className="flex items-center gap-1 text-xs">
                <Heart className="h-3 w-3 text-blue-500" />
                <span className="text-blue-600">+{bonuses.morale}% morale</span>
              </div>
            )}
          </div>
        )}

        {/* Capacity Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Capacity Used</span>
            <span>{Math.round((totalItems / maxItems) * 100)}%</span>
          </div>
          <Progress value={(totalItems / maxItems) * 100} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  );
}
