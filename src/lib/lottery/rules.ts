/**
 * RockMundo weekly lottery: seven distinct main numbers (1-49), one bonus
 * (1-10), $2 per ticket, up to ten tickets per active character per draw.
 *
 * These values must remain in sync with the versioned SQL lottery RPCs and
 * the internal PostgreSQL draw processor. Contract tests detect drift.
 */
export const LOTTERY_NUMBERS_TO_PICK = 7;
export const LOTTERY_MAX_NUMBER = 49;
export const LOTTERY_BONUS_MAX = 10;
export const LOTTERY_TICKET_COST = 2;
export const LOTTERY_MAX_TICKETS_PER_DRAW = 10;

export function lotterySelectionError(numbers: number[], bonus: number): string | null {
  if (!Array.isArray(numbers) || numbers.length !== LOTTERY_NUMBERS_TO_PICK) {
    return `Select ${LOTTERY_NUMBERS_TO_PICK} numbers`;
  }
  if (numbers.some(n => !Number.isInteger(n) || n < 1 || n > LOTTERY_MAX_NUMBER) ||
      new Set(numbers).size !== LOTTERY_NUMBERS_TO_PICK) {
    return `Select ${LOTTERY_NUMBERS_TO_PICK} unique numbers from 1 to ${LOTTERY_MAX_NUMBER}`;
  }
  if (!Number.isInteger(bonus) || bonus < 1 || bonus > LOTTERY_BONUS_MAX) {
    return `Select a bonus number from 1 to ${LOTTERY_BONUS_MAX}`;
  }
  return null;
}

export function quickPickLotteryNumbers(rng: () => number = Math.random) {
  const pool = Array.from({ length: LOTTERY_MAX_NUMBER }, (_, index) => index + 1);
  // Partial Fisher-Yates: seven uniform selections without replacement.
  for (let i = 0; i < LOTTERY_NUMBERS_TO_PICK; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return {
    numbers: pool.slice(0, LOTTERY_NUMBERS_TO_PICK).sort((a, b) => a - b),
    bonus: Math.floor(rng() * LOTTERY_BONUS_MAX) + 1,
  };
}
