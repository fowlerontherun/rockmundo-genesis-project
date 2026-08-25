import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const foundation = readFileSync(
  "supabase/migrations/20291218252700_festival_attendee_foundation.sql",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20291219080000_festival_c1_wristband_inventory.sql",
  "utf8",
);
const launchHooks = readFileSync(
  "src/features/festival-company/application/useFestivalLaunch.ts",
  "utf8",
);
const publicFestivalPage = readFileSync(
  "src/features/festival-company/ui/PublicFestivalPage.tsx",
  "utf8",
);
const inventoryPage = readFileSync("src/pages/InventoryManager.tsx", "utf8");

describe("Festival C1 wristband inventory authority", () => {
  it("keeps admission as the only attendee source and one lifecycle per edition/profile", () => {
    expect(foundation).toContain("v_product_class <> 'admission'");
    expect(foundation).toContain("UNIQUE (festival_edition_id, profile_id)");
    expect(foundation).toContain("UNIQUE (admission_ticket_id)");
    expect(foundation).toContain("ON CONFLICT (festival_edition_id, profile_id) DO NOTHING");
  });

  it("links each wristband directly to its authoritative admission ticket and edition", () => {
    expect(migration).toContain("admission_ticket_id uuid");
    expect(migration).toContain("REFERENCES public.festival_issued_tickets(id)");
    expect(migration).toContain("ALTER COLUMN admission_ticket_id SET NOT NULL");
    expect(migration).toContain("festival_player_memorabilia_ticket_item_uidx");
    expect(migration).toContain("ON public.festival_player_memorabilia(admission_ticket_id, item_type)");
    expect(migration).toContain("'admissionTicketId', memorabilia.admission_ticket_id");
  });

  it("issues from canonical attendance creation rather than waiting for check-in", () => {
    expect(migration).toContain("DROP TRIGGER IF EXISTS festival_attendance_issue_wristband");
    expect(migration).toContain("CREATE TRIGGER festival_attendance_issue_wristband_on_ticket");
    expect(migration).toContain("AFTER INSERT ON public.festival_player_attendance");
    expect(migration).toContain("v_product_class <> 'admission'");
    expect(migration).toContain("v_ticket.status NOT IN ('valid', 'used')");
    expect(migration).toContain("ON CONFLICT (attendance_id, item_type) DO UPDATE");
  });

  it("backfills ticketed attendees while excluding add-ons", () => {
    expect(migration).toContain("WHERE product.product_class = 'admission'");
    expect(migration).toContain("ticket.status IN ('valid', 'used')");
    expect(migration).not.toContain("attendance.status IN ('attending', 'left_early', 'completed')");
  });

  it("refreshes and displays the same wristband in inventory and the festival ticket wallet", () => {
    expect(launchHooks).toContain('queryKey:["festival-memorabilia"]');
    expect(publicFestivalPage).toContain("useMyFestivalTickets");
    expect(publicFestivalPage).toContain("useMyFestivalMemorabilia");
    expect(publicFestivalPage).toContain("My Festival Wallet");
    expect(publicFestivalPage).toContain("Wristband issued");
    expect(publicFestivalPage).toContain("Add-ons and upgrades do not issue extra wristbands");
    expect(inventoryPage).toContain("useMyFestivalMemorabilia");
    expect(inventoryPage).toContain("Festival Keepsakes");
  });
});
