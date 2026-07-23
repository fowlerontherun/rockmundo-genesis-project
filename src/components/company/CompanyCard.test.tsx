import { describe, expect, it } from "vitest";
import { getManageRoute } from "./CompanyCard";
import type { Company } from "@/types/company";

const baseCompany: Company = {
  id: "company-123",
  owner_id: "user-1",
  name: "Test Co",
  logo_url: null,
  company_type: "festival",
  parent_company_id: null,
  headquarters_city_id: null,
  balance: 0,
  is_bankrupt: false,
  bankruptcy_date: null,
  founded_at: "2026-07-23T00:00:00Z",
  status: "active",
  reputation_score: 0,
  weekly_operating_costs: 0,
  description: null,
  created_at: "2026-07-23T00:00:00Z",
  updated_at: "2026-07-23T00:00:00Z",
  negative_balance_since: null,
};

describe("getManageRoute", () => {
  it("routes festival companies with the festival extension id", () => {
    expect(getManageRoute({ ...baseCompany, festival_company_id: "festival-extension-456" })).toBe("/companies/festivals/festival-extension-456/setup");
  });

  it("does not invent a festival setup URL from the generic company id", () => {
    expect(getManageRoute(baseCompany)).toBe("/company/company-123");
  });
});
