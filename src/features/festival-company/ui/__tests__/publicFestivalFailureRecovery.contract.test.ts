import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (path: string) => readFileSync(
  fileURLToPath(new URL(path, import.meta.url)), "utf8",
);

const page = read("../PublicFestivalPage.tsx");
const display = read("../festivalPublicDisplay.ts");

describe("festival visitor failure and retry wiring", () => {
  it("#4073 uses one authoritative ticket-sales label in the header and guide", () => {
    expect(page).toContain("Ticket sales: {festivalVisitorSalesLabel(eventPhase, f.launchStatus)}");
    expect(page).not.toContain('eventPhase === "dates_ended" ? "closed" : f.launchStatus.replaceAll("_", " ")');
    expect(page).toContain("{festivalVisitorSalesLabel(eventPhase, f.launchStatus)}");
  });

  it("#4074 does not equate failed ticket verification with an empty wallet", () => {
    expect(page).toContain("{walletError ? (");
    expect(page).toContain("this does not mean you have no tickets");
    expect(page).toContain("Retry ticket wallet");
    expect(page).toContain("!walletError && hasIssuedFestivalAdmission(myFestivalTickets)");
  });

  it("#4075 handles attendance query errors and suppresses cached attendance actions", () => {
    expect(page).toContain("isError: attendanceError, refetch: retryAttendance");
    expect(page).toContain("attendanceError ? [] : attendance");
    expect(page).toContain("!attendanceError && canOfferFestivalCheckIn");
    expect(page).toContain("if (attendanceError) void retryAttendance()");
  });

  it("#4076 does not infer a missing wristband when keepsakes cannot be loaded", () => {
    expect(page).toContain("isError: memorabiliaError, refetch: retryMemorabilia");
    expect(page).toContain("memorabiliaError ? undefined : festivalMemorabilia.find");
    expect(page).toContain("Festival keepsakes could not be verified");
    expect(page).toContain("Retry festival keepsakes");
  });

  it("#4077 formats both the lineup and timetable through safe edition time", () => {
    expect(page).toContain("formatFestivalEditionTime(entry.startsAt, f.timezone)");
    expect(page).toContain("formatFestivalEditionTime(entry.startsAt!, f.timezone)");
    expect(page).not.toContain("toLocaleTimeString(");
    expect(display).toContain("export function formatFestivalEditionTime(");
  });

  it("#4078 makes a real detail refetch available on load errors", () => {
    expect(page).toContain("refetch: retryPublicFestival");
    expect(page).toContain("Retry festival details");
    expect(page).toContain("void retryPublicFestival()");
  });
});
