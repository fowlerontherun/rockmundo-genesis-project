import { describe, expect, it } from "vitest";
import { mobileSocialAuditFindings } from "./MobileSocial";

describe("MobileSocial phase 6 audit", () => {
  it("documents audited desktop fallbacks and existing realtime/query systems", () => {
    expect(mobileSocialAuditFindings.length).toBeGreaterThanOrEqual(5);
    expect(mobileSocialAuditFindings.join(" ")).toContain("/social/messages");
    expect(mobileSocialAuditFindings.join(" ")).toContain("Supabase postgres_changes");
    expect(mobileSocialAuditFindings.join(" ")).toContain("useFriendships");
  });

  it("records that mobile social must not create a parallel social system", () => {
    const audit = mobileSocialAuditFindings.join(" ");
    expect(audit).toContain("source of truth");
    expect(audit).toContain("does not add a second transport");
  });
});
