import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCoopSuggestions } from "@/hooks/useRelationshipInsights";

interface CoopSuggestionsCardProps {
  friendProfileIds: string[];
  onSelectFriend?: (otherProfileId: string) => void;
}

export function CoopSuggestionsCard({ friendProfileIds, onSelectFriend }: CoopSuggestionsCardProps) {
  const { data, isLoading } = useCoopSuggestions(friendProfileIds, 3);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-social-chemistry" /> Suggested Co-ops
        </CardTitle>
        <CardDescription className="text-xs">
          Top friends with available XP today, ranked by potential
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {friendProfileIds.length === 0
              ? "Add friends to unlock co-op XP suggestions."
              : "All daily caps maxed for today. Come back tomorrow!"}
          </p>
        ) : (
          data.map((s) => {
            const name = s.otherDisplayName ?? s.otherUsername ?? "Friend";
            return (
              <button
                key={s.otherProfileId}
                onClick={() => onSelectFriend?.(s.otherProfileId)}
                className="w-full text-left rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 p-3 transition-colors group"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      +{s.potentialXp} XP available
                    </Badge>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex flex-wrap gap-1">
                  {s.availableActions.map((a) => (
                    <Badge
                      key={a.id}
                      variant="outline"
                      className="text-[10px] bg-card"
                    >
                      {a.label} +{a.xp} {a.remaining > 1 && `×${a.remaining}`}
                    </Badge>
                  ))}
                </div>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
