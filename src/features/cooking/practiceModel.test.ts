import { describe, expect, it } from "vitest";
import { doneness, initialPractice, practiceReducer, practiceResult, PAN_CAPACITY, SESSION_MS, type PracticeState } from "./practiceModel";

const started = (slower = false) => practiceReducer(initialPractice(), { type: "start", now: 0, slower });
const inPan = () => practiceReducer(started(), { type: "move", id: "onion", to: "pan", now: 0 });
const heated = () => practiceReducer(inPan(), { type: "heat", heat: "medium", now: 0 });
const tick = (state: PracticeState, now: number) => practiceReducer(state, { type: "tick", now });

describe("cooking practice timing", () => {
  it("cooks only items in the pan, using elapsed time rather than frame count", () => {
    const oneFrame = tick(heated(), 12_000);
    const manyFrames = tick(tick(tick(heated(), 2000), 9000), 12_000);
    expect(oneFrame).toEqual(manyFrames);
    expect(oneFrame.items[0].cooked).toBe(12);
    expect(oneFrame.items[1].cooked).toBe(0);
    expect(doneness(oneFrame.items[0])).toBe("Ready");
  });
  it("uses individual ingredient cooking windows and irreversible burning", () => {
    expect(doneness({ id: "onion", position: "pan", cooked: 16 })).toBe("Overdone");
    expect(doneness({ id: "onion", position: "pan", cooked: 21 })).toBe("Burnt");
    expect(doneness({ id: "mushroom", position: "pan", cooked: 21 })).toBe("Ready");
    let state = tick(heated(), 22_000);
    state = practiceReducer(state, { type: "move", id: "onion", to: "plate", now: 22_000 });
    state = practiceReducer(state, { type: "move", id: "onion", to: "pan", now: 30_000 });
    expect(doneness(tick(state, 31_000).items[0])).toBe("Burnt");
  });
  it("does not drift below cooking boundaries after many small animation ticks", () => {
    let state = heated();
    for (let now = 100; now <= 12_000; now += 100) state = tick(state, now);
    expect(state.items[0].cooked).toBe(12);
    expect(doneness(state.items[0])).toBe("Ready");
  });
  it("accounts for the previous heat before changing heat or plating", () => {
    let state = practiceReducer(heated(), { type: "heat", heat: "off", now: 12_000 });
    state = tick(state, 20_000);
    expect(state.items[0].cooked).toBe(12);
    state = practiceReducer(state, { type: "move", id: "onion", to: "plate", now: 20_000 });
    state = practiceReducer(state, { type: "heat", heat: "high", now: 20_000 });
    expect(tick(state, 30_000).items[0].cooked).toBe(12);
  });
  it("never resets exposure when food is removed and re-added", () => {
    let state = practiceReducer(heated(), { type: "move", id: "onion", to: "plate", now: 12_000 });
    state = practiceReducer(state, { type: "move", id: "onion", to: "tray", now: 13_000 });
    expect(state.items[0].position).toBe("plate");
    state = practiceReducer(state, { type: "move", id: "onion", to: "pan", now: 14_000 });
    expect(tick(state, 23_000).items[0].cooked).toBe(21);
  });
  it("gives later additions their own start time", () => {
    const state = practiceReducer(heated(), { type: "move", id: "pepper", to: "pan", now: 10_000 });
    const next = tick(state, 19_000);
    expect(next.items.find(({ id }) => id === "pepper")?.cooked).toBe(9);
    expect(doneness(next.items[0])).toBe("Overdone");
  });
  it("doubles the reaction time and total session duration in slower mode", () => {
    let state = practiceReducer(started(true), { type: "move", id: "onion", to: "pan", now: 0 });
    state = practiceReducer(state, { type: "heat", heat: "medium", now: 0 });
    expect(doneness(tick(state, 24_000).items[0])).toBe("Ready");
    expect(tick(state, SESSION_MS).status).toBe("cooking");
    expect(tick(state, SESSION_MS * 2).status).toBe("timed-out");
  });
  it("catches up after backgrounding, finalizes at the deadline and stops further mutation", () => {
    const state = tick(heated(), SESSION_MS * 4);
    expect(state.status).toBe("timed-out");
    expect(state.heat).toBe("off");
    expect(state.items[0].cooked).toBe(120);
    expect(practiceReducer(state, { type: "move", id: "onion", to: "plate", now: SESSION_MS * 5 })).toEqual(state);
  });
  it("rejects early finish, restart during an attempt, invalid time and backwards clocks", () => {
    const state = tick(heated(), 12_000);
    expect(practiceReducer(state, { type: "finish", now: 12_000 }).status).toBe("cooking");
    expect(practiceReducer(state, { type: "start", now: 12_000, slower: true })).toEqual(state);
    expect(tick(state, Number.NaN)).toEqual(state);
    expect(tick(state, 1000)).toEqual(state);
  });
  it("rejects plating straight from the tray and unknown ingredients", () => {
    const state = started();
    expect(practiceReducer(state, { type: "move", id: "onion", to: "plate", now: 0 })).toEqual(state);
    expect(practiceReducer(state, { type: "move", id: "unknown" as "onion", to: "pan", now: 0 })).toEqual(state);
    const pan = practiceReducer(state, { type: "move", id: "onion", to: "pan", now: 0 });
    expect(practiceReducer(pan, { type: "move", id: "onion", to: "plate", now: 0 }).items[0].position).toBe("plate");
  });
  it("limits the pan to two groups and permits another after plating", () => {
    expect(PAN_CAPACITY).toBe(2);
    let state = started();
    state = practiceReducer(state, { type: "move", id: "onion", to: "pan", now: 0 });
    state = practiceReducer(state, { type: "move", id: "mushroom", to: "pan", now: 0 });
    expect(practiceReducer(state, { type: "move", id: "pepper", to: "pan", now: 0 }).items[2].position).toBe("tray");
    state = practiceReducer(state, { type: "move", id: "onion", to: "plate", now: 0 });
    expect(practiceReducer(state, { type: "move", id: "pepper", to: "pan", now: 0 }).items[2].position).toBe("pan");
  });
  it("scores plated ingredients and fails raw, missing or burnt components", () => {
    const state = { ...started(), status: "finished" as const, items: [
      { id: "onion" as const, position: "plate" as const, cooked: 12 },
      { id: "mushroom" as const, position: "plate" as const, cooked: 18 },
      { id: "pepper" as const, position: "plate" as const, cooked: 9 },
    ] };
    expect(practiceResult(state)).toEqual({ score: 100, label: "Perfect timing" });
    expect(practiceResult({ ...state, items: state.items.map((item) => item.id === "onion" ? { ...item, cooked: 16 } : item) }).score).toBe(80);
    for (const cooked of [0, 5, 21]) {
      expect(practiceResult({ ...state, items: state.items.map((item) => item.id === "onion" ? { ...item, cooked } : item) }).score).toBe(0);
    }
    expect(practiceResult(initialPractice()).score).toBe(0);
  });
});
