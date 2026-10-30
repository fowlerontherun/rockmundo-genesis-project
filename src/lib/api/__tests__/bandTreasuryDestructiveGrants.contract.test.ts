import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql=readFileSync(
 "supabase/migrations/20261030224500_revoke_band_treasury_destructive_privileges.sql","utf8"
);

describe("band and treasury grant defense-in-depth",()=>{
  it("revokes destructive bypass privileges from ordinary SQL web roles",()=>{
    expect(sql).toContain("REVOKE TRUNCATE,REFERENCES,TRIGGER");
    expect(sql).toContain("public.bands");
    expect(sql).toContain("public.band_treasuries");
    expect(sql).toContain("public.band_treasury_transactions");
    expect(sql).toContain("FROM anon,authenticated");
  });
  it("blocks direct treasury writes without revoking gameplay band UPDATE",()=>{
    expect(sql).toContain("REVOKE INSERT,UPDATE,DELETE");
    expect(sql).not.toContain("REVOKE UPDATE ON TABLE public.bands");
  });
});
