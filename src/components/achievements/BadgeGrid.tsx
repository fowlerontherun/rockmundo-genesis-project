import { BadgeCard } from "@/components/achievements/BadgeCard";
import type { LeaderboardBadge } from "@/lib/api/leaderboards";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export interface BadgeGridProps {
  badges: LeaderboardBadge[];
  showSeasonLabel?: boolean;
}

export const BadgeGrid = ({ badges, showSeasonLabel }: BadgeGridProps) => {
  if (!badges.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
          <Trophy className="h-10 w-10" />
          <p>No badges have been revealed for this season yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {badges.map(badge => (
        <BadgeCard key={badge.id} badge={badge} showSeasonLabel={showSeasonLabel} />
      ))}
    </div>
  );
};
