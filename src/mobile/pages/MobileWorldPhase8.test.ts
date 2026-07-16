import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve("src/mobile/pages/MobileWorldPhase5.tsx"), "utf8");

describe("Mobile World Phase 8 route migration", () => {
  it("keeps core world and economy routes inside the mobile shell", () => {
    for (const route of ["/mobile/world/city", "/mobile/world/venues", "/mobile/world/events", "/mobile/world/companies", "/mobile/world/jobs", "/mobile/world/marketplace", "/mobile/world/shops", "/mobile/world/search"]) {
      expect(source).toContain(route);
    }
    expect(source).not.toContain("/world/current-city");
    expect(source).not.toContain("/world-companies");
  });

  it("documents server-authoritative transaction and application validation in mobile flows", () => {
    for (const text of ["Server revalidates current price", "Duplicate submissions are disabled", "no mobile-only economy logic", "sold listing", "closed job"]) {
      expect(source).toContain(text);
    }
  });

  it("uses dedicated mobile sections for city, venue, shop, marketplace, company, job, event and search experiences", () => {
    for (const component of ["CityMobile", "VenuesMobile", "ShopsMobile", "MarketplaceMobile", "CompaniesMobile", "JobsMobile", "EventsMobile", "SearchMobile"]) {
      expect(source).toContain(`function ${component}`);
    }
  });
});
