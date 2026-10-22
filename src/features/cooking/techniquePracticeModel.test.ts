import { describe, expect, it } from "vitest";
import {
  allTechniqueIngredientsAdded, initialTechniquePractice, techniquePracticeResult,
  techniqueReducer, techniqueStage, TECHNIQUE_PRACTICE_RECIPES,
  TECHNIQUE_SESSION_MS, type TechniquePracticeState,
} from "./techniquePracticeModel";

const choose = (slug: string) => initialTechniquePractice(slug);
function begin(slug: string, slower = false) {
  return techniqueReducer(choose(slug), { type: "start", now: 0, slower });
}
function addAll(state: TechniquePracticeState) {
  return state.ingredients.reduce((s, i) =>
    techniqueReducer(s, { type: "add", ingredient: i.name, now: 0 }), state);
}
function heat(state: TechniquePracticeState) {
  return techniqueReducer(state, { type: "begin", now: 0 });
}
function tick(state: TechniquePracticeState, seconds: number) {
  return techniqueReducer(state, { type: "tick", now: seconds * 1000 });
}
function serve(state: TechniquePracticeState, seconds: number) {
  return techniqueReducer(state, { type: "remove", now: seconds * 1000 });
}
function finish(state: TechniquePracticeState, seconds: number) {
  return techniqueReducer(state, { type: "finish", now: seconds * 1000 });
}

describe("free multi-method cooking techniques", () => {
  it("covers every non-pan recipe with its real ingredient names and a supported method", () => {
    expect(TECHNIQUE_PRACTICE_RECIPES).toHaveLength(11);
    expect(new Set(TECHNIQUE_PRACTICE_RECIPES.map(r => r.slug)).size).toBe(11);
    for (const recipe of TECHNIQUE_PRACTICE_RECIPES) {
      expect(["oven", "simmer", "mix"]).toContain(recipe.method);
      const state = choose(recipe.slug);
      expect(state.ingredients.map(i => i.name)).toEqual(recipe.ingredients);
    }
  });

  it("mixes a fruit drink without heat and never forces ingredients into a pan", () => {
    let state = addAll(begin("fruit-drink"));
    expect(allTechniqueIngredientsAdded(state)).toBe(true);
    expect(techniqueStage(state)).toBe("Unmixed");
    expect(techniqueReducer(state, { type: "begin", now: 0 })).toEqual(state);
    expect(finish(state, 0)).toEqual(state);
    for (let i = 0; i < 3; i++) {
      state = techniqueReducer(state, { type: "stir", now: i * 1000 });
    }
    expect(techniqueStage(state)).toBe("Ready");
    expect(techniquePracticeResult(finish(state, 3000))).toEqual({
      score: 100, label: "Excellent technique",
    });
    expect(state.heat).toBe("off");
  });

  it("starts a pie only after all ingredients, and produces full practice score at golden", () => {
    let state = begin("apple-pie");
    expect(techniqueReducer(state, { type: "begin", now: 0 })).toEqual(state);
    state = addAll(state);
    expect(allTechniqueIngredientsAdded(state)).toBe(true);
    state = heat(state);
    expect(state.vessel).toBe("heating");
    expect(state.heat).toBe("medium");
    expect(techniqueStage(tick(state, 15))).toBe("Ready");
    state = serve(tick(state, 15), 15);
    expect(state.vessel).toBe("served");
    expect(finish(state, 15).status).toBe("finished");
    expect(techniquePracticeResult(finish(state, 15)).score).toBe(100);
    expect(tick(state, 40).exposureSeconds).toBe(15);
  });

  it("simmered soup burns irreversibly and never creates a reward", () => {
    let state = heat(addAll(begin("vegetable-soup")));
    state = tick(state, 31);
    expect(techniqueStage(state)).toBe("Burnt");
    state = serve(state, 31);
    state = finish(state, 31);
    expect(techniquePracticeResult(state)).toEqual({
      score: 0, label: "Burnt practice dish",
    });
    expect(techniqueReducer(state, { type: "start", now: 32_000, slower: false }).status).toBe("running");
  });

  it("scores an overdone pie below a ready one, and a raw pie as unusable", () => {
    const state = heat(addAll(begin("apple-pie")));
    const overdone = finish(serve(tick(state, 24), 24), 24);
    expect(techniquePracticeResult(overdone).score).toBe(60);
    const raw = finish(serve(state, 0), 0);
    expect(techniquePracticeResult(raw).score).toBe(0);
  });

  it("uses cumulative wall time across heat changes, without timer-frame advantage", () => {
    let state = heat(addAll(begin("vegetable-soup")));
    const oneTick = tick(state, 12);
    let manyTicks = state;
    for (let i=1;i<=12;i++) manyTicks=tick(manyTicks,i);
    expect(manyTicks.exposureSeconds).toBe(oneTick.exposureSeconds);
    state = techniqueReducer(tick(state, 6), { type: "heat", heat: "off", now: 6000 });
    expect(tick(state, 20).exposureSeconds).toBe(6);
    state = techniqueReducer(tick(state, 20), { type: "heat", heat: "high", now: 20000 });
    expect(tick(state, 24).exposureSeconds).toBe(12);
    expect(techniqueStage(tick(state, 24))).toBe("Ready");
  });

  it("slower mode doubles reaction time and the session deadline", () => {
    const state = heat(addAll(begin("apple-pie", true)));
    expect(tick(state, 30).exposureSeconds).toBe(15);
    expect(techniqueStage(tick(state, 30))).toBe("Ready");
    expect(tick(state, 120).status).toBe("running");
    expect(tick(state, 240).status).toBe("timed-out");
  });

  it("times out after 120 seconds even when backgrounded, preventing late plating", () => {
    const state = heat(addAll(begin("apple-pie")));
    const expired = tick(state, 500);
    expect(expired).toMatchObject({ status: "timed-out", heat: "off" });
    expect(expired.exposureSeconds).toBe(120);
    expect(techniqueReducer(expired, { type: "remove", now: 500_000 })).toEqual(expired);
    expect(techniquePracticeResult(expired).score).toBe(0);
  });

  it("rejects invalid additions, midway recipe switching, and heating a drink", () => {
    let state = begin("apple-pie");
    expect(techniqueReducer(state, { type: "add", ingredient: "not-in-recipe", now: 0 })
      .ingredients.every(i => !i.inVessel)).toBe(true);
    expect(techniqueReducer(state, { type: "select", recipeSlug: "spiced-tea" })).toEqual(state);
    state = heat(addAll(state));
    expect(techniqueReducer(state, { type: "add", ingredient: "Apples", now: 1000 })).toEqual(tick(state, 1));
    const mixed = addAll(begin("spiced-tea"));
    expect(techniqueReducer(mixed, { type: "heat", heat: "high", now: 0 })).toEqual(mixed);
  });

  it("limits mixing clicks and penalizes excess mixing, without rewards", () => {
    let state = addAll(begin("spiced-tea"));
    for (let i = 0; i < 30; i++) state = techniqueReducer(state, { type: "stir", now: 0 });
    expect(state.stirCount).toBe(8);
    expect(techniquePracticeResult(finish(state, 0))).toEqual({
      score: 65, label: "Overmixed practice drink",
    });
    expect(state).not.toHaveProperty("foodBatchId");
    expect(state).not.toHaveProperty("xp");
    expect(TECHNIQUE_SESSION_MS).toBe(120000);
  });
});
