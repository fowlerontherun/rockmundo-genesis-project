import {
  LOTTERY_BONUS_MAX, LOTTERY_MAX_NUMBER, LOTTERY_NUMBERS_TO_PICK,
  LOTTERY_TICKET_COST, lotterySelectionError, quickPickLotteryNumbers,
} from "@/lib/lottery/rules";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shuffle } from "lucide-react";

interface NumberPickerProps {
  onSubmit: (numbers: number[], bonus: number) => Promise<unknown> | void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const NumberPicker = ({ onSubmit, disabled, isLoading }: NumberPickerProps) => {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [selectedBonus, setSelectedBonus] = useState<number | null>(null);

  const toggleNumber = useCallback((n: number) => {
    setSelectedNumbers((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= LOTTERY_NUMBERS_TO_PICK) return prev;
      return [...prev, n];
    });
  }, []);

  const quickPick = useCallback(() => {
    const selection = quickPickLotteryNumbers();
    setSelectedNumbers(selection.numbers);
    setSelectedBonus(selection.bonus);
  }, []);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async () => {
    if (!canSubmit || selectedBonus === null) return;
    setIsSubmitting(true);
    try {
      await onSubmit([...selectedNumbers].sort((a, b) => a - b), selectedBonus);
      // Keep selection when the server rejects the purchase.
      setSelectedNumbers([]);
      setSelectedBonus(null);
    } catch {
      // useBuyTicket supplies the error toast.
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = selectedBonus !== null &&
    !lotterySelectionError(selectedNumbers, selectedBonus) &&
    !disabled && !isLoading && !isSubmitting;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Pick {LOTTERY_NUMBERS_TO_PICK} Numbers (1-{LOTTERY_MAX_NUMBER})</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {selectedNumbers.length}/{LOTTERY_NUMBERS_TO_PICK}
              </Badge>
              <Button variant="outline" size="sm" onClick={quickPick} disabled={disabled || isLoading || isSubmitting}>
                <Shuffle className="h-3 w-3 mr-1" /> Quick Pick
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
            {Array.from({ length: LOTTERY_MAX_NUMBER }, (_, i) => i + 1).map((n) => {
              const isSelected = selectedNumbers.includes(n);
              return (
                <button
                  key={n}
                  onClick={() => toggleNumber(n)}
                  disabled={disabled || isLoading || isSubmitting || (!isSelected && selectedNumbers.length >= LOTTERY_NUMBERS_TO_PICK)}
                  className={`h-9 w-full rounded-md text-sm font-medium transition-all
                    ${isSelected
                      ? "bg-primary text-primary-foreground shadow-md scale-105"
                      : "bg-muted hover:bg-accent text-foreground"
                    }
                    disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pick Bonus Number (1-{LOTTERY_BONUS_MAX})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Array.from({ length: LOTTERY_BONUS_MAX }, (_, i) => i + 1).map((n) => {
              const isSelected = selectedBonus === n;
              return (
                <button
                  key={n}
                  onClick={() => setSelectedBonus(n)}
                  disabled={disabled || isLoading || isSubmitting}
                  className={`h-10 w-full rounded-md text-sm font-bold transition-all
                    ${isSelected
                      ? "bg-warning text-warning-foreground shadow-md scale-105"
                      : "bg-muted hover:bg-accent text-foreground"
                    }
                    disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {selectedNumbers.length === LOTTERY_NUMBERS_TO_PICK && selectedBonus !== null ? (
            <span>
              Selected: <span className="font-mono text-foreground">{[...selectedNumbers].sort((a, b) => a - b).join(", ")}</span>
              {" + "}
              <span className="font-mono text-warning">B{selectedBonus}</span>
            </span>
          ) : (
            `Pick ${LOTTERY_NUMBERS_TO_PICK} numbers and 1 bonus number`
          )}
        </div>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {isLoading || isSubmitting ? "Buying..." : `Buy Ticket (${LOTTERY_TICKET_COST})`}
        </Button>
      </div>
    </div>
  );
};
