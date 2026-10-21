// Local tutorial simulation only. This model never awards inventory, buffs or XP.
// Live crafting must validate actions and time on the server before issuing rewards.
export type Heat = "off" | "low" | "medium" | "high";
export type Position = "tray" | "pan" | "plate";
export type Doneness = "Raw" | "Cooking" | "Ready" | "Overdone" | "Burnt";
export type IngredientId = "onion" | "mushroom" | "pepper";

export const PRACTICE_INGREDIENTS = [
  { id: "onion", name: "Onion", ready: 12, overdone: 16, burnt: 21 },
  { id: "mushroom", name: "Mushroom", ready: 18, overdone: 23, burnt: 30 },
  { id: "pepper", name: "Pepper", ready: 9, overdone: 13, burnt: 18 },
] as const;
export const SESSION_MS = 120_000;
const HEAT_RATE: Record<Heat, number> = { off: 0, low: 0.65, medium: 1, high: 1.5 };

export interface PracticeItem {
  id: IngredientId;
  position: Position;
  cooked: number;
}
export interface PracticeState {
  status: "idle" | "cooking" | "finished" | "timed-out";
  heat: Heat;
  slower: boolean;
  startedAt: number;
  updatedAt: number;
  items: PracticeItem[];
}
export type PracticeAction =
  | { type: "start"; now: number; slower: boolean }
  | { type: "tick"; now: number }
  | { type: "heat"; heat: Heat; now: number }
  | { type: "move"; id: IngredientId; to: Position; now: number }
  | { type: "finish"; now: number };

export function initialPractice(): PracticeState {
  return {
    status: "idle", heat: "off", slower: false, startedAt: 0, updatedAt: 0,
    items: PRACTICE_INGREDIENTS.map(({ id }) => ({ id, position: "tray", cooked: 0 })),
  };
}

export function doneness(item: PracticeItem): Doneness {
  const spec = PRACTICE_INGREDIENTS.find(({ id }) => id === item.id)!;
  if (item.cooked >= spec.burnt) return "Burnt";
  if (item.cooked >= spec.overdone) return "Overdone";
  if (item.cooked >= spec.ready) return "Ready";
  return item.cooked > 0 ? "Cooking" : "Raw";
}

function advance(state: PracticeState, now: number): PracticeState {
  if (state.status !== "cooking" || !Number.isFinite(now)) return state;
  const deadline = state.startedAt + SESSION_MS * (state.slower ? 2 : 1);
  const timestamp = Math.max(state.updatedAt, Math.min(now, deadline));
  const elapsed = (timestamp - state.updatedAt) / 1000;
  const rate = HEAT_RATE[state.heat] * (state.slower ? 0.5 : 1);
  return {
    ...state, updatedAt: timestamp,
    status: now >= deadline ? "timed-out" : "cooking",
    heat: now >= deadline ? "off" : state.heat,
    items: state.items.map((item) => ({
      // Quantize fractional seconds so frequent UI ticks cannot leave a food
      // microscopically short of an exact Ready/Burnt boundary.
      ...item, cooked: Math.round((item.cooked + (item.position === "pan" ? elapsed * rate : 0)) * 1_000_000) / 1_000_000,
    })),
  };
}

export function practiceReducer(state: PracticeState, action: PracticeAction): PracticeState {
  if (!Number.isFinite(action.now)) return state;
  if (action.type === "start") {
    // A running attempt cannot be restarted to reset heat exposure.
    if (state.status === "cooking") return state;
    return { ...initialPractice(), status: "cooking", slower: action.slower,
      startedAt: action.now, updatedAt: action.now };
  }
  const next = advance(state, action.now);
  if (next.status !== "cooking") return next;
  if (action.type === "heat") return { ...next, heat: action.heat };
  if (action.type === "move") {
    // No return to the tray: a used ingredient cannot become a fresh ingredient.
    if (action.to === "tray") return next;
    return { ...next, items: next.items.map((item) => item.id === action.id
      ? { ...item, position: action.to } : item) };
  }
  if (action.type === "finish" && next.items.every((item) => item.position === "plate")) {
    return { ...next, status: "finished", heat: "off" };
  }
  return next;
}

export function practiceResult(state: PracticeState) {
  const failed = state.items.some((item) => item.position !== "plate"
    || ["Raw", "Cooking", "Burnt"].includes(doneness(item)));
  const score = failed ? 0 : Math.round(state.items.reduce((total, item) =>
    total + (doneness(item) === "Ready" ? 100 : 40), 0) / state.items.length);
  return { score, label: failed ? "Batch unsuccessful" : score === 100 ? "Perfect timing" : "Edible, but overdone" };
}
