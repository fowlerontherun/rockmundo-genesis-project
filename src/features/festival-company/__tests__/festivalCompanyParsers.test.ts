import { describe, expect, it } from "vitest";
import {
  isCapabilityObject,
  isFestivalSetupState,
  isFoundFestivalCompanyRpcResult,
  isOwnedFestivalCompanySummary,
} from "../data/festivalCompanyRepository";

const uuid = "81280000-0000-4000-8000-000000000001";
const uuid2 = "81280000-0000-4000-8000-000000000002";

describe("festival company strict RPC parsers", () => {
  it("requires complete founding results with a valid finance transaction and canonical cost", () => {
    expect(isFoundFestivalCompanyRpcResult({
      companyId: uuid,
      festivalCompanyId: uuid2,
      personalFinancialTransactionId: "81280000-0000-4000-8000-000000000003",
      personalCash: 8_000_000,
      foundingCost: 2_000_000,
      idempotent: false,
    })).toBe(true);

    expect(isFoundFestivalCompanyRpcResult({ companyId: uuid, festivalCompanyId: uuid2, personalCash: 8_000_000, foundingCost: 1, idempotent: false })).toBe(false);
    expect(isFoundFestivalCompanyRpcResult({ companyId: uuid, festivalCompanyId: uuid2, personalFinancialTransactionId: "not-a-uuid", personalCash: 8_000_000, foundingCost: 2_000_000, idempotent: false })).toBe(false);
  });

  it("fails closed for partial setup, capabilities and owned-company records", () => {
    expect(isCapabilityObject({
      newFestivalSystemEnabled: true,
      festivalCompanyCreationEnabled: true,
      festivalCompanyManagementEnabled: true,
      festivalConfigurationEnabled: true,
      companyLimit: 3,
    })).toBe(true);
    expect(isCapabilityObject({ newFestivalSystemEnabled: true, companyLimit: 3 })).toBe(false);

    expect(isFestivalSetupState({
      festivalCompanyId: uuid,
      companyId: uuid2,
      publicName: "Runtime Fest",
      legalCompanyName: "Runtime LLC",
      companyBalance: 0,
      isBankrupt: false,
      setupCompleted: false,
      configurationComplete: false,
      firstEditionExists: false,
    })).toBe(true);
    expect(isFestivalSetupState({ festivalCompanyId: uuid, companyId: uuid2, publicName: "", legalCompanyName: "Runtime LLC" })).toBe(false);

    expect(isOwnedFestivalCompanySummary({
      festivalCompanyId: uuid,
      companyId: uuid2,
      publicName: "Runtime Fest",
      legalCompanyName: "Runtime LLC",
      setupStatus: "setup_required",
      setupCompleted: false,
      configurationComplete: false,
      firstEditionExists: false,
      companyBalance: 0,
      managementEnabled: true,
    })).toBe(true);
    expect(isOwnedFestivalCompanySummary({ festivalCompanyId: uuid, companyId: uuid2, publicName: "Runtime Fest", legalCompanyName: "Runtime LLC" })).toBe(false);
  });
});
