import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("city Festival permit UI", () => {
  it("lets Festival owners inspect and apply for an edition-scoped permit", () => {
    const hooks = read("src/hooks/useCityFestivalPermits.ts");
    const card = read("src/features/festivals/permits/FestivalCityPermitCard.tsx");
    const editions = read("src/features/festivals/editions/FestivalCompanyEditionsPage.tsx");
    expect(hooks).toContain("get_festival_city_permit_status_for_edition");
    expect(hooks).toContain("apply_for_festival_city_permit_for_edition");
    expect(card).toContain("Apply for City Hall permit");
    expect(editions).toContain("<FestivalCityPermitCard editionId={edition.festivalEditionId} />");
  });

  it("gives the mayor a City Hall decision queue", () => {
    const hooks = read("src/hooks/useCityFestivalPermits.ts");
    const queue = read("src/components/city/MayorFestivalPermitQueue.tsx");
    const services = read("src/components/city/MayorCityServicesTab.tsx");
    expect(hooks).toContain("get_city_festival_permit_queue");
    expect(hooks).toContain("decide_city_festival_permit");
    expect(queue).toContain("Approve permit");
    expect(queue).toContain("Reject");
    expect(services).toContain("<MayorFestivalPermitQueue cityId={city.id} />");
  });
});
