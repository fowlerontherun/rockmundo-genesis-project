import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE_CONFIG, validateBalanceConfig } from "../config";
import { calculateOutcomeScore, compareBalanceVersions, runBalanceGate, runProgressionScenarios } from "../simulations";
import { ACTIVE_BALANCE_VERSION, activateVersion, approveVersion, assertCanEdit, cloneDraft } from "../versions";
describe("balance configuration gates", () => {
  it("accepts the canonical config", () => expect(validateBalanceConfig(DEFAULT_BALANCE_CONFIG).ok).toBe(true));
  it("rejects missing sections and invalid weight totals", () => { const bad:any={...DEFAULT_BALANCE_CONFIG, songwriting:{...DEFAULT_BALANCE_CONFIG.songwriting, weights:{skill:2}}}; delete bad.practice; const result=validateBalanceConfig(bad); expect(result.ok).toBe(false); expect(result.issues.map(i=>i.code)).toContain("missing_section"); });
  it("keeps XP math and simulations inside baseline gates", () => { const result=runBalanceGate(DEFAULT_BALANCE_CONFIG); expect(result.ok).toBe(true); expect(result.scenarios.length).toBeGreaterThan(5); });
  it("is deterministic and compares proposed changes", () => { const proposed={...DEFAULT_BALANCE_CONFIG, practice:{...DEFAULT_BALANCE_CONFIG.practice, baseRewardXp:180}}; expect(runProgressionScenarios(DEFAULT_BALANCE_CONFIG)).toEqual(runProgressionScenarios(DEFAULT_BALANCE_CONFIG)); expect(compareBalanceVersions(DEFAULT_BALANCE_CONFIG, proposed).some(c=>c.absoluteDelta!==0)).toBe(true); });
  it("bounds representative outcome scores", () => { expect(calculateOutcomeScore(DEFAULT_BALANCE_CONFIG,"songwriting",{skill:1200,attributes:900,genreFit:1000,collaboration:1000,randomness:1000})).toBeLessThanOrEqual(1000); });
  it("protects active versions and requires approval before activation", () => { expect(()=>assertCanEdit(ACTIVE_BALANCE_VERSION)).toThrow(); const draft=cloneDraft(ACTIVE_BALANCE_VERSION,"admin"); assertCanEdit(draft); expect(()=>activateVersion(ACTIVE_BALANCE_VERSION,draft,"admin")).toThrow(); const approved=approveVersion(draft,"approver","Raise practice rewards for test cohort"); const activated=activateVersion(ACTIVE_BALANCE_VERSION,approved,"operator"); expect(activated.active.status).toBe("active"); expect(activated.retired.status).toBe("retired"); });
  it("flags exploit-sized practice caps", () => { const bad={...DEFAULT_BALANCE_CONFIG, practice:{...DEFAULT_BALANCE_CONFIG.practice, dailySessionCap:24, baseRewardXp:500}}; expect(runBalanceGate(bad).issues.map(i=>i.code)).toContain("practice_cap_excessive"); });
});
