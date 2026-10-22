import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookingTechniquePractice } from "./CookingTechniquePractice";

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const add = (ingredient: string, vessel: string) => {
  click(`Select ${ingredient}`);
  click(`Add selected to ${vessel}`);
};

describe("technique workshop player interactions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("bakes a pie using an accessible mixing-bowl flow and shows a purely simulated score", () => {
    render(<CookingTechniquePractice />);
    expect(screen.getByText(/Free simulation only/)).toBeInTheDocument();
    click("Start technique practice");
    for (const ingredient of ["Apples", "Flour", "Butter", "Sugar"]) add(ingredient, "mixing bowl");
    click("Put mixture in the oven");
    expect(screen.getByRole("radio", { name: "Medium" })).toBeChecked();
    act(() => vi.advanceTimersByTime(15_000));
    expect(screen.getByText("Time on heat: 15.0 equivalent seconds · Ready")).toBeInTheDocument();
    click("Remove from oven");
    click("Finish practice dish");
    expect(screen.getByText("Excellent technique")).toBeInTheDocument();
    expect(screen.getByText(/Practice execution: 100\/100/)).toBeInTheDocument();
    expect(screen.getByText(/No ingredients or rewards were spent or granted/)).toBeInTheDocument();
  });

  it("lets a player practise drinks without activating heat or the oven", () => {
    render(<CookingTechniquePractice />);
    click("Drinks");
    expect(screen.getByRole("combobox", { name: "Practice recipe" })).toHaveValue("spiced-tea");
    click("Start technique practice");
    for (const ingredient of ["Tea", "Spices", "Milk"]) add(ingredient, "mixing jug");
    expect(screen.queryByRole("radio", { name: "Medium" })).not.toBeInTheDocument();
    for (let i = 0; i < 3; i++) click("Stir drink");
    expect(screen.getByText("Mixing: 3/5 stirs recommended · Ready")).toBeInTheDocument();
    click("Finish practice dish");
    expect(screen.getByText("Excellent technique")).toBeInTheDocument();
  });

  it("prevents mixing an incomplete recipe and mid-attempt recipe changes", () => {
    render(<CookingTechniquePractice />);
    click("Soups & stews");
    click("Start technique practice");
    expect(screen.getByRole("button", { name: "Start simmering" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Baking" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Practice recipe" })).toBeDisabled();
    add("Carrot", "soup pot");
    expect(screen.getByRole("button", { name: "Start simmering" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Finish practice dish" })).toBeDisabled();
  });
});
