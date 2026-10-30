import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const admin = readFileSync("src/pages/admin/AwardsAdmin.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261030121000_awards_admin_create_policy.sql",
  "utf8",
);

describe("awards admin creation and schema contract", () => {
  it("persists the real award shows schema and structured categories", () => {
    expect(admin).toContain('.order("ceremony_date"');
    expect(admin).toContain("ceremony_date: ceremonyDate.toISOString()");
    expect(admin).toContain("venue: showData.venue_name.trim()");
    expect(admin).toContain("year: ceremonyDate.getUTCFullYear()");
    expect(admin).toContain("categories: names.map((name) => ({ name }))");
    expect(admin).not.toContain("show_date: showData.show_date");
    expect(admin).not.toContain("venue_name: showData.venue_name");
    expect(admin).toContain("nom.category_name");
    expect(admin).toContain("nom.nominee_type");
  });

  it("permits show creation only through an admin RLS policy", () => {
    expect(migration).toContain("FOR INSERT TO authenticated");
    expect(migration).toContain("public.has_role(auth.uid(), 'admin')");
    expect(migration).not.toContain("USING (true)");
  });
});
