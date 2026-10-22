import { COOKING_RECIPES, type CookingRecipe } from "./recipeCatalogue";

// A browser-only technique workshop. Nothing in this model is a source of
// authoritative inventory, XP, quality, buffs, purchases or completion.
export type TechniqueMethod = "oven" | "simmer" | "mix";
export type TechniqueHeat = "off" | "low" | "medium" | "high";
export type TechniqueStage = "Raw" | "Warming" | "Ready" | "Overdone" | "Burnt" | "Unmixed" | "Mixing";
export type TechniqueStatus = "idle" | "running" | "finished" | "timed-out";
export const TECHNIQUE_SESSION_MS = 120_000;
export const TECHNIQUE_PRACTICE_RECIPES = COOKING_RECIPES.filter(
  (recipe): recipe is CookingRecipe & { method: TechniqueMethod } => recipe.method !== "pan",
);
const WINDOWS: Record<Exclude<TechniqueMethod, "mix">, {
  ready: number; overdone: number; burnt: number;
}> = {
  oven: { ready: 15, overdone: 23, burnt: 31 },
  simmer: { ready: 12, overdone: 20, burnt: 30 },
};
const HEAT_RATE: Record<TechniqueHeat, number> = {
  off: 0, low: 0.65, medium: 1, high: 1.5,
};

export interface TechniqueIngredient {
  name: string;
  inVessel: boolean;
}
export interface TechniquePracticeState {
  recipeSlug: string;
  method: TechniqueMethod;
  ingredients: TechniqueIngredient[];
  status: TechniqueStatus;
  startedAt: number;
  updatedAt: number;
  heat: TechniqueHeat;
  vessel: "preparing" | "heating" | "served";
  exposureSeconds: number;
  stirCount: number;
  slower: boolean;
}
export type TechniqueAction =
  | { type: "select"; recipeSlug: string }
  | { type: "start"; now: number; slower: boolean }
  | { type: "tick"; now: number }
  | { type: "add"; ingredient: string; now: number }
  | { type: "begin"; now: number }
  | { type: "heat"; heat: TechniqueHeat; now: number }
  | { type: "remove"; now: number }
  | { type: "stir"; now: number }
  | { type: "finish"; now: number };

export function initialTechniquePractice(recipeSlug = "apple-pie"): TechniquePracticeState {
  const recipe = TECHNIQUE_PRACTICE_RECIPES.find((item) => item.slug === recipeSlug)
    ?? TECHNIQUE_PRACTICE_RECIPES[0];
  return {
    recipeSlug: recipe.slug, method: recipe.method,
    ingredients: recipe.ingredients.map(name => ({ name, inVessel: false })),
    status: "idle", startedAt: 0, updatedAt: 0,
    heat: "off", vessel: "preparing", exposureSeconds: 0, stirCount: 0, slower: false,
  };
}

export const allTechniqueIngredientsAdded = (state: TechniquePracticeState) =>
  state.ingredients.length > 0 && state.ingredients.every(item => item.inVessel);

export function techniqueStage(state: TechniquePracticeState): TechniqueStage {
  if (state.method === "mix") {
    if (state.stirCount >= 3) return "Ready";
    return state.stirCount > 0 ? "Mixing" : "Unmixed";
  }
  const windows = WINDOWS[state.method];
  if (state.exposureSeconds >= windows.burnt) return "Burnt";
  if (state.exposureSeconds >= windows.overdone) return "Overdone";
  if (state.exposureSeconds >= windows.ready) return "Ready";
  return state.exposureSeconds > 0 ? "Warming" : "Raw";
}

export function techniquePracticeResult(state: TechniquePracticeState): {
  score: number; label: string;
} {
  if (state.status !== "finished" || !allTechniqueIngredientsAdded(state) ||
    state.vessel !== "served") return { score: 0, label: "No completed dish" };
  const stage = techniqueStage(state);
  if (stage === "Ready") {
    return state.method === "mix" && state.stirCount > 5
      ? { score: 65, label: "Overmixed practice drink" }
      : { score: 100, label: "Excellent technique" };
  }
  if (stage === "Overdone") return { score: 60, label: "Overdone practice dish" };
  return { score: 0, label: stage === "Burnt" ? "Burnt practice dish" : "Undercooked practice dish" };
}

function advance(state: TechniquePracticeState, now: number): TechniquePracticeState {
  if (state.status !== "running" || !Number.isFinite(now) || now < state.updatedAt) return state;
  const deadline = state.startedAt + TECHNIQUE_SESSION_MS * (state.slower ? 2 : 1);
  const timestamp = Math.min(now, deadline);
  const seconds = (timestamp - state.updatedAt) / 1000;
  const exposure = state.vessel === "heating"
    ? seconds * HEAT_RATE[state.heat] * (state.slower ? 0.5 : 1)
    : 0;
  return {
    ...state,
    updatedAt: timestamp,
    exposureSeconds: Math.round((state.exposureSeconds + exposure) * 1_000_000) / 1_000_000,
    status: now >= deadline ? "timed-out" : "running",
    heat: now >= deadline ? "off" : state.heat,
  };
}

export function techniqueReducer(
  state: TechniquePracticeState, action: TechniqueAction,
): TechniquePracticeState {
  if (action.type === "select") {
    if (state.status === "running") return state;
    return initialTechniquePractice(action.recipeSlug);
  }
  if (!Number.isFinite(action.now)) return state;
  if (action.type === "start") {
    if (state.status === "running") return state;
    return { ...initialTechniquePractice(state.recipeSlug),
      status: "running", startedAt: action.now, updatedAt: action.now,
      slower: action.slower };
  }
  const next = advance(state, action.now);
  if (next.status !== "running" || action.now < next.updatedAt) return next;
  if (action.type === "tick") return next;
  if (action.type === "add") {
    if (next.vessel !== "preparing") return next;
    return { ...next, ingredients: next.ingredients.map(item =>
      item.name === action.ingredient ? { ...item, inVessel: true } : item) };
  }
  if (action.type === "begin" && next.method !== "mix" &&
    next.vessel === "preparing" && allTechniqueIngredientsAdded(next)) {
    return { ...next, vessel: "heating", heat: "medium" };
  }
  if (action.type === "heat" && next.vessel === "heating" &&
      next.method !== "mix" && action.heat in HEAT_RATE) {
    return { ...next, heat: action.heat };
  }
  if (action.type === "remove" && next.vessel === "heating") {
    return { ...next, vessel: "served", heat: "off" };
  }
  if (action.type === "stir" && next.method === "mix" &&
    next.vessel === "preparing" && allTechniqueIngredientsAdded(next)) {
    return { ...next, stirCount: Math.min(8, next.stirCount + 1) };
  }
  if (action.type === "finish" && allTechniqueIngredientsAdded(next) &&
    (next.vessel === "served" || (next.method === "mix" && next.stirCount >= 3))) {
    return { ...next, status: "finished", heat: "off", vessel: "served" };
  }
  return next;
}
