import { useEffect, useRef, useState } from "react";
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
import { useNavigate } from "react-router-dom";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { Club } from "lucide-react";

interface RoundStake {
  originalStake: number;
  effectiveStake: number;
}

interface ConfirmedRound {
  result: BlackjackResult;
  netResult: number;
  newCash: number;
}

const MAX_CASINO_BET = 10_000;

export default function Blackjack() {
  const navigate = useNavigate();
  const { cash, recordTransaction, isRecording } = useCasino();

  const [bet, setBet] = useState(100);
  const [gameState, setGameState] = useState<BlackjackState>("betting");
  const [deck, setDeck] = useState<PlayingCard[]>([]);
  const [playerCards, setPlayerCards] = useState<PlayingCard[]>([]);
  const [dealerCards, setDealerCards] = useState<PlayingCard[]>([]);
  const [roundStake, setRoundStake] = useState<RoundStake | null>(null);
  const [confirmedRound, setConfirmedRound] = useState<ConfirmedRound | null>(null);
  const [settlementError, setSettlementError] = useState(false);
  // A ref locks immediately, before React can render the disabled controls.
  const actionLocked = useRef(false);
  const stakeRef = useRef<RoundStake | null>(null);

  // A non-busting Hit needs its new hand rendered before another action is allowed.
  useEffect(() => {
    if (gameState === "playing" && playerCards.length >= 2) actionLocked.current = false;
  }, [gameState, playerCards]);

  const finishRound = async (r: BlackjackResult, payout: number, stake: RoundStake) => {
    setGameState("settling");
    try {
      const receipt = await recordTransaction("blackjack", stake.effectiveStake, payout, {
        result: r,
        originalStake: stake.originalStake,
        effectiveStake: stake.effectiveStake,
        doubled: stake.effectiveStake !== stake.originalStake,
      });
      if (!Number.isFinite(receipt.netResult) || !Number.isFinite(receipt.newCash)) {
        throw new Error("Casino settlement did not return a valid receipt");
      }
      setConfirmedRound({ result: r, netResult: receipt.netResult, newCash: receipt.newCash });
      setGameState("result");
    } catch {
      // A request may have reached the database even if its response was lost.
      // Never display an unconfirmed payout or resubmit the same round.
      setSettlementError(true);
      setGameState("settlement-error");
    }
  };

  const deal = () => {
    if (gameState !== "betting" || actionLocked.current || bet < 10 || bet > MAX_CASINO_BET || bet > cash) return;
    actionLocked.current = true;
    const stake = { originalStake: bet, effectiveStake: bet };
    stakeRef.current = stake;
    setRoundStake(stake);
    const freshDeck = shuffleDeck(createDeck());
    const { playerCards: pc, dealerCards: dc, remainingDeck } = dealInitialHands(freshDeck);
    setDeck(remainingDeck);
    setPlayerCards(pc);
    setDealerCards(dc);
    setConfirmedRound(null);
    setSettlementError(false);

    const playerHand = evaluateHand(pc);
    const dealerHand = evaluateHand(dc);

    // Check for natural blackjack
    if (playerHand.blackjack) {
      const revealed = dc.map(c => ({ ...c, faceUp: true }));
      setDealerCards(revealed);
      const revealedHand = evaluateHand(revealed);
      const { result: r, payout: p } = getBlackjackPayout(playerHand, revealedHand, bet);
      void finishRound(r, p, stake);
    } else {
      setGameState("playing");
    }
  };

  const hit = () => {
    if (gameState !== "playing" || actionLocked.current || !stakeRef.current) return;
    actionLocked.current = true;
    const d = [...deck];
    const newCard = d.pop()!;
    const newCards = [...playerCards, newCard];
    setDeck(d);
    setPlayerCards(newCards);

    const hand = evaluateHand(newCards);
    if (hand.busted) {
      const revealed = dealerCards.map(c => ({ ...c, faceUp: true }));
      setDealerCards(revealed);
      void finishRound("bust", 0, stakeRef.current);
    }
  };

  const stand = () => {
    if (gameState !== "playing" || actionLocked.current || !stakeRef.current) return;
    actionLocked.current = true;
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
    const stake = stakeRef.current;
    const { result: r, payout: p } = getBlackjackPayout(playerHand, dealerHand, stake.effectiveStake);
    void finishRound(r, p, stake);
  };

  const doubleDown = () => {
    const stake = stakeRef.current;
    if (
      gameState !== "playing" || actionLocked.current || !stake ||
      playerCards.length !== 2 || stake.originalStake * 2 > cash ||
      stake.originalStake * 2 > MAX_CASINO_BET
    ) return;
    actionLocked.current = true;
    const doubledStake = { ...stake, effectiveStake: stake.originalStake * 2 };
    stakeRef.current = doubledStake;
    setRoundStake(doubledStake);
    const d = [...deck];
    const newCard = d.pop()!;
    const newCards = [...playerCards, newCard];
    setDeck(d);
    setPlayerCards(newCards);

    const hand = evaluateHand(newCards);
    if (hand.busted) {
      const revealed = dealerCards.map(c => ({ ...c, faceUp: true }));
      setDealerCards(revealed);
      void finishRound("bust", 0, doubledStake);
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
      const { result: r, payout: p } = getBlackjackPayout(hand, dealerHand, doubledStake.effectiveStake);
      void finishRound(r, p, doubledStake);
    }
  };

  const playerHand = evaluateHand(playerCards);
  const visibleDealerValue = dealerCards.length > 0 && dealerCards[0].faceUp
    ? evaluateHand(dealerCards.filter(c => c.faceUp)).value
    : 0;

  return (
    <FMPageScaffold
      title="Blackjack"
      subtitle="Beat the dealer to 21."
      icon={Club}
      backTo="/casino"
      backLabel="Casino"
      className="max-w-lg mx-auto"
      headerActions={
        <span className="text-xs text-muted-foreground">${(confirmedRound?.newCash ?? cash).toLocaleString()}</span>
      }
    >

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

      {roundStake && gameState !== "betting" && (
        <p className="text-sm text-muted-foreground text-center">
          Wager: ${roundStake.effectiveStake.toLocaleString()}
          {roundStake.effectiveStake !== roundStake.originalStake ? " (doubled)" : ""}
        </p>
      )}

      {/* Never report a win or loss before the database confirms the balance change. */}
      {gameState === "settling" && <p role="status" className="text-center">Confirming wager settlement...</p>}
      {confirmedRound && gameState === "result" && (
        <GameResult
          result={confirmedRound.result}
          amount={confirmedRound.netResult}
          message={confirmedRound.result === "push" ? "Bet returned" : undefined}
        />
      )}
      {settlementError && gameState === "settlement-error" && (
        <div role="alert" className="space-y-3 text-center text-sm text-destructive">
          <p>Settlement could not be confirmed. Check your casino balance before playing again; this hand cannot be submitted twice.</p>
          <Button variant="outline" onClick={() => navigate("/casino")}>Return to Casino</Button>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardContent className="py-4 space-y-4">
          {gameState === "betting" && (
            <>
              <BetControls bet={bet} onBetChange={setBet} maxCash={cash} disabled={isRecording} />
              <Button className="w-full" size="lg" onClick={deal} disabled={bet < 10 || bet > MAX_CASINO_BET || bet > cash || isRecording}>
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
                disabled={playerCards.length !== 2 || !roundStake || roundStake.originalStake * 2 > cash || roundStake.originalStake * 2 > MAX_CASINO_BET || isRecording}
              >
                Double
              </Button>
            </div>
          )}
          {gameState === "result" && (
            <Button className="w-full" onClick={() => {
              stakeRef.current = null;
              actionLocked.current = false;
              setConfirmedRound(null);
              setRoundStake(null);
              setGameState("betting");
              setPlayerCards([]);
              setDealerCards([]);
            }}>
              New Hand
            </Button>
          )}
        </CardContent>
      </Card>
    </FMPageScaffold>
  );
}
