import type { SlotSymbol } from "./types";
import { SLOT_SYMBOLS, SLOT_PAYOUTS, SLOT_WEIGHTS } from "./types";

function weightedRandomSymbol(): SlotSymbol {
  const totalWeight = Object.values(SLOT_WEIGHTS).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (const symbol of SLOT_SYMBOLS) {
    random -= SLOT_WEIGHTS[symbol];
    if (random <= 0) return symbol;
  }
  return "vinyl"; // fallback
}

export function spinReels(): [SlotSymbol, SlotSymbol, SlotSymbol] {
  return [weightedRandomSymbol(), weightedRandomSymbol(), weightedRandomSymbol()];
}

export function calculateSlotPayout(reels: [SlotSymbol, SlotSymbol, SlotSymbol], bet: number): {
  multiplier: number;
  payout: number;
  isJackpot: boolean;
  matchType: string | null;
} {
  const key = reels.join("-");

  if (SLOT_PAYOUTS[key]) {
    const multiplier = SLOT_PAYOUTS[key];
    return {
      multiplier,
      payout: bet * multiplier,
      isJackpot: key === "diamond-diamond-diamond",
      matchType: `Three ${reels[0]}s`,
    };
  }

  // Two of a kind pays 2x
  if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
    return {
      multiplier: 2,
      payout: bet * 2,
      isJackpot: false,
      matchType: "Pair",
    };
  }

  return { multiplier: 0, payout: 0, isJackpot: false, matchType: null };
}

export function getSymbolEmoji(symbol: SlotSymbol): string {
  switch (symbol) {
    case "guitar": return "🎸";
    case "microphone": return "🎤";
    case "drums": return "🥁";
    case "vinyl": return "💿";
    case "star": return "⭐";
    case "diamond": return "💎";
  }
}
