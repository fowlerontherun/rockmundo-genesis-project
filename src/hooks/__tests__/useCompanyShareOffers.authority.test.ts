import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const legacySource = fs.readFileSync(
  path.resolve("src/hooks/useCompanyShares.ts"),
  "utf8",
);
const offerSource = fs.readFileSync(
  path.resolve("src/hooks/useCompanyShareOffers.ts"),
  "utf8",
);
const panelSource = fs.readFileSync(
  path.resolve("src/components/company/CompanySharesPanel.tsx"),
  "utf8",
);

const legacyIssuanceArea = legacySource.slice(
  0,
  legacySource.indexOf("export const useDistributeAnnualProfit"),
);

describe("company share offer authority", () => {
  it("removes the legacy browser-side issuance mutation", () => {
    expect(legacySource).toContain(
      'export { useIssueCompanyShares } from "@/hooks/useCompanyShareOffers";',
    );
    expect(legacySource).not.toContain("export const useIssueCompanyShares =");

    for (const forbidden of [
      '.from("companies")\n          .update',
      '.from("profiles")\n          .update',
      '.from("company_transactions").insert',
      '.from("company_shareholders" as any)\n          .update',
      '.from("company_shareholders" as any)\n          .insert',
      '.from("company_share_transfers" as any).insert',
    ]) {
      expect(legacyIssuanceArea).not.toContain(forbidden);
    }
  });

  it("uses the authoritative proposal and response APIs", () => {
    expect(offerSource).toContain("mutationFn: proposeCompanyShareIssuance");
    expect(offerSource).toContain("mutationFn: respondCompanyShareOffer");
    expect(offerSource).toContain('.from("company_share_offers" as any)');
  });

  it("requires buyer action for paid offers", () => {
    expect(panelSource).toContain("Incoming Share Offers");
    expect(panelSource).toContain("offerId: offer.id, accept: false");
    expect(panelSource).toContain("offerId: offer.id, accept: true");
    expect(panelSource).toContain("Send paid offer");
    expect(panelSource).toContain("buyer must accept");
  });

  it("uses UK currency formatting", () => {
    expect(offerSource).toContain('new Intl.NumberFormat("en-GB"');
    expect(offerSource).toContain('currency: "GBP"');
    expect(panelSource).toContain('new Intl.NumberFormat("en-GB"');
    expect(panelSource).toContain('currency: "GBP"');
  });
});
