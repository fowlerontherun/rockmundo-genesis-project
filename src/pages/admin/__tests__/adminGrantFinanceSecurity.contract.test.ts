import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261030204500_admin_grants_and_band_earnings_privileges.sql","utf8");
const ui = readFileSync("src/pages/admin/FameFansGifting.tsx","utf8");

describe("finance ledgers and atomic admin grants", () => {
  it("revokes destructive database table privileges from browser roles", () => {
    expect(migration).toContain("REVOKE INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER");
    expect(migration).toContain("REVOKE UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER");
    expect(migration).toContain("public.band_earnings FROM authenticated");
  });
  it("requires authenticated admin and a unique receipt for idempotence", () => {
    expect(migration).toContain("public.has_role(auth.uid(),'admin')");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.admin_band_grant_receipts");
    expect(migration).toContain("WHERE id=p_request_id");
    expect(migration).toContain("already_granted");
    expect(migration).toContain("WHERE id=p_band_id FOR UPDATE");
    expect(migration).toContain("ALTER TABLE public.admin_band_grant_receipts ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FROM PUBLIC,anon,authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.admin_grant_band_support");
  });
  it("replaces browser writes to bands and ledger with one RPC", () => {
    expect(ui).toContain('rpc("admin_grant_band_support"');
    expect(ui).toContain("p_request_id: bandGrantRequestId");
    expect(ui).toContain("setBandGrantRequestId(crypto.randomUUID())");
    expect(ui).not.toContain('.from("band_earnings").insert');
    expect(ui).not.toContain('.from("bands").update(updates).eq("id", bandId)');
    expect(migration).toContain("INSERT INTO public.band_earnings");
    expect(migration).toContain("source");
    expect(migration).toContain("'admin_grant'");
  });
});
