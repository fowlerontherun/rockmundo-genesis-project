import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hook = readFileSync("src/hooks/useAwards.ts", "utf8");
const page = readFileSync("src/pages/Awards.tsx", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261030110500_guard_award_nomination_submissions.sql",
  "utf8",
);

describe("award nomination authority contract", () => {
  it("does not let client-side fame scores shortlist nominations", () => {
    expect(hook).not.toMatch(/autoNominationScore|auto_nominated: true|status: "shortlisted"/);
    expect(page).not.toMatch(/auto_nomination_score|auto_nomination_threshold/);
    expect(hook).toContain('toast.success("Nomination submitted for review")');
  });

  it("limits changes to admins and validates submitted nominee, category, and show", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Nominators can update their nominations"');
    expect(migration).toContain('CREATE POLICY "Awards admins manage nominations"');
    expect(migration).toContain("v_show.status IS DISTINCT FROM 'nominations_open'");
    expect(migration).toContain("v_band.status IS DISTINCT FROM 'active'");
    expect(migration).toContain("NEW.nominee_id IS DISTINCT FROM NEW.band_id::text");
    expect(migration).toContain("category->>'name' = NEW.category_name");
    expect(migration).toContain("NEW.status IS DISTINCT FROM 'pending'");
    expect(migration).toContain("NEW.vote_count IS DISTINCT FROM 0");
    expect(migration).toContain("NEW.submission_data := jsonb_build_object");
  });
});
