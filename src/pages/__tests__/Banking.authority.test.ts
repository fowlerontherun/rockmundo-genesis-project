import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const bankingSource = fs.readFileSync(
  path.resolve("src/pages/Banking.tsx"),
  "utf8",
);
const goalsSource = fs.readFileSync(
  path.resolve("src/components/banking/SavingsGoalsPanel.tsx"),
  "utf8",
);

describe("Banking canonical authority boundary", () => {
  it("uses the canonical savings-goal component and typed API", () => {
    expect(bankingSource).toContain(
      'import { SavingsGoalsPanel } from "@/components/banking/SavingsGoalsPanel";',
    );
    expect(bankingSource).toContain("<SavingsGoalsPanel");

    for (const operation of [
      "createSavingsGoal",
      "getSavingsGoalFundingSources",
      "previewSavingsGoalFunding",
      "fundSavingsGoal",
    ]) {
      expect(goalsSource).toContain(operation);
    }
  });

  it("does not call the revoked facade savings-goal RPCs", () => {
    expect(bankingSource).not.toContain('"create_savings_goal"');
    expect(bankingSource).not.toContain('"contribute_to_savings_goal"');
    expect(goalsSource).not.toContain("supabase");
    expect(goalsSource).not.toContain('.from("savings_goals")');
  });

  it("preserves preview-to-confirm idempotency", () => {
    expect(goalsSource).toContain("setIdempotencyKey(crypto.randomUUID())");
    expect(goalsSource).toContain("idempotencyKey,");
    expect(goalsSource).toContain("previewSavingsGoalFunding({");
    expect(goalsSource).toContain("fundSavingsGoal({");
  });

  it("uses the active character currency instead of a dollar default", () => {
    expect(bankingSource).toContain('summary?.currencyCode ?? "GBP"');
    expect(bankingSource).toContain("p_currency_code: currencyCode");
    expect(bankingSource).not.toContain('p_currency_code: "USD"');
    expect(bankingSource).not.toContain("($)");
    expect(goalsSource).not.toContain("($)");
  });

  it("only offers matching-currency bank transfer destinations", () => {
    expect(bankingSource).toContain(
      "candidate.currencyCode === account.currencyCode",
    );
    expect(bankingSource).toContain(
      "Currency conversion is not performed. Only matching-currency destinations",
    );
  });

  it("validates whole-unit wallet movements before invoking the RPC", () => {
    expect(bankingSource).toContain("initialMinor % 100 === 0");
    expect(bankingSource).toContain("amountMinor % 100 === 0");
    expect(goalsSource).toContain('source?.sourceKind === "wallet"');
    expect(goalsSource).toContain("amountMinor % 100 !== 0");
  });

  it("keeps direct character-cash funding available", () => {
    expect(goalsSource).toContain(
      "Pay directly from character cash or choose an eligible bank account.",
    );
    expect(goalsSource).toContain(
      'eligibleSources.find((candidate) => candidate.sourceKind === "wallet")',
    );
  });
});
