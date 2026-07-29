import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/hooks/useCompanies.ts", "utf8");
const start = source.indexOf("export const useCreateCompany = () => {");
const end = source.indexOf("\nexport const useUpdateCompany = () => {", start);
const block = source.slice(start, end);

describe("useCreateCompany authority boundary", () => {
  it("uses the authoritative company founding API", () => {
    expect(source).toContain('import { foundCompany } from "@/lib/api/companyFounding";');
    expect(block).toContain("await foundCompany({");
  });

  it("contains no browser-side founding writes", () => {
    expect(block).not.toContain('.from("profiles")');
    expect(block).not.toContain('.from("companies")');
    expect(block).not.toContain('from("company_transactions")');
    expect(block).not.toContain('from("company_shareholders")');
    expect(block).not.toContain("refund");
  });

  it("keeps festival founding on its dedicated secure flow", () => {
    expect(block).toContain('input.company_type === "festival"');
    expect(block).toContain("secure VIP festival RPC");
  });

  it("uses UK currency presentation", () => {
    expect(block).toContain('toLocaleString("en-GB")');
    expect(block).toContain("£");
  });
});
