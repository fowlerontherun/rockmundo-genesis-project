import { describe, expect, it } from "vitest";
import { projectKitchen, type CookingActionEvent } from "./liveCookingView";

const start = "2026-10-22T08:00:00.000Z";
const deadline = "2026-10-22T08:02:00.000Z";
const ingredient = [{ ingredient_slug: "onion", units_required: 1 }];
const windows = [{ ingredient_slug: "onion", ready_seconds: 12, overdone_seconds: 16, burnt_seconds: 21 }];
const event = (action_sequence: number, seconds: number, action_type: CookingActionEvent["action_type"],
  heat: CookingActionEvent["heat"] = null, ingredient_slug: string | null = null): CookingActionEvent => ({
  action_sequence, action_type, ingredient_slug, heat,
  recorded_at: new Date(Date.parse(start) + seconds * 1000).toISOString(),
});
const seconds = (n: number) => Date.parse(start) + n * 1000;

describe("live cooking read-only server event projection", () => {
  it("reconstructs medium heat, exact ready time and serving plate", () => {
    const events = [
      event(1, 1, "heat", "medium"),
      event(2, 2, "add", null, "onion"),
      event(3, 14, "remove", null, "onion"),
    ];
    const view = projectKitchen(start, deadline, ingredient, windows, events, seconds(18));
    expect(view.items[0]).toMatchObject({ position: "plate", seconds: 12, stage: "Ready" });
    expect(view.allPlated).toBe(true);
  });
  it("keeps heating a pan ingredient on reconnect, up to the server deadline", () => {
    const view = projectKitchen(start, deadline, ingredient, windows,
      [event(1, 1, "heat", "high"), event(2, 2, "add", null, "onion")], seconds(130));
    expect(view.items[0].stage).toBe("Burnt");
    expect(view.heat).toBe("off");
    expect(view.remainingSeconds).toBe(0);
  });
  it("does not allow an accepted plated ingredient to become fresh again in presentation", () => {
    const view = projectKitchen(start, deadline, ingredient, windows, [
      event(1, 1, "heat", "medium"), event(2, 2, "add", null, "onion"),
      event(3, 14, "remove", null, "onion"), event(4, 15, "add", null, "onion"),
    ], seconds(25));
    expect(view.items[0]).toMatchObject({ position: "plate", seconds: 12, stage: "Ready" });
  });
  it("never grants quality, XP or food; it only projects raw display state", () => {
    const view = projectKitchen(start, deadline, ingredient, windows, [], seconds(10));
    expect(view.items[0]).toMatchObject({ position: "tray", stage: "Raw" });
    expect(view.allPlated).toBe(false);
    expect(Object.keys(view)).toEqual(["heat", "items", "remainingSeconds", "allPlated"]);
  });
});
