// @ts-nocheck
import { BadgeIcon } from "@/components/achievements/BadgeIcon";
import type { LeaderboardBadge } from "@/lib/api/leaderboards";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const RARITY_STYLES: Record<string, string> = {
  common: "bg-secondary text-secondary-foreground",
  uncommon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  rare: "bg-primary/10 text-primary",
  epic: "bg-purple-500/10 text-purple-500",
  legendary: "bg-amber-500/10 text-amber-500",
  mythic: "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white",
};

const getFallbackInitials = (name: string | null, username: string | null) => {
  const source = name || username || "";
  if (!source) return "?";
  return source
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

export interface BadgeCardProps {
  badge: LeaderboardBadge;
  showSeasonLabel?: boolean;
}

export const BadgeCard = ({ badge, showSeasonLabel = false }: BadgeCardProps) => {
  const awardedCount = badge.awards.length;
  const topRecipients = badge.awards.slice(0, 3);
  const rarityClass = RARITY_STYLES[badge.rarity] ?? RARITY_STYLES.rare;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
          <BadgeIcon icon={badge.icon} className="h-10 w-10" />
        </div>
        <div className="flex-1 space-y-1">
          <CardTitle className="text-xl font-semibold">{badge.name}</CardTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className={cn("capitalize", rarityClass)}>
              {badge.rarity}
            </Badge>
            {badge.tier && (
              <Badge variant="secondary" className="uppercase tracking-wide">
                {badge.tier}
              </Badge>
            )}
            {showSeasonLabel && badge.season_id === null && (
              <Badge variant="secondary">Lifetime</Badge>
            )}
            {showSeasonLabel && badge.season_id !== null && (
              <Badge variant="secondary">Season</Badge>
            )}
            <span>{awardedCount} award{awardedCount === 1 ? "" : "s"}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {badge.description && <CardDescription>{badge.description}</CardDescription>}

        {Object.keys(badge.criteria ?? {}).length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Criteria</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {Object.entries(badge.criteria ?? {}).map(([key, value]) => (
                <li key={key}>
                  <span className="font-medium capitalize">{key.replace(/_/g, " ")}:</span> {String(value)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {topRecipients.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Top recipients</p>
              <span className="text-xs text-muted-foreground">Most recent awards</span>
            </div>
            <div className="space-y-2">
              {topRecipients.map(award => (
                <div key={award.id} className="flex items-center gap-3 rounded-md border border-border/60 p-2">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={award.profile?.avatarUrl ?? undefined} alt={award.profile?.displayName ?? award.profile?.username ?? "Player"} />
                    <AvatarFallback>{getFallbackInitials(award.profile?.displayName ?? null, award.profile?.username ?? null)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-tight">
                      {award.profile?.displayName || award.profile?.username || "Unknown competitor"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Awarded {new Date(award.awarded_at).toLocaleDateString()} {award.rank ? `• Rank #${award.rank}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {awardedCount > topRecipients.length && <Separator />}

        {awardedCount > topRecipients.length && (
          <p className="text-xs text-muted-foreground">
            +{awardedCount - topRecipients.length} additional recipient{awardedCount - topRecipients.length === 1 ? "" : "s"}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
