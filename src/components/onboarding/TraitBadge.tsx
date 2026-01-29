import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PersonalityTrait } from "@/types/roleplaying";

interface TraitBadgeProps {
  trait: PersonalityTrait;
  isSelected: boolean;
  isDisabled: boolean;
  onClick: () => void;
}

export const TraitBadge = ({
  trait,
  isSelected,
  isDisabled,
  onClick,
}: TraitBadgeProps) => {
  // Format gameplay effects for tooltip
  const effects = Object.entries(trait.gameplay_effects ?? {})
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => {
      const formatted = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const sign = (value as number) > 0 ? "+" : "";
      const percent = Math.abs(value as number) < 1 ? `${(value as number) * 100}%` : value;
      return `${formatted}: ${sign}${percent}`;
    });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={isDisabled && !isSelected}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : isDisabled
                ? "cursor-not-allowed border-muted bg-muted/50 text-muted-foreground/50"
                : "border-border bg-background text-foreground hover:border-primary/50 hover:bg-primary/10"
            )}
          >
            {isSelected && <Check className="h-3 w-3" />}
            {trait.name}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">{trait.name}</p>
            <p className="text-sm text-muted-foreground">{trait.description}</p>
            
            {effects.length > 0 && (
              <div className="border-t border-border pt-2">
                <p className="mb-1 text-xs font-medium">Effects:</p>
                <ul className="space-y-0.5">
                  {effects.map((effect) => (
                    <li key={effect} className="text-xs text-muted-foreground">
                      • {effect}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {trait.incompatible_with.length > 0 && (
              <p className="text-xs text-orange-500">
                Incompatible with: {trait.incompatible_with.join(", ")}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
