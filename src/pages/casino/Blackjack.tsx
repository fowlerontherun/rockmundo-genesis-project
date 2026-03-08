import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CasinoCard } from "@/components/casino/CasinoCard";
import { BetControls } from "@/components/casino/BetControls";
import { GameResult } from "@/components/casino/GameResult";
import { useCasino } from "@/hooks/useCasino";
import {
  createDeck, shuffleDeck, dealInitialHands,
  evaluateHand, shouldDealerHit, getBlackjackPayout,
} from "@/lib/casino/blackjack";
import type { PlayingCard, BlackjackState, BlackjackResult } from "@/lib/casino/types";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Blackjack() {
  const navigate = useNavigate();
  const { cash, recordTransaction, isRecording } = useCasino();

  const [bet, setBet] = useState(100);
  const [gameState, setGameState] = useState<BlackjackState>("betting");
  const [deck, setDeck] = useState<PlayingCard[]>([]);
  const [playerCards, setPlayerCards] = useState<PlayingCard[]>([]);
  const [dealerCards, setDealerCards] = useState<PlayingCard[]>([]);
  const [result, setResult] = useState<BlackjackResult | null>(null);
  const [payout, setPayout] = useState(0);

  const deal = useCallback(() => {
    const freshDeck = shuffleDeck(createDeck());
    const { playerCards: pc, dealerCards: dc, remainingDeck } = dealInitialHands(freshDeck);
    setDeck(remainingDeck);
    setPlayerCards(pc);
    setDealerCards(dc);
    setResult(null);
    setPayout(0);

    const playerHand = evaluateHand(pc);
    const dealerHand = evaluateHand(dc);

    // Check for natural blackjack
    if (playerHand.blackjack) {
      const revealed = dc.map(c => ({ ...c, faceUp: true }));
      setDealerCards(revealed);
      const revealedHand = evaluateHand(revealed);
      const { result: r, payout: p } = getBlackjackPayout(playerHand, revealedHand, bet);
      finishRound(r, p);
    } else {
      setGameState("playing");
    }
  }, [bet]);

  const finishRound = async (r: BlackjackResult, p: number) => {
    setResult(r);
    setPayout(p);
    setGameState("result");
    await recordTransaction("blackjack", bet, p, { result: r });
  };

  const hit = () => {
    const d = [...deck];
    const newCard = d.pop()!;
    const newCards = [...playerCards, newCard];
    setDeck(d);
    setPlayerCards(newCards);

    const hand = evaluateHand(newCards);
    if (hand.busted) {
      const revealed = dealerCards.map(c => ({ ...c, faceUp: true }));
      setDealerCards(revealed);
      finishRound("bust", 0);
    }
  };

  const stand = () => {
    setGameState("dealer-turn");
    let d = [...deck];
    let dc = dealerCards.map(c => ({ ...c, faceUp: true }));

    let dealerHand = evaluateHand(dc);
    while (shouldDealerHit(dealerHand)) {
      dc = [...dc, d.pop()!];
      dealerHand = evaluateHand(dc);
    }

    setDeck(d);
    setDealerCards(dc);

    const playerHand = evaluateHand(playerCards);
    const { result: r, payout: p } = getBlackjackPayout(playerHand, dealerHand, bet);
    finishRound(r, p);
  };

  const doubleDown = () => {
    const d = [...deck];
    const newCard = d.pop()!;
    const newCards = [...playerCards, newCard];
    setDeck(d);
    setPlayerCards(newCards);
    setBet(prev => prev * 2);

    const hand = evaluateHand(newCards);
    if (hand.busted) {
      const revealed = dealerCards.map(c => ({ ...c, faceUp: true }));
      setDealerCards(revealed);
      finishRound("bust", 0);
    } else {
      // Auto-stand after double
      let dc = dealerCards.map(c => ({ ...c, faceUp: true }));
      let dealerHand = evaluateHand(dc);
      let dd = [...d];
      while (shouldDealerHit(dealerHand)) {
        dc = [...dc, dd.pop()!];
        dealerHand = evaluateHand(dc);
      }
      setDeck(dd);
      setDealerCards(dc);
      const { result: r, payout: p } = getBlackjackPayout(hand, dealerHand, bet * 2);
      finishRound(r, p);
    }
  };

  const playerHand = evaluateHand(playerCards);
  const dealerHand = evaluateHand(dealerCards.map(c => c.faceUp ? c : { ...c, rank: "A", suit: "spades" }));
  const visibleDealerValue = dealerCards.length > 0 && dealerCards[0].faceUp
    ? evaluateHand(dealerCards.filter(c => c.faceUp)).value
    : 0;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/casino")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">🃏 Blackjack</h1>
        <span className="ml-auto text-sm text-muted-foreground">${cash.toLocaleString()}</span>
      </div>

      {/* Dealer */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            Dealer
            {gameState !== "betting" && (
              <span className="text-muted-foreground">
                {gameState === "playing" ? visibleDealerValue : evaluateHand(dealerCards).value}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 min-h-[88px]">
          <AnimatePresence>
            {dealerCards.map((card, i) => (
              <motion.div key={i} initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.15 }}>
                <CasinoCard card={card} />
              </motion.div>
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Player */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            Your Hand
            {playerCards.length > 0 && <span className="text-primary">{playerHand.value}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2 min-h-[88px]">
          <AnimatePresence>
            {playerCards.map((card, i) => (
              <motion.div key={i} initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.15 }}>
                <CasinoCard card={card} />
              </motion.div>
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <GameResult
          result={result}
          amount={payout - bet}
          message={result === "push" ? "Bet returned" : undefined}
        />
      )}

      {/* Controls */}
      <Card>
        <CardContent className="py-4 space-y-4">
          {gameState === "betting" && (
            <>
              <BetControls bet={bet} onBetChange={setBet} maxCash={cash} disabled={isRecording} />
              <Button className="w-full" size="lg" onClick={deal} disabled={bet > cash || isRecording}>
                Deal — ${bet.toLocaleString()}
              </Button>
            </>
          )}
          {gameState === "playing" && (
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={hit} className="w-full">Hit</Button>
              <Button onClick={stand} variant="secondary" className="w-full">Stand</Button>
              <Button
                onClick={doubleDown}
                variant="outline"
                className="w-full"
                disabled={playerCards.length !== 2 || bet * 2 > cash}
              >
                Double
              </Button>
            </div>
          )}
          {gameState === "result" && (
            <Button className="w-full" onClick={() => { setGameState("betting"); setPlayerCards([]); setDealerCards([]); }}>
              New Hand
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
