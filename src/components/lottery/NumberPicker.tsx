import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shuffle } from "lucide-react";

interface NumberPickerProps {
  onSubmit: (numbers: number[], bonus: number) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const NumberPicker = ({ onSubmit, disabled, isLoading }: NumberPickerProps) => {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [selectedBonus, setSelectedBonus] = useState<number | null>(null);

  const toggleNumber = useCallback((n: number) => {
    setSelectedNumbers((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= 7) return prev;
      return [...prev, n];
    });
  }, []);

  const quickPick = useCallback(() => {
    const nums: number[] = [];
    while (nums.length < 7) {
      const r = Math.floor(Math.random() * 49) + 1;
      if (!nums.includes(r)) nums.push(r);
    }
    nums.sort((a, b) => a - b);
    setSelectedNumbers(nums);
    setSelectedBonus(Math.floor(Math.random() * 10) + 1);
  }, []);

  const handleSubmit = () => {
    if (selectedNumbers.length === 7 && selectedBonus !== null) {
      onSubmit([...selectedNumbers].sort((a, b) => a - b), selectedBonus);
    }
  };

  const canSubmit = selectedNumbers.length === 7 && selectedBonus !== null && !disabled && !isLoading;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Pick 7 Numbers (1-49)</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {selectedNumbers.length}/7
              </Badge>
              <Button variant="outline" size="sm" onClick={quickPick} disabled={disabled}>
                <Shuffle className="h-3 w-3 mr-1" /> Quick Pick
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
            {Array.from({ length: 49 }, (_, i) => i + 1).map((n) => {
              const isSelected = selectedNumbers.includes(n);
              return (
                <button
                  key={n}
                  onClick={() => toggleNumber(n)}
                  disabled={disabled || (!isSelected && selectedNumbers.length >= 7)}
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
          <CardTitle className="text-base">Pick Bonus Number (1-10)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
              const isSelected = selectedBonus === n;
              return (
                <button
                  key={n}
                  onClick={() => setSelectedBonus(n)}
                  disabled={disabled}
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
          {selectedNumbers.length === 7 && selectedBonus !== null ? (
            <span>
              Selected: <span className="font-mono text-foreground">{[...selectedNumbers].sort((a, b) => a - b).join(", ")}</span>
              {" + "}
              <span className="font-mono text-warning">B{selectedBonus}</span>
            </span>
          ) : (
            "Pick 7 numbers and 1 bonus number"
          )}
        </div>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {isLoading ? "Buying..." : "Buy Ticket ($500)"}
        </Button>
      </div>
    </div>
  );
};
