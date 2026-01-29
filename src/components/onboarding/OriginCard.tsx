import { Check, DollarSign, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CharacterOrigin } from "@/types/roleplaying";

// Icon mapping for origins
const ORIGIN_ICONS: Record<string, string> = {
  guitar: "🎸",
  "graduation-cap": "🎓",
  users: "👥",
  music: "🎵",
  video: "📱",
  briefcase: "💼",
  piano: "🎹",
  crown: "👑",
};

interface OriginCardProps {
  origin: CharacterOrigin;
  isSelected: boolean;
  onSelect: () => void;
}

export const OriginCard = ({ origin, isSelected, onSelect }: OriginCardProps) => {
  const icon = ORIGIN_ICONS[origin.icon ?? ""] ?? "🎭";

  // Format skill bonuses for display
  const skillBonuses = Object.entries(origin.skill_bonuses ?? {})
    .filter(([, value]) => typeof value === "number" && value > 0)
    .map(([skill, value]) => `+${value} ${skill}`)
    .join(", ");

  // Format reputation modifiers
  const repMods = Object.entries(origin.reputation_modifiers ?? {})
    .filter(([, value]) => typeof value === "number" && value !== 0)
    .map(([axis, value]) => {
      const sign = (value as number) > 0 ? "+" : "";
      return `${sign}${value} ${axis}`;
    })
    .join(", ");

  return (
    <button
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col rounded-xl border-2 p-4 text-left transition-all",
        isSelected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-4 w-4" />
        </div>
      )}

      {/* Header with icon */}
      <div className="mb-2 flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 pr-6">
          <h3 className="font-semibold text-foreground">{origin.name}</h3>
          <p className="text-xs italic text-muted-foreground">{origin.tagline}</p>
        </div>
      </div>

      {/* Description */}
      <p className="mb-4 text-sm text-muted-foreground line-clamp-3">
        {origin.description}
      </p>

      {/* Starting bonuses */}
      <div className="mt-auto space-y-2 border-t border-border/50 pt-3">
        {/* Cash & Fame */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-green-500" />
            <span className="text-muted-foreground">${origin.starting_cash}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-500" />
            <span className="text-muted-foreground">{origin.starting_fame} fame</span>
          </div>
        </div>

        {/* Skills */}
        {skillBonuses && (
          <div className="flex items-start gap-1 text-xs">
            <TrendingUp className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
            <span className="text-muted-foreground">{skillBonuses}</span>
          </div>
        )}

        {/* Reputation */}
        {repMods && (
          <div className="text-xs text-muted-foreground/70">Rep: {repMods}</div>
        )}
      </div>
    </button>
  );
};
