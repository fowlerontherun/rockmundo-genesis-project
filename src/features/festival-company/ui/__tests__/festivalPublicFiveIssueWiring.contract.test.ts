import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const page = readFileSync(
  fileURLToPath(new URL("../PublicFestivalPage.tsx", import.meta.url)), "utf8",
);

describe("public festival visitor display wiring", () => {
  it("#3960 never displays cached check-in text during wallet or eligibility errors", () => {
    expect(page).toContain("canDisplayFestivalCheckInMessage(Boolean(myCheckInEligibility), Boolean(walletError), Boolean(eligibilityError))");
    expect(page).not.toContain("{myCheckInEligibility && (");
    expect(page).toContain('canOfferFestivalCheckIn(myCheckInEligibility, walletError, eligibilityError)');
  });
  it("#3961 visitor guide and timetable share the exact published act list", () => {
    expect(page).toContain("const publishedPerformances = confirmedLineup.filter(isPublishedFestivalPerformance)");
    expect(page).toContain("{publishedPerformances.length} confirmed published performance");
    expect(page).toContain("{publishedPerformances.length > 0 ? (");
    expect(page).not.toContain("confirmedLineup.some((act) => act.startsAt && act.endsAt)");
  });
  it("#3962 wallet uses the issued-admission resolver after check-in", () => {
    expect(page).toContain("const hasAdmissionTicket = hasIssuedFestivalAdmission(myFestivalTickets)");
    expect(page).not.toContain('"transferred", "used"].includes(ticket.status)');
  });
  it("#3963 ticket availability label prioritises ended festival dates", () => {
    expect(page).toContain("festivalVisitorSalesLabel(eventPhase, f.launchStatus)");
    expect(page).toContain('eventPhase === "dates_ended" ? "closed"');
  });
  it("#3964 all nine edition start/end date renderings use the supplied festival timezone", () => {
    expect((page.match(/formatFestivalEditionDate\(f\.(startsAt|endsAt), f\.timezone/g) ?? []).length).toBe(9);
    expect(page).not.toMatch(/new Date\(f\.(startsAt|endsAt)\)\.toLocaleDateString/);
  });
});
