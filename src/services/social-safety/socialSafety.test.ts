import { describe, expect, it } from "vitest";
import { BLOCK_CONFIRMATION_COPY, EMERGENCY_SAFETY_COPY, REPORT_CATEGORY_OPTIONS } from "./config";
import { canInteractSocially } from "./SocialPermissionService";

describe("social safety configuration", () => {
  it("explains block consequences without saying the target is notified", () => {
    expect(BLOCK_CONFIRMATION_COPY).toContain("removes any friendship");
    expect(BLOCK_CONFIRMATION_COPY).toContain("does not notify");
  });

  it("marks real-world threats as emergency-adjacent reports", () => {
    expect(REPORT_CATEGORY_OPTIONS.find((c) => c.value === "threats")?.emergency).toBe(true);
    expect(EMERGENCY_SAFETY_COPY).toContain("emergency services");
  });

  it("rejects direct social interactions when permissions are restricted", () => {
    expect(canInteractSocially({ is_interaction_restricted: true } as any)).toBe(false);
    expect(canInteractSocially({ is_interaction_restricted: false } as any)).toBe(true);
  });
});
