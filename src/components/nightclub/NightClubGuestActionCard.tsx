import { Button } from "@/components/ui/button";
import { Zap, Sparkles, Loader2 } from "lucide-react";
import type { NightClubGuestAction } from "@/utils/worldEnvironment";

interface NightClubGuestActionCardProps {
  action: NightClubGuestAction;
  clubName: string;
  onPerform: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export const NightClubGuestActionCard = ({
  action,
  clubName,
  onPerform,
  disabled,
  loading,
}: NightClubGuestActionCardProps) => {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:border-primary/40">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium truncate">{action.label}</span>
        </div>
        {action.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{action.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {typeof action.energyCost === "number" && action.energyCost > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
            <Zap className="h-3 w-3" /> {action.energyCost}
          </span>
        )}
        <Button size="sm" variant="outline" onClick={onPerform} disabled={disabled || loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Do it"}
        </Button>
      </div>
    </div>
  );
};
