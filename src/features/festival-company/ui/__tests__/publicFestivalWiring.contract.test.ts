import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (file: string) => readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
const page = read("../PublicFestivalPage.tsx");
const hook = read("../../application/useFestivalLaunch.ts");

describe("published festival public workflows", () => {
  it("#3921: FAQ never promotes provisional timetable rows to published acts", () => {
    expect(page).toContain('publishedPerformances.length ? "Published performance times');
    expect(page).not.toContain('f.timetable.length ? "Published performance times');
    expect(page).toContain("const publishedPerformances = confirmedLineup.filter(");
  });

  it("#3922: uses URL-keyed sponsor image error recovery", () => {
    expect(page).toContain('import { SponsorIdentity } from "./SponsorIdentity"');
  });

  it("#3923: blocks purchases with no active character", () => {
    expect(page).toContain("canStartFestivalTicketPurchase(Boolean(user), profileId)");
    expect(page).toContain('disabled={!hasPurchasingCharacter || buy.isPending');
    expect(page).toContain("Select an active character from the Character menu");
    expect(hook).toContain('if (!profileId) throw new Error("Select an active character');
  });

  it("#3924: gates both check-in badge and button on successful verification", () => {
    expect(page).toContain("canOfferFestivalCheckIn(myCheckInEligibility, walletError, eligibilityError)");
    expect((page.match(/\{canCheckIn && \(/g) ?? []).length).toBe(2);
    expect(page).not.toContain("myCheckInEligibility?.canCheckIn &&");
  });

  it("#3925: character-scopes idempotency and finalizes the original attempt", () => {
    expect(hook).toContain("requestKeys.current.prepare(profileId, input)");
    expect(hook).toContain("requestKeys.current.confirm(input)");
  });
});
