import type { PlayingCard, Suit, Rank, BlackjackHand } from "./types";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function createDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, faceUp: true });
    }
  }
  return deck;
}

export function shuffleDeck(deck: PlayingCard[]): PlayingCard[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function cardValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (["K", "Q", "J"].includes(rank)) return 10;
  return parseInt(rank);
}

export function evaluateHand(cards: PlayingCard[]): BlackjackHand {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    value += cardValue(card.rank);
    if (card.rank === "A") aces++;
  }

  let soft = aces > 0 && value <= 21;
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  soft = aces > 0 && value <= 21;

  return {
    cards,
    value,
    soft,
    busted: value > 21,
    blackjack: cards.length === 2 && value === 21,
  };
}

export function shouldDealerHit(hand: BlackjackHand): boolean {
  // Dealer hits on soft 17 and below, stands on hard 17+
  if (hand.value < 17) return true;
  if (hand.value === 17 && hand.soft) return true;
  return false;
}

export function dealInitialHands(deck: PlayingCard[]): {
  playerCards: PlayingCard[];
  dealerCards: PlayingCard[];
  remainingDeck: PlayingCard[];
} {
  const d = [...deck];
  const playerCards = [d.pop()!, d.pop()!];
  const dealerCards = [
    { ...d.pop()!, faceUp: true },
    { ...d.pop()!, faceUp: false }, // hole card face down
  ];
  return { playerCards, dealerCards, remainingDeck: d };
}

export function getBlackjackPayout(
  playerHand: BlackjackHand,
  dealerHand: BlackjackHand,
  bet: number
): { result: "win" | "lose" | "push" | "blackjack" | "bust"; payout: number } {
  if (playerHand.busted) return { result: "bust", payout: 0 };
  if (playerHand.blackjack && !dealerHand.blackjack) return { result: "blackjack", payout: bet * 2.5 };
  if (dealerHand.blackjack && !playerHand.blackjack) return { result: "lose", payout: 0 };
  if (playerHand.blackjack && dealerHand.blackjack) return { result: "push", payout: bet };
  if (dealerHand.busted) return { result: "win", payout: bet * 2 };
  if (playerHand.value > dealerHand.value) return { result: "win", payout: bet * 2 };
  if (playerHand.value < dealerHand.value) return { result: "lose", payout: 0 };
  return { result: "push", payout: bet };
}
