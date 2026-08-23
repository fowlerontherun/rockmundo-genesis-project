import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");
const exists = (file: string) => fs.existsSync(path.resolve(process.cwd(), file));

describe("simplified Festival permit UI", () => {
  it("keeps City Hall permits out of the Festival owner workflow", () => {
    const editions = read("src/features/festivals/editions/FestivalCompanyEditionsPage.tsx");
    const contract = read("docs/festivals/FESTIVAL_COMPANY_SIMPLIFIED_PRODUCT_CONTRACT.md");

    expect(editions).not.toContain("FestivalCityPermitCard");
    expect(editions).not.toContain("Apply for City Hall permit");
    expect(exists("src/features/festivals/permits/FestivalCityPermitCard.tsx")).toBe(false);
    expect(exists("src/hooks/useCityFestivalPermits.ts")).toBe(false);
    expect(contract).toContain("Permit requirements remain automatic simulation detail");
  });

  it("does not give mayors a separate Festival permit decision queue", () => {
    const services = read("src/components/city/MayorCityServicesTab.tsx");

    expect(services).not.toContain("MayorFestivalPermitQueue");
    expect(services).not.toContain("Approve permit");
    expect(exists("src/components/city/MayorFestivalPermitQueue.tsx")).toBe(false);
    expect(services).toContain("Festival permit required");
  });
});
