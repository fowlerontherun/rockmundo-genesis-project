import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20291219060000_festival_b7_direct_invitation_projection.sql",
  ),
  "utf8",
);

describe("B7 direct festival invitation authority", () => {
  it("projects only through a security-definer player RPC", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.list_my_festival_artist_invitations",
    );
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("public._caller_profile_id()");
    expect(migration).toContain("public._festival_artist_authorised(");
    expect(migration).toContain("FROM PUBLIC, anon");
  });

  it("requires active band membership before exposing band invitations", () => {
    expect(migration).toContain("FROM public.band_members member");
    expect(migration).toContain("member.profile_id = actor");
    expect(migration).toContain(
      "coalesce(member.member_status, 'active') = 'active'",
    );
  });

  it("keeps invitation responses on the existing idempotent authority", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.respond_to_festival_edition_artist_invitation",
    );
    expect(migration).toContain(
      "RETURN public.respond_to_festival_artist_invitation(",
    );
    expect(migration).toContain("programme.festival_edition_id IS NULL");
  });
});
