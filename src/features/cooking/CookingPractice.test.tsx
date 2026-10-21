import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookingPractice } from "./CookingPractice";

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const cookFor = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const add = (name: string) => { click(new RegExp(`${name}: .*tray`)); click("Add selected ingredient to pan"); };
const plate = (name: string) => { click(new RegExp(`${name}: .*pan`)); click("Plate selected ingredient"); };

describe("cooking practice interactions", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T12:00:00Z")); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("supports a complete cooking attempt through select/place controls", () => {
    render(<CookingPractice />);
    expect(screen.getByText(/No money, inventory, boosts or XP/)).toBeInTheDocument();
    click("Start practice"); add("Onion"); add("Mushroom");
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
    cookFor(12_000); plate("Onion");
    cookFor(6000); plate("Mushroom"); add("Pepper");
    cookFor(9000); plate("Pepper"); click("Finish plating");
    expect(screen.getByText("Perfect timing")).toBeInTheDocument();
    expect(screen.getByText(/Execution score: 100\/100/)).toBeInTheDocument();
    expect(screen.getByText(/No food items or character rewards were created/)).toBeInTheDocument();
  });
  it("shows burnt food and does not allow an unfinished plate to complete", () => {
    render(<CookingPractice />); click("Start practice"); add("Onion");
    fireEvent.click(screen.getByRole("radio", { name: "High" })); cookFor(15_000);
    expect(screen.getByRole("button", { name: "Onion: Burnt, pan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish plating" })).toBeDisabled();
    plate("Onion");
    expect(within(screen.getByRole("region", { name: "Serving plate" })).getByText("Burnt")).toBeInTheDocument();
  });
  it("restores elapsed heat after a background timer gap and times out abandoned sessions", () => {
    render(<CookingPractice />); click("Start practice"); add("Onion");
    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
    act(() => { vi.setSystemTime(new Date("2026-10-21T12:00:25Z")); window.dispatchEvent(new Event("focus")); });
    expect(screen.getByRole("button", { name: "Onion: Burnt, pan" })).toBeInTheDocument();
    cookFor(100_000);
    expect(screen.getByText("Practice time ended")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Heat off" })).toBeChecked();
    click("Practise again");
    expect(screen.getByRole("button", { name: "Onion: Raw, tray" })).toBeEnabled();
  });
  it("supports keyboard selection and placement without dragging", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(<CookingPractice />);
    await user.tab(); await user.keyboard("{Enter}");
    const onion = screen.getByRole("button", { name: "Onion: Raw, tray" });
    onion.focus(); await user.keyboard("{Enter}");
    expect(onion).toHaveAttribute("aria-pressed", "true");
    screen.getByRole("button", { name: "Add selected ingredient to pan" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Onion: Raw, pan" })).toBeInTheDocument();
  });
});
