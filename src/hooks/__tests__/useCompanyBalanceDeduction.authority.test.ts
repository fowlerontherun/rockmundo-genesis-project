import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve("src/hooks/useCompanyBalanceDeduction.ts"),
  "utf8",
);

const deductionStart = source.indexOf("export async function deductCompanyBalance");
const nextHelperStart = source.indexOf(
  "/** Look up company_id from a security_firms row */",
  deductionStart,
);
const deductionSource = source.slice(deductionStart, nextHelperStart);

describe("shared company expense deduction authority", () => {
  it("delegates generic company expenses to the authoritative API", () => {
    expect(source).toContain(
      'import { deductCompanyExpense } from "@/lib/api/companyExpenseDeductions";',
    );
    expect(deductionSource).toContain("return deductCompanyExpense({");
    expect(deductionSource).toContain("companyId,");
    expect(deductionSource).toContain("amount,");
    expect(deductionSource).toContain("description,");
    expect(deductionSource).toContain("category,");
  });

  it("does not read or mutate company money directly in the browser", () => {
    for (const forbidden of [
      '.from("companies")',
      '.from("company_transactions")',
      ".update(",
      ".insert(",
    ]) {
      expect(deductionSource).not.toContain(forbidden);
    }
  });

  it("retains the shared business entity lookup helpers", () => {
    for (const helper of [
      "getCompanyIdFromSecurityFirm",
      "getCompanyIdFromMerchFactory",
      "getCompanyIdFromLogistics",
      "getCompanyIdFromVenue",
      "getCompanyIdFromRehearsalRoom",
      "getCompanyIdFromRecordingStudio",
      "getCompanyIdFromLabel",
    ]) {
      expect(source).toContain(`export async function ${helper}`);
    }
  });
});
