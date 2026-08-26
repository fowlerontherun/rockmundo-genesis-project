import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../");
const source = fs.readFileSync(path.join(repoRoot, "src/components/company/CompanyRecruitmentLifecycle.tsx"), "utf8");

describe("D7 company recruitment authority", () => {
  it("keeps recruitment writes behind RPC boundaries", () => {
    expect(source).toContain('rpc("manage_company_vacancy"');
    expect(source).toContain('rpc("set_company_vacancy_requirements"');
    expect(source).toContain('rpc("review_company_application"');
    expect(source).not.toMatch(/\.from\(["']company_vacancies["']\)\.(insert|update|delete|upsert)/);
    expect(source).not.toMatch(/\.from\(["']company_job_applications["']\)\.(insert|update|delete|upsert)/);
    expect(source).not.toMatch(/\.from\(["']company_employees["']\)\.(insert|update|delete|upsert)/);
  });

  it("exposes shortlist, requirements, analytics and retained history", () => {
    expect(source).toContain('action: "shortlist"');
    expect(source).toContain("Minimum verified reputation");
    expect(source).toContain("Minimum skills");
    expect(source).toContain('rpc("get_company_labor_market_analytics"');
    expect(source).toContain("Recruitment history");
    expect(source).not.toContain("Delete cancelled vacancy");
  });
});
