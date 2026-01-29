// Character Identity Card - Shows player's RP identity on dashboard
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFullCharacterIdentity } from "@/hooks/useCharacterIdentity";
import { TRAIT_CATEGORIES, type TraitCategory } from "@/types/roleplaying";
import { User2, Sparkles, Target, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const CATEGORY_COLORS: Record<TraitCategory, string> = {
  creative: "bg-violet-500/20 text-violet-500 border-violet-500/30",
  social: "bg-sky-500/20 text-sky-500 border-sky-500/30",
  work_ethic: "bg-amber-500/20 text-amber-500 border-amber-500/30",
  emotional: "bg-rose-500/20 text-rose-500 border-rose-500/30",
};

interface CharacterIdentityCardProps {
  compact?: boolean;
}

export const CharacterIdentityCard = ({ compact = false }: CharacterIdentityCardProps) => {
  const { 
    identity, 
    selectedOrigin, 
    selectedTraits, 
    hasCompletedOnboarding,
    isLoading 
  } = useFullCharacterIdentity();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User2 className="h-5 w-5" />
            Character Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!hasCompletedOnboarding) {
    return (
      <Link to="/onboarding">
        <Card className="hover:bg-accent/50 transition-colors cursor-pointer border-dashed">
          <CardContent className="p-6 text-center">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary" />
            <h3 className="font-semibold mb-1">Create Your Character</h3>
            <p className="text-sm text-muted-foreground">
              Complete onboarding to define your artist identity
            </p>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <Link to="/my-character">
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User2 className="h-5 w-5" />
            Character Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Origin */}
          {selectedOrigin && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/10 to-transparent border border-primary/20">
              <div className="text-2xl">{selectedOrigin.icon || "🎸"}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{selectedOrigin.name}</p>
                <p className="text-xs text-muted-foreground">{selectedOrigin.tagline}</p>
              </div>
            </div>
          )}

          {/* Traits */}
          {selectedTraits.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Personality Traits</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedTraits.map((trait) => (
                  <Badge
                    key={trait.id}
                    variant="outline"
                    className={cn("text-xs", CATEGORY_COLORS[trait.category])}
                  >
                    {trait.icon || "✨"} {trait.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Musical Style & Career Goal */}
          {!compact && (
            <div className="grid grid-cols-2 gap-3">
              {identity?.musical_style && (
                <div className="p-2 rounded-md bg-muted/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Music className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Style</span>
                  </div>
                  <p className="text-sm font-medium truncate">{identity.musical_style}</p>
                </div>
              )}
              {identity?.career_goal && (
                <div className="p-2 rounded-md bg-muted/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Goal</span>
                  </div>
                  <p className="text-sm font-medium truncate">{identity.career_goal}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
};
