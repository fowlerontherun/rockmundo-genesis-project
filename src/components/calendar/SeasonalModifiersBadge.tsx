import { TrendingUp, Music, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useSeasonModifiers } from "@/hooks/useGameCalendar";
import { getSeasonEmoji } from "@/utils/gameCalendar";

interface SeasonalModifiersBadgeProps {
  genre?: string;
  season?: string;
}

export function SeasonalModifiersBadge({ genre, season }: SeasonalModifiersBadgeProps) {
  const { data: modifiers } = useSeasonModifiers(genre, season);

  if (!modifiers || !season) return null;

  const hasBoost =
    Number(modifiers.streams_multiplier) > 1.0 ||
    Number(modifiers.sales_multiplier) > 1.0 ||
    Number(modifiers.gig_attendance_multiplier) > 1.0;

  if (!hasBoost) return null;

  const streamsBoost = ((Number(modifiers.streams_multiplier) - 1) * 100).toFixed(0);
  const salesBoost = ((Number(modifiers.sales_multiplier) - 1) * 100).toFixed(0);
  const attendanceBoost = ((Number(modifiers.gig_attendance_multiplier) - 1) * 100).toFixed(0);

  const seasonEmoji = getSeasonEmoji(season as any);

  return (
    <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/30">
      <CardContent className="p-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{seasonEmoji}</span>
            <span className="text-sm font-semibold capitalize">{season} Boost Active</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Number(modifiers.streams_multiplier) > 1.0 && (
              <Badge variant="secondary" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                Streams +{streamsBoost}%
              </Badge>
            )}
            {Number(modifiers.sales_multiplier) > 1.0 && (
              <Badge variant="secondary" className="gap-1">
                <Music className="h-3 w-3" />
                Sales +{salesBoost}%
              </Badge>
            )}
            {Number(modifiers.gig_attendance_multiplier) > 1.0 && (
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                Live Shows +{attendanceBoost}%
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
