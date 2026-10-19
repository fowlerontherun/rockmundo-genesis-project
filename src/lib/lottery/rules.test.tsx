import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { NumberPicker } from "@/components/lottery/NumberPicker";
import {
  LOTTERY_BONUS_MAX,
  LOTTERY_MAX_NUMBER,
  LOTTERY_NUMBERS_TO_PICK,
  LOTTERY_TICKET_COST,
  LOTTERY_MAX_TICKETS_PER_DRAW,
  lotterySelectionError,
  quickPickLotteryNumbers,
} from "./rules";

describe("weekly lottery shared contract (#4223)", () => {
  it("is seven unique numbers from 1 to 49, bonus 1 to 10, $2 and ten tickets", () => {
    expect([LOTTERY_NUMBERS_TO_PICK, LOTTERY_MAX_NUMBER, LOTTERY_BONUS_MAX, LOTTERY_TICKET_COST, LOTTERY_MAX_TICKETS_PER_DRAW])
      .toEqual([7, 49, 10, 2, 10]);
    expect(lotterySelectionError([1, 7, 13, 23, 35, 42, 49], 10)).toBeNull();
    expect(lotterySelectionError([1, 2, 3, 4, 5, 6], 1)).toMatch(/7 numbers/);
    expect(lotterySelectionError([1, 2, 3, 4, 5, 6, 6], 1)).toMatch(/unique/);
    expect(lotterySelectionError([0, 2, 3, 4, 5, 6, 7], 1)).toMatch(/1 to 49/);
    expect(lotterySelectionError([1, 2, 3, 4, 5, 6, 50], 1)).toMatch(/1 to 49/);
    expect(lotterySelectionError([1, 2, 3, 4, 5, 6, 7], 0)).toMatch(/bonus/);
    expect(lotterySelectionError([1, 2, 3, 4, 5, 6, 7], 11)).toMatch(/bonus/);
  });

  it("quick pick always creates seven distinct valid main numbers and a bonus", () => {
    for (let i = 0; i < 80; i++) {
      const { numbers, bonus } = quickPickLotteryNumbers();
      expect(numbers).toHaveLength(7);
      expect(new Set(numbers).size).toBe(7);
      expect(lotterySelectionError(numbers, bonus)).toBeNull();
    }
    expect(quickPickLotteryNumbers(() => 0)).toEqual({ numbers: [1, 2, 3, 4, 5, 6, 7], bonus: 1 });
  });

  it("manual picker sends seven sorted numbers and the chosen bonus at $2", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ id: "ticket-1" });
    render(<NumberPicker onSubmit={onSubmit} />);
    const user = userEvent.setup();
    expect(screen.getByRole("button", { name: "Buy Ticket ($2)" })).toBeDisabled();
    for (const n of [49, 2, 3, 4, 5, 6, 1]) {
      await user.click(screen.getAllByRole("button", { name: String(n) })[0]);
    }
    await user.click(screen.getAllByRole("button", { name: "10" })[1]);
    await user.click(screen.getByRole("button", { name: "Buy Ticket ($2)" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6, 49], 10));
    await waitFor(() => expect(screen.getByText("0/7")).toBeInTheDocument());
  });

  it("quick pick submits a valid seven-number ticket without a manual bonus", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ id: "ticket-2" });
    render(<NumberPicker onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Quick Pick/ }));
    await user.click(screen.getByRole("button", { name: "Buy Ticket ($2)" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const [numbers, bonus] = onSubmit.mock.calls[0];
    expect(lotterySelectionError(numbers, bonus)).toBeNull();
  });

  it("keeps selection and blocks repeat submit while the RPC is pending or rejects", async () => {
    let reject!: (err: Error) => void;
    const onSubmit = vi.fn().mockImplementation(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    render(<NumberPicker onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Quick Pick/ }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Buy Ticket ($2)" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Buying..." })).toBeDisabled();
    reject(new Error("server rejected purchase"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Buy Ticket ($2)" })).toBeEnabled());
    expect(screen.getByText("7/7")).toBeInTheDocument();
  });

  it("locks down the SQL and Edge Function award contract against drift", () => {
    const migration = readFileSync("supabase/migrations/20261019063411_lottery_7_of_49_purchase_draw_contract.sql", "utf8");
    const edge = readFileSync("supabase/functions/lottery-draw/index.ts", "utf8");
    expect(migration).toMatch(/cardinality\(p_selected_numbers\) IS DISTINCT FROM 7/);
    expect(migration).toMatch(/x BETWEEN 1 AND 49\)<>7/);
    expect(migration).toMatch(/p_matches NOT BETWEEN 0 AND 7/);
    expect(migration).toMatch(/v_count>=10/);
    expect(migration).toMatch(/cash=cash-2 WHERE id=p_profile_id AND cash>=2/);
    expect(migration).toMatch(/elsif matches=3 then cash:=2/);
    expect(migration).toMatch(/cash:=d.jackpot_amount/);
    expect(edge).toMatch(/generateUniqueNumbers\(7, 49\)/);
    expect(edge).toMatch(/cash: 2, xp: 0/);
    expect(edge).toMatch(/prize.cash = draw.jackpot_amount/);
  });
});
