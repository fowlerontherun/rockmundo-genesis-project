import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("pre-event Festival owner and directory sales preview", () => {
  const owner = source("src/features/festival-company/ui/FestivalOwnerSalesPreview.tsx");
  const planner = source("src/features/festival-company/ui/FestivalTicketPlanner.tsx");
  const hooks = source("src/features/festival-company/application/useFestivalLaunch.ts");
  const directory = source("src/features/festival-company/ui/PublicFestivalDirectory.tsx");

  it("places current sales beside the owner's ticket plan", () => {
    expect(planner).toContain("<FestivalOwnerSalesPreview");
    expect(planner).toContain("festivalDates={data.festivalDates}");
    expect(owner).toContain("Paid admissions sold");
    expect(owner).toContain("Available admissions");
    expect(owner).toContain("Gross ticket receipts");
    expect(owner).toContain("Confirmed acts");
  });

  it("reads the nested launch object and never carries last year's sales to a new edition", () => {
    expect(owner).toContain("launch.data?.launch ?? launch.data");
    expect(owner).toContain("current.startsAt.slice(0, 10) !== festivalDates[0]");
    expect(owner).toContain("useFestivalSalesSummary");
    expect(owner).toContain("usePublicFestival");
    expect(owner).not.toContain('.from("festival_ticket_sales")');
  });

  it("keeps sales up to date and previews the complete publicly announced lineup", () => {
    expect(owner).toContain("festivalRoutes.publicCompany(slug)");
    expect(hooks).toContain('c.invalidateQueries({queryKey:["festival-sales-summary"]})');
    expect(hooks).toContain("refetchInterval:60_000");
  });

  it("marks a festival sold out when admissions sell out even if upgrades remain", () => {
    expect(directory).toContain("festival.ticketSales.admissionTicketAllocation > 0");
    expect(directory).toContain("festival.ticketSales.admissionTicketsAvailable === 0");
    expect(directory).toContain('soldOut ? "Sold out" :');
    expect(directory).toContain('"Admission sold out"');
  });
});
