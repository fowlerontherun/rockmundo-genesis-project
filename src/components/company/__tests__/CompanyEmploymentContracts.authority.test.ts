import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../");
const contractsSource = fs.readFileSync(path.join(repoRoot, "src/components/company/CompanyEmploymentContracts.tsx"), "utf8");
const rosterSource = fs.readFileSync(path.join(repoRoot, "src/components/company/CompanyEmployeeRoster.tsx"), "utf8");
const marketplaceSource = fs.readFileSync(path.join(repoRoot, "src/components/company/CompanyShiftMarketplace.tsx"), "utf8");

describe("D8 employment contract authority", () => {
  it("keeps employment mutations behind RPC boundaries", () => {
    expect(contractsSource).toContain('rpc("get_company_employment_contracts"');
    expect(contractsSource).toContain('rpc("open_company_employment_dispute"');
    expect(contractsSource).toContain('rpc("terminate_company_employment_contract"');
    expect(contractsSource).not.toMatch(/\.from\(["']company_employment_contracts["']\)\.(insert|update|delete|upsert)/);
    expect(contractsSource).not.toMatch(/\.from\(["']company_employment_payroll["']\)\.(insert|update|delete|upsert)/);
    expect(contractsSource).not.toMatch(/\.from\(["']company_employment_task_evidence["']\)\.(insert|update|delete|upsert)/);
  });

  it("routes contracted dismissal through the D8 termination boundary", () => {
    expect(rosterSource).toContain('rpc("get_company_employment_contracts"');
    expect(rosterSource).toContain('rpc("terminate_company_employment_contract"');
    expect(rosterSource).toContain('p_reason: "employer_termination"');
  });

  it("exposes the contract view to both employee and employer surfaces", () => {
    expect(marketplaceSource).toContain("<CompanyEmploymentContracts />");
    expect(rosterSource).toContain("<CompanyEmploymentContracts companyId={companyId} />");
    expect(contractsSource).toContain("Payroll evidence");
    expect(contractsSource).toContain("Open dispute");
  });
});
