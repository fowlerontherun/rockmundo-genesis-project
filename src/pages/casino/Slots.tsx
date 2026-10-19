import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BetControls } from "@/components/casino/BetControls";
import { GameResult } from "@/components/casino/GameResult";
import { SlotReel } from "@/components/casino/SlotReel";
import { useCasino } from "@/hooks/useCasino";
import { getSymbolEmoji } from "@/lib/casino/slots";
import type { SlotSymbol } from "@/lib/casino/types";
import { SLOT_PAYOUTS } from "@/lib/casino/types";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCw, Cherry } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

export default function Slots() {
  const navigate = useNavigate();
  const { cash, recordTransaction, isRecording } = useCasino();

  const [bet, setBet] = useState(100);
  const [reels, setReels] = useState<[SlotSymbol | null, SlotSymbol | null, SlotSymbol | null]>([null, null, null]);
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<{ multiplier: number; payout: number; isJackpot: boolean; matchType: string | null } | null>(null);
  const [autoSpins, setAutoSpins] = useState(0);
  const autoRef = useRef(false);
  const pendingRef = useRef<{ requestId: string; bet: number } | null>(null);
  const inFlightRef = useRef(false);
  const [settlementError, setSettlementError] = useState(false);

  const spin = async (currentBet?: number): Promise<boolean> => {
    if (inFlightRef.current) return false;
    const b = currentBet ?? bet;
    if (!pendingRef.current && (b > cash || b < 10)) return false;
    const attempt = pendingRef.current ?? { requestId: crypto.randomUUID(), bet: b };
    pendingRef.current = attempt;
    inFlightRef.current = true;
    setSpinning(true);
    setSettlementError(false);
    setLastResult(null);
    try {
      // The DB draws the reels and settles the payout atomically.
      // Never pre-draw a client result, including for auto-spin.
      const [receipt] = await Promise.all([
        recordTransaction("slots", attempt.bet, {}, attempt.requestId),
        new Promise<void>(resolve => setTimeout(resolve, 900)),
      ]);
      const outcome = receipt.outcome;
      if (!Array.isArray(outcome.reels) || outcome.reels.length !== 3 ||
          !Number.isFinite(Number(outcome.multiplier))) {
        throw new Error("Server result is missing. Retry this same round.");
      }
      setReels(outcome.reels as [SlotSymbol, SlotSymbol, SlotSymbol]);
      setLastResult({
        multiplier: Number(outcome.multiplier),
        payout: receipt.payout,
        isJackpot: outcome.isJackpot === true,
        matchType: typeof outcome.matchType === "string" ? outcome.matchType : null,
      });
      pendingRef.current = null;
      return true;
    } catch {
      // A response may have been lost after commit; use this SAME requestId
      // for the retry so the wallet cannot be credited or debited twice.
      setSettlementError(true);
      autoRef.current = false;
      return false;
    } finally {
      inFlightRef.current = false;
      setSpinning(false);
    }
  };

  const startAutoSpin = async (count: number) => {
    autoRef.current = true;
    setAutoSpins(count);
    for (let i = 0; i < count; i++) {
      if (!autoRef.current) break;
      if (bet > cash) break;
      setAutoSpins(count - i);
      if (!await spin(bet)) break;
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
    <FMPageScaffold
      title="Slots"
      subtitle="Spin the music-themed reels and hit the jackpot!"
      icon={Cherry}
      backTo="/casino"
      backLabel="Casino"
      className="max-w-lg mx-auto"
      headerActions={
        <span className="text-xs text-muted-foreground">${cash.toLocaleString()}</span>
      }
    >

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

      {settlementError && (
        <div role="alert" className="space-y-2 text-center text-sm text-destructive">
          <p>Round confirmation was interrupted. Retry the same round to recover its result without another charge.</p>
          <Button variant="outline" disabled={spinning || isRecording} onClick={() => { void spin(); }}>Retry this round</Button>
        </div>
      )}

      {/* Bet & Spin */}
      <Card>
        <CardContent className="py-4 space-y-4">
          <BetControls bet={bet} onBetChange={setBet} maxCash={cash} disabled={spinning || autoSpins > 0 || !!pendingRef.current} />

          <div className="grid grid-cols-2 gap-2">
            <Button
              className="w-full"
              size="lg"
              onClick={() => spin()}
              disabled={spinning || bet > cash || isRecording || autoSpins > 0 || !!pendingRef.current}
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
                disabled={spinning || bet > cash || isRecording || !!pendingRef.current}
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
    </FMPageScaffold>
  );
}
