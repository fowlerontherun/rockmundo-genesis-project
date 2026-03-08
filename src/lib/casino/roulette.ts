import type { RouletteBet, RouletteBetType } from "./types";
import { ROULETTE_REDS, ROULETTE_BLACKS, ROULETTE_PAYOUTS } from "./types";

export function spinWheel(): number {
  return Math.floor(Math.random() * 37); // 0-36
}

export function isWinningBet(bet: RouletteBet, result: number): boolean {
  if (result === 0) {
    return bet.type === "straight" && bet.number === 0;
  }

  switch (bet.type) {
    case "straight": return bet.number === result;
    case "red": return ROULETTE_REDS.includes(result);
    case "black": return ROULETTE_BLACKS.includes(result);
    case "odd": return result % 2 === 1;
    case "even": return result % 2 === 0;
    case "low": return result >= 1 && result <= 18;
    case "high": return result >= 19 && result <= 36;
    case "dozen1": return result >= 1 && result <= 12;
    case "dozen2": return result >= 13 && result <= 24;
    case "dozen3": return result >= 25 && result <= 36;
    case "col1": return result % 3 === 1;
    case "col2": return result % 3 === 2;
    case "col3": return result % 3 === 0;
    default: return false;
  }
}

export function calculateRoulettePayout(bets: RouletteBet[], result: number): {
  totalBet: number;
  totalPayout: number;
  winningBets: RouletteBet[];
} {
  let totalBet = 0;
  let totalPayout = 0;
  const winningBets: RouletteBet[] = [];

  for (const bet of bets) {
    totalBet += bet.amount;
    if (isWinningBet(bet, result)) {
      const payout = bet.amount + bet.amount * ROULETTE_PAYOUTS[bet.type];
      totalPayout += payout;
      winningBets.push(bet);
    }
  }

  return { totalBet, totalPayout, winningBets };
}

export function getNumberColor(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return ROULETTE_REDS.includes(n) ? "red" : "black";
}

export function getBetLabel(type: RouletteBetType, number?: number): string {
  switch (type) {
    case "straight": return `#${number}`;
    case "red": return "Red";
    case "black": return "Black";
    case "odd": return "Odd";
    case "even": return "Even";
    case "low": return "1-18";
    case "high": return "19-36";
    case "dozen1": return "1st 12";
    case "dozen2": return "2nd 12";
    case "dozen3": return "3rd 12";
    case "col1": return "Col 1";
    case "col2": return "Col 2";
    case "col3": return "Col 3";
  }
}
