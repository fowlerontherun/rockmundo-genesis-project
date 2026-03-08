export type CasinoGameType = "blackjack" | "roulette" | "slots";

export interface CasinoTransaction {
  id: string;
  profile_id: string;
  game_type: CasinoGameType;
  bet_amount: number;
  payout: number;
  net_result: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Blackjack types
export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface PlayingCard {
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export type BlackjackState = "betting" | "playing" | "dealer-turn" | "result";
export type BlackjackResult = "win" | "lose" | "push" | "blackjack" | "bust";

export interface BlackjackHand {
  cards: PlayingCard[];
  value: number;
  soft: boolean;
  busted: boolean;
  blackjack: boolean;
}

// Roulette types
export type RouletteBetType =
  | "straight" | "red" | "black" | "odd" | "even"
  | "low" | "high" | "dozen1" | "dozen2" | "dozen3"
  | "col1" | "col2" | "col3";

export interface RouletteBet {
  type: RouletteBetType;
  number?: number; // for straight bets
  amount: number;
}

export const ROULETTE_REDS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
export const ROULETTE_BLACKS = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];

export const ROULETTE_PAYOUTS: Record<RouletteBetType, number> = {
  straight: 35,
  red: 1, black: 1,
  odd: 1, even: 1,
  low: 1, high: 1,
  dozen1: 2, dozen2: 2, dozen3: 2,
  col1: 2, col2: 2, col3: 2,
};

// Slots types
export type SlotSymbol = "guitar" | "microphone" | "drums" | "vinyl" | "star" | "diamond";

export const SLOT_SYMBOLS: SlotSymbol[] = ["guitar", "microphone", "drums", "vinyl", "star", "diamond"];

export const SLOT_PAYOUTS: Record<string, number> = {
  "diamond-diamond-diamond": 50,
  "star-star-star": 25,
  "guitar-guitar-guitar": 10,
  "microphone-microphone-microphone": 10,
  "drums-drums-drums": 8,
  "vinyl-vinyl-vinyl": 5,
};

// Symbol weights (lower = rarer)
export const SLOT_WEIGHTS: Record<SlotSymbol, number> = {
  diamond: 2,
  star: 4,
  guitar: 8,
  microphone: 8,
  drums: 10,
  vinyl: 12,
};
