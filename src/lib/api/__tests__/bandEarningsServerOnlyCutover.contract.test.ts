import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration=readFileSync("supabase/migrations/20261030222000_revoke_client_band_earnings_insert.sql","utf8");
const denied=readFileSync("supabase/tests/band_earnings_browser_insert_denied.sql","utf8");
const cover=readFileSync("src/components/songs/CoverSongDialog.tsx","utf8");
const radio=readFileSync("src/pages/admin/RadioStations.tsx","utf8");
const grants=readFileSync("src/pages/admin/FameFansGifting.tsx","utf8");

describe("cut over finance earnings to trusted server writes",()=>{
  it("removes the client INSERT RLS policy and table grant",()=>{
    expect(migration).toContain('DROP POLICY IF EXISTS "Authenticated users can insert earnings"');
    expect(migration).toContain("REVOKE INSERT ON TABLE public.band_earnings FROM authenticated;");
    expect(migration).not.toContain("REVOKE SELECT");
  });
  it("keeps all known browser earning writers on validated server RPCs",()=>{
    expect(cover).toContain('rpc("create_band_cover_license_atomic"');
    expect(radio).toContain('"admin_post_radio_play_earning"');
    expect(grants).toContain('rpc("admin_grant_band_support"');
    for(const source of [cover,radio,grants]){
      expect(source).not.toContain('.from("band_earnings").insert');
    }
  });
  it("includes a real authenticated role denial test with safe rollback",()=>{
    expect(denied).toContain("SET LOCAL ROLE authenticated");
    expect(denied).toContain("INSERT INTO public.band_earnings");
    expect(denied).toContain("EXCEPTION WHEN insufficient_privilege");
    expect(denied).toContain("PZX01");
  });
});
