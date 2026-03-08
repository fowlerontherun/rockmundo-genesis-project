import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Minus, Plus } from "lucide-react";

const BET_PRESETS = [10, 50, 100, 500, 1000, 5000, 10000];

interface BetControlsProps {
  bet: number;
  onBetChange: (amount: number) => void;
  minBet?: number;
  maxBet?: number;
  maxCash: number;
  disabled?: boolean;
}

export function BetControls({ bet, onBetChange, minBet = 10, maxBet = 10000, maxCash, disabled }: BetControlsProps) {
  const effectiveMax = Math.min(maxBet, maxCash);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onBetChange(Math.max(minBet, bet - (bet <= 100 ? 10 : bet <= 1000 ? 50 : 500)))}
          disabled={disabled || bet <= minBet}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="text-2xl font-bold text-primary min-w-[120px] text-center">
          ${bet.toLocaleString()}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onBetChange(Math.min(effectiveMax, bet + (bet < 100 ? 10 : bet < 1000 ? 50 : 500)))}
          disabled={disabled || bet >= effectiveMax}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {BET_PRESETS.filter(p => p <= effectiveMax && p >= minBet).map(preset => (
          <Button
            key={preset}
            variant={bet === preset ? "default" : "outline"}
            size="sm"
            onClick={() => onBetChange(preset)}
            disabled={disabled}
            className={cn("text-xs", bet === preset && "ring-2 ring-primary")}
          >
            ${preset.toLocaleString()}
          </Button>
        ))}
      </div>
    </div>
  );
}
