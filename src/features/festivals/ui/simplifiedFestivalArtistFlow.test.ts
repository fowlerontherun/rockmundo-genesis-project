import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("simplified Festival artist flow", () => {
  it("keeps invitations, offers and confirmed bookings inside Festival opportunities", () => {
    const page = source(
      "src/features/festival-company/ui/FestivalArtistOpportunitiesPage.tsx",
    );

    expect(page).toContain('useFestivalArtistAction("respondInvitation")');
    expect(page).toContain('useFestivalArtistAction("respondOffer")');
    expect(page).toContain('response: "interested" | "declined"');
    expect(page).toContain('answerInvitation(row, "interested")');
    expect(page).toContain('answerInvitation(row, "declined")');
    expect(page).toContain('response: "accept" | "decline"');
    expect(page).toContain('answerOffer(row, "accept")');
    expect(page).toContain('answerOffer(row, "decline")');
    expect(page).toContain("Performance offers");
    expect(page).toContain("Confirmed Festival bookings");
    expect(page).not.toContain("/festival-contracts/");
  });

  it("matches the authoritative artist response transitions", () => {
    const migration = source(
      "supabase/migrations/20291217151000_complete_festival_artist_workflows.sql",
    );

    expect(migration).toContain(
      "p_response NOT IN ('interested','declined')",
    );
    expect(migration).toContain("p_response NOT IN ('accept','decline')");
    expect(migration).toContain(
      "INSERT INTO public.festival_artist_bookings",
    );
    expect(migration).toContain(
      "INSERT INTO public.festival_financial_commitments",
    );
  });

  it("opens completed annual Festivals directly on their Results screen", () => {
    const editions = source(
      "src/features/festivals/editions/FestivalCompanyEditionsPage.tsx",
    );

    expect(editions).toMatch(
      /edition\.editable[\s\S]*festivalRoutes\.edition\([\s\S]*festivalRoutes\.history\(/,
    );
    expect(editions).toContain('edition.editable ? "Plan Festival" : "View result"');
  });
});
