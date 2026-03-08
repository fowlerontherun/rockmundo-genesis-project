import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BetControls } from "@/components/casino/BetControls";
import { GameResult } from "@/components/casino/GameResult";
import { SlotReel } from "@/components/casino/SlotReel";
import { useCasino } from "@/hooks/useCasino";
import { spinReels, calculateSlotPayout, getSymbolEmoji } from "@/lib/casino/slots";
import type { SlotSymbol } from "@/lib/casino/types";
import { SLOT_PAYOUTS } from "@/lib/casino/types";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCw } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Slots() {
  const navigate = useNavigate();
  const { cash, recordTransaction, isRecording } = useCasino();

  const [bet, setBet] = useState(100);
  const [reels, setReels] = useState<[SlotSymbol | null, SlotSymbol | null, SlotSymbol | null]>([null, null, null]);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<{ multiplier: number; payout: number; isJackpot: boolean; matchType: string | null } | null>(null);
  const [autoSpins, setAutoSpins] = useState(0);
  const autoRef = useRef(false);

  const spin = async (currentBet?: number) => {
    const b = currentBet ?? bet;
    if (b > cash) return;

    setSpinning(true);
    setLastResult(null);

    await new Promise(r => setTimeout(r, 1200));

    const result = spinReels();
    setReels(result);
    setSpinning(false);

    const payoutResult = calculateSlotPayout(result, b);
    setLastResult(payoutResult);

    await recordTransaction("slots", b, payoutResult.payout, {
      reels: result,
      multiplier: payoutResult.multiplier,
      isJackpot: payoutResult.isJackpot,
    });
  };

  const startAutoSpin = async (count: number) => {
    autoRef.current = true;
    setAutoSpins(count);
    for (let i = 0; i < count; i++) {
      if (!autoRef.current) break;
      if (bet > cash) break;
      setAutoSpins(count - i);
      await spin(bet);
      await new Promise(r => setTimeout(r, 800));
    }
    autoRef.current = false;
    setAutoSpins(0);
  };

  const stopAutoSpin = () => {
    autoRef.current = false;
    setAutoSpins(0);
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/casino")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">🎰 Slots</h1>
        <span className="ml-auto text-sm text-muted-foreground">${cash.toLocaleString()}</span>
      </div>

      {/* Slot Machine */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-b from-yellow-900/30 to-background p-6">
          <div className="flex justify-center gap-3">
            <SlotReel symbol={reels[0]} spinning={spinning} delay={0} />
            <SlotReel symbol={reels[1]} spinning={spinning} delay={0.1} />
            <SlotReel symbol={reels[2]} spinning={spinning} delay={0.2} />
          </div>
        </div>
        <CardContent className="py-4">
          {lastResult && !spinning && (
            <GameResult
              result={lastResult.isJackpot ? "jackpot" : lastResult.payout > 0 ? "win" : "lose"}
              amount={lastResult.payout - bet}
              message={lastResult.matchType ?? undefined}
            />
          )}
        </CardContent>
      </Card>

      {/* Bet & Spin */}
      <Card>
        <CardContent className="py-4 space-y-4">
          <BetControls bet={bet} onBetChange={setBet} maxCash={cash} disabled={spinning || autoSpins > 0} />

          <div className="grid grid-cols-2 gap-2">
            <Button
              className="w-full"
              size="lg"
              onClick={() => spin()}
              disabled={spinning || bet > cash || isRecording || autoSpins > 0}
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Spin — ${bet.toLocaleString()}
            </Button>
            {autoSpins > 0 ? (
              <Button variant="destructive" size="lg" onClick={stopAutoSpin}>
                Stop ({autoSpins})
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={() => startAutoSpin(10)}
                disabled={spinning || bet > cash || isRecording}
              >
                Auto ×10
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Paytable */}
      <Card>
        <CardContent className="py-3">
          <p className="text-xs font-semibold mb-2 text-muted-foreground">Pay Table</p>
          <div className="grid gap-1 text-xs">
            {Object.entries(SLOT_PAYOUTS).map(([key, mult]) => {
              const symbols = key.split("-") as SlotSymbol[];
              return (
                <div key={key} className="flex items-center justify-between">
                  <span>{symbols.map(s => getSymbolEmoji(s)).join(" ")}</span>
                  <span className="font-bold text-primary">{mult}×</span>
                </div>
              );
            })}
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Any Pair</span>
              <span className="font-bold">2×</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
