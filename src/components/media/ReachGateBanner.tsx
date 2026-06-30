import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock, MapPin, TrendingUp } from "lucide-react";
import {
  getPlayerReachTier,
  getReachTierLabel,
  getNextReachTier,
  type ReachTier,
} from "@/utils/mediaReachGate";

interface ReachGateBannerProps {
  fame: number;
  cityName?: string | null;
  country?: string | null;
  visibleCount: number;
  hiddenCount: number;
  showOutOfReach: boolean;
  onToggleOutOfReach: (value: boolean) => void;
  outletNoun?: string; // e.g. "magazines", "stations"
}

export function ReachGateBanner({
  fame,
  cityName,
  country,
  visibleCount,
  hiddenCount,
  showOutOfReach,
  onToggleOutOfReach,
  outletNoun = "outlets",
}: ReachGateBannerProps) {
  const tier: ReachTier = getPlayerReachTier(fame);
  const next = getNextReachTier(tier);
  const fameToNext = next ? Math.max(0, next.fame - fame) : 0;

  const tierColor =
    tier === "local" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : tier === "regional" ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
    : tier === "national" ? "bg-violet-500/15 text-violet-400 border-violet-500/30"
    : "bg-amber-500/15 text-amber-400 border-amber-500/30";

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={tierColor}>
            <MapPin className="h-3 w-3 mr-1" />
            {getReachTierLabel(tier)}
          </Badge>
          {(cityName || country) && (
            <span className="text-xs text-muted-foreground">
              {cityName ? `${cityName}, ` : ""}{country ?? ""}
            </span>
          )}
        </div>

        <div className="text-xs text-muted-foreground flex-1">
          {next ? (
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Reach <b className="text-foreground">{fameToNext.toLocaleString()}</b> more fame to unlock {getReachTierLabel(next.tier).toLowerCase()}.
            </span>
          ) : (
            <span>You have international reach — every outlet is open to you.</span>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Showing <b className="text-foreground">{visibleCount}</b> in-reach {outletNoun}
          {hiddenCount > 0 && (
            <span className="ml-1 text-muted-foreground/80">
              · <Lock className="h-3 w-3 inline" /> {hiddenCount} locked
            </span>
          )}
        </div>

        {hiddenCount > 0 && (
          <div className="flex items-center gap-2">
            <Switch id="show-locked" checked={showOutOfReach} onCheckedChange={onToggleOutOfReach} />
            <Label htmlFor="show-locked" className="text-xs cursor-pointer">Show locked</Label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
