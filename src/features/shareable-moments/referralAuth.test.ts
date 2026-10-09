import { describe, expect, it } from "vitest";
import { referralSignupMatchesSession } from "./referralAuth";

describe("referral auth fallback", () => {
  it("allows fallback binding only for the user returned by referral sign-up", () => {
    expect(referralSignupMatchesSession("signup-user", "signup-user")).toBe(true);
  });

  it("rejects an existing account that signs in after following a referral link", () => {
    expect(referralSignupMatchesSession("signup-user", "existing-user")).toBe(false);
  });

  it("does not bind when no referral-backed sign-up has been recorded", () => {
    expect(referralSignupMatchesSession(null, "existing-user")).toBe(false);
  });
});
