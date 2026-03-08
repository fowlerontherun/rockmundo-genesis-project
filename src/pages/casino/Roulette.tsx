import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BetControls } from "@/components/casino/BetControls";
import { GameResult } from "@/components/casino/GameResult";
import { useCasino } from "@/hooks/useCasino";
import { spinWheel, calculateRoulettePayout, getNumberColor, getBetLabel } from "@/lib/casino/roulette";
import type { RouletteBet, RouletteBetType } from "@/lib/casino/types";
import { ROULETTE_PAYOUTS } from "@/lib/casino/types";
import { motion } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const OUTSIDE_BETS: { type: RouletteBetType; label: string; color?: string }[] = [
  { type: "red", label: "Red", color: "bg-red-600" },
  { type: "black", label: "Black", color: "bg-zinc-800" },
  { type: "odd", label: "Odd" },
  { type: "even", label: "Even" },
  { type: "low", label: "1-18" },
  { type: "high", label: "19-36" },
  { type: "dozen1", label: "1st 12" },
  { type: "dozen2", label: "2nd 12" },
  { type: "dozen3", label: "3rd 12" },
];

export default function Roulette() {
  const navigate = useNavigate();
  const { cash, recordTransaction, isRecording } = useCasino();

  const [betAmount, setBetAmount] = useState(100);
  const [bets, setBets] = useState<RouletteBet[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [lastPayout, setLastPayout] = useState<{ totalBet: number; totalPayout: number; winningBets: RouletteBet[] } | null>(null);

  const totalBetPlaced = bets.reduce((s, b) => s + b.amount, 0);

  const addBet = (type: RouletteBetType, number?: number) => {
    if (totalBetPlaced + betAmount > cash) return;
    setBets(prev => [...prev, { type, amount: betAmount, number }]);
  };

  const removeBet = (index: number) => {
    setBets(prev => prev.filter((_, i) => i !== index));
  };

  const spin = async () => {
    setSpinning(true);
    setResult(null);
    setLastPayout(null);

    // Simulate spin delay
    await new Promise(r => setTimeout(r, 2000));

    const num = spinWheel();
    setResult(num);

    const payoutResult = calculateRoulettePayout(bets, num);
    setLastPayout(payoutResult);
    setSpinning(false);

    await recordTransaction("roulette", payoutResult.totalBet, payoutResult.totalPayout, {
      result: num,
      color: getNumberColor(num),
      bets: bets.map(b => ({ type: b.type, number: b.number, amount: b.amount })),
    });

    setBets([]);
  };

  const numberColor = (n: number) => {
    const c = getNumberColor(n);
    if (c === "red") return "bg-red-600 text-white";
    if (c === "black") return "bg-zinc-800 text-white";
    return "bg-green-600 text-white";
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/casino")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">🎡 Roulette</h1>
        <span className="ml-auto text-sm text-muted-foreground">${cash.toLocaleString()}</span>
      </div>

      {/* Wheel result */}
      <Card className="overflow-hidden">
        <CardContent className="py-8 flex flex-col items-center gap-4">
          {spinning ? (
            <motion.div
              animate={{ rotate: 1080 }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="w-24 h-24 rounded-full border-4 border-primary flex items-center justify-center text-4xl bg-card"
            >
              🎡
            </motion.div>
          ) : result !== null ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={cn("w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold", numberColor(result))}
            >
              {result}
            </motion.div>
          ) : (
            <div className="w-24 h-24 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground">
              ?
            </div>
          )}

          {lastPayout && (
            <GameResult
              result={lastPayout.totalPayout > lastPayout.totalBet ? "win" : lastPayout.totalPayout > 0 ? "push" : "lose"}
              amount={lastPayout.totalPayout - lastPayout.totalBet}
            />
          )}
        </CardContent>
      </Card>

      {/* Current bets */}
      {bets.length > 0 && (
        <Card>
          <CardHeader className="py-2">
            <CardTitle className="text-sm">Your Bets (${totalBetPlaced.toLocaleString()})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5 pb-3">
            {bets.map((bet, i) => (
              <Badge key={i} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeBet(i)}>
                {getBetLabel(bet.type, bet.number)} ${bet.amount}
                <X className="h-3 w-3" />
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Bet controls */}
      {!spinning && result === null && (
        <>
          <BetControls bet={betAmount} onBetChange={setBetAmount} maxCash={cash - totalBetPlaced} />

          {/* Number grid */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm">Numbers</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="grid grid-cols-7 gap-1">
                <button
                  onClick={() => addBet("straight", 0)}
                  className="col-span-1 rounded p-1.5 text-xs font-bold bg-green-600 text-white hover:ring-2 ring-primary"
                >
                  0
                </button>
                {Array.from({ length: 36 }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => addBet("straight", n)}
                    className={cn(
                      "rounded p-1.5 text-xs font-bold hover:ring-2 ring-primary",
                      numberColor(n)
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Outside bets */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm">Outside Bets</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="grid grid-cols-3 gap-2">
                {OUTSIDE_BETS.map(ob => (
                  <Button
                    key={ob.type}
                    variant="outline"
                    size="sm"
                    className={cn("text-xs", ob.color && `${ob.color} text-white border-0`)}
                    onClick={() => addBet(ob.type)}
                  >
                    {ob.label} ({ROULETTE_PAYOUTS[ob.type]}:1)
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={spin}
            disabled={bets.length === 0 || isRecording}
          >
            Spin — ${totalBetPlaced.toLocaleString()}
          </Button>
        </>
      )}

      {result !== null && !spinning && (
        <Button className="w-full" onClick={() => { setResult(null); setLastPayout(null); }}>
          New Spin
        </Button>
      )}
    </div>
  );
}
