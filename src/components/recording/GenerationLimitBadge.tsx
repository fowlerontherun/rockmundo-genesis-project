import { useSongGenerationLimits } from "@/hooks/useSongGenerationLimits";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Infinity } from "lucide-react";

export function GenerationLimitBadge() {
  const { data: limits, isLoading } = useSongGenerationLimits();

  if (isLoading || !limits) return null;

  if (limits.is_admin) {
    return (
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
        <Infinity className="h-3 w-3 mr-1" />
        Admin: Unlimited
      </Badge>
    );
  }

  const isAtLimit = limits.used >= limits.limit;

  return (
    <Badge 
      variant="outline" 
      className={isAtLimit 
        ? "bg-destructive/10 text-destructive border-destructive/30" 
        : "bg-muted text-muted-foreground"
      }
    >
      <Sparkles className="h-3 w-3 mr-1" />
      {limits.used}/{limits.limit} generations this week
      {limits.remaining > 0 && (
        <span className="ml-1 text-xs">({limits.remaining} left)</span>
      )}
    </Badge>
  );
}
