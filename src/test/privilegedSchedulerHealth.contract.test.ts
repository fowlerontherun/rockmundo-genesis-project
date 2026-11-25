import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const gigGenerator = readFileSync("supabase/functions/generate-gig-offers/index.ts", "utf8");
const diagnostics = readFileSync("supabase/diagnostics/privileged_scheduler_health.sql", "utf8");

describe("privileged scheduler health and truthful gig-offer outcomes (#4255)", () => {
  it("refuses to report an uncreated offer as successful and records partial failures", () => {
    expect(gigGenerator).toContain("requireGigOfferSources(eligiblePromoters, eligibleVenues)");
    expect(gigGenerator).toContain("if (promotersError) throw promotersError");
    expect(gigGenerator).toContain("if (venuesError) throw venuesError");
    expect(gigGenerator).toContain("if (pendingError) throw pendingError");
    expect(gigGenerator).toContain("if (insertError) throw insertError");
    expect(gigGenerator.indexOf("if (insertError) throw insertError")).toBeLessThan(
      gigGenerator.indexOf("offersCreated++"),
    );
    expect(gigGenerator).toContain("if (errorCount > 0)");
    expect(gigGenerator).toContain("await failJobRun({");
  });

  it("provides read-only evidence for all seven schedulers without exposing secrets", () => {
    expect(diagnostics.match(/'generate-gig-offers'|'generate-pr-offers'|'generate-radio-invitations'|'complete-release-manufacturing'|'process-tour-travel'|'auto-complete-gigs'|'university-attendance'/g)).toHaveLength(7);
    expect(diagnostics).toContain("sum(error_count)");
    expect(diagnostics).toContain("active_promoters");
    expect(diagnostics).not.toMatch(/\b(INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CALL)\s/i);
    expect(diagnostics).not.toContain("cron.job.command");
    expect(diagnostics).not.toContain("decrypted_secrets");
  });
});
