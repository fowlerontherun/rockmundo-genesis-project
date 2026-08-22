import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("simplified company-owned Festival owner flow", () => {
  it("keeps the annual owner navigation to five high-impact screens", () => {
    const routes = source(
      "src/features/festivals/ui/CanonicalFestivalRoutes.tsx",
    );

    expect(routes).toContain('{ section: "overview", label: "Plan" }');
    expect(routes).toContain(
      '{ section: "applications", label: "Line-up" }',
    );
    expect(routes).toContain(
      '{ section: "finance", label: "Tickets & budget" }',
    );
    expect(routes).toContain(
      '{ section: "live", label: "Run Festival" }',
    );
    expect(routes).toContain(
      '{ section: "history", label: "Results" }',
    );

    for (const label of [
      "Site & stages",
      "Staff & suppliers",
      "Sponsors",
      "Running order",
      "Announce & sell",
      "Schedule",
      "Contracts",
      "Operations",
      "Settlement",
    ]) {
      expect(routes).not.toContain(`label: "${label}"`);
    }
  });

  it("redirects retained detailed owner URLs to the nearest simplified screen", () => {
    const routes = source(
      "src/features/festivals/ui/CanonicalFestivalRoutes.tsx",
    );

    expect(routes).toMatch(
      /case "site":[\s\S]*festivalRoutes\.edition\(festivalCompanyId, editionId\)/,
    );
    expect(routes).toMatch(
      /case "schedule":\s*case "contracts":[\s\S]*festivalRoutes\.applications\(festivalCompanyId, editionId\)/,
    );
    expect(routes).toMatch(
      /case "operations":\s*case "sponsorship":\s*case "launch":\s*case "settlement":[\s\S]*festivalRoutes\.live\(festivalCompanyId, editionId\)/,
    );
    expect(routes).not.toContain("FestivalSitePlanner");
    expect(routes).not.toContain("FestivalOperationsPlanner");
    expect(routes).not.toContain("FestivalSponsorshipPlanner");
    expect(routes).not.toContain("FestivalTimetablePlanner");
    expect(routes).not.toContain("FestivalLaunchManager");
  });

  it("keeps company upgrades central and detailed operations automatic", () => {
    const sections = source(
      "src/features/festivals/ui/FestivalEditionSections.tsx",
    );
    const contract = source(
      "docs/festivals/FESTIVAL_COMPANY_SIMPLIFIED_PRODUCT_CONTRACT.md",
    );

    expect(sections).toContain("View eleven upgrades");
    expect(sections).toContain("Generated automatically by the game");
    expect(sections).not.toContain("Plan site & stages");
    expect(sections).not.toContain("Plan operations");
    expect(sections).not.toContain("Running order");
    expect(contract).toContain("A Festival is a **player-owned company type**");
    expect(contract).toContain(
      "The existing categories remain the long-term company progression system",
    );
    expect(contract).toContain("edit a minute-by-minute stage timetable");
    expect(contract).toContain(
      "build staff departments or individual shifts",
    );
    expect(contract).toContain("compare supplier tenders");
  });

  it("mounts one exact-edition high-level annual planning form", () => {
    const sections = source(
      "src/features/festivals/ui/FestivalEditionSections.tsx",
    );
    const annualPlan = source(
      "src/features/festivals/annual-plan/FestivalAnnualPlan.tsx",
    );

    expect(sections).toContain(
      'import { FestivalAnnualPlan } from "@/features/festivals/annual-plan/FestivalAnnualPlan"',
    );
    expect(sections).toMatch(
      /<FestivalAnnualPlan[\s\S]*festivalCompanyId=\{festivalCompanyId\}[\s\S]*editionId=\{editionId\}/,
    );
    expect(annualPlan).toContain("Annual Festival choices");
    expect(annualPlan).toContain("Festival month");
    expect(annualPlan).toContain("Start date");
    expect(annualPlan).toContain("City");
    expect(annualPlan).toContain("Site style");
    expect(annualPlan).toContain("Festival size");
    expect(annualPlan).toContain("Duration");
    expect(annualPlan).toContain("Festival vibe");
    expect(annualPlan).toContain("Marketing emphasis");
    expect(annualPlan).not.toContain("Staff shift");
    expect(annualPlan).not.toContain("Supplier tender");
    expect(annualPlan).not.toContain("Permit");
  });

  it("uses hidden annual-plan foundations instead of detailed setup screens", () => {
    const sections = source(
      "src/features/festivals/ui/FestivalEditionSections.tsx",
    );
    const projection = source(
      "supabase/migrations/20291218245500_festival_edition_internal_projections.sql",
    );

    expect(sections).toMatch(
      /FestivalEditionFinance[\s\S]*requiredBindings=\{\["site"\]\}/,
    );
    expect(sections).not.toMatch(
      /FestivalEditionApplications[\s\S]*requiredBindings=\{\["tickets"\]\}/,
    );
    expect(projection).toContain("materialize_festival_edition_foundations");
    expect(projection).toContain("'ready_for_artist_planning'");
    expect(projection).toContain("projection_source");
  });

  it("provides edition-scoped applications, invitations, offers and bookings", () => {
    const sections = source(
      "src/features/festivals/ui/FestivalEditionSections.tsx",
    );
    const manager = source(
      "src/features/festival-company/ui/SimplifiedFestivalLineupManager.tsx",
    );
    const repository = source(
      "src/features/festivals/projections/repository.ts",
    );
    const migration = source(
      "supabase/migrations/20291218245800_complete_simplified_festival_lineup.sql",
    );

    expect(sections).toContain("FestivalLineupWorkflowManager");
    expect(manager).toContain("Applications");
    expect(manager).toContain("Invite an act");
    expect(manager).toContain("Send offer");
    expect(manager).toContain("Confirmed acts");
    expect(manager).toContain('useFestivalArtistAction("reviewApplication")');
    expect(manager).toContain('useFestivalEditionArtistAction("sendInvitation")');
    expect(manager).toContain('useFestivalEditionArtistAction("createOffer")');
    expect(repository).toContain("search_festival_edition_artist_candidates");
    expect(repository).toContain("send_festival_edition_artist_invitation");
    expect(repository).toContain("create_festival_edition_artist_offer");
    expect(repository).toContain("send_festival_edition_artist_offer");
    expect(migration).toContain(
      "festival_edition_id = p_festival_edition_id",
    );
    expect(migration).toContain("_festival_artist_committed_minor(programme.id)");
    expect(migration).toContain("FROM public.bands band");
  });

  it("presents live runtime as an automatic Festival simulation", () => {
    const runtime = source(
      "src/features/festivals/runtime/FestivalLiveControlRoom.tsx",
    );

    expect(runtime).toContain("Annual Festival simulation");
    expect(runtime).toContain("Automatic operations");
    expect(runtime).toContain(
      "These systems are simulated from company upgrades and are not",
    );
    expect(runtime).not.toContain("Authoritative live runtime");
    expect(runtime).not.toContain("Authorised actions:");
    expect(runtime).not.toContain("Site capacity");
  });
});
