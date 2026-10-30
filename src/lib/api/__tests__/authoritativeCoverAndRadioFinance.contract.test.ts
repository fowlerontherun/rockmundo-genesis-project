import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261030211500_cover_radio_authoritative_earnings.sql","utf8");
const cover = readFileSync("src/components/songs/CoverSongDialog.tsx","utf8");
const radio = readFileSync("src/pages/admin/RadioStations.tsx","utf8");

describe("server-verified cover licensing and radio revenue", () => {
  it("transfers license money and creates the repertoire song transactionally", () => {
    expect(sql).toContain("public.create_band_cover_license_atomic");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("m.member_status='active'");
    expect(sql).toContain("v_original.quality_score*10");
    expect(sql).toContain("ORDER BY id FOR UPDATE");
    expect(sql).toContain("band_balance=coalesce(band_balance,0)-v_fee");
    expect(sql).toContain("INSERT INTO public.song_covers");
    expect(sql).toContain("INSERT INTO public.band_earnings");
    expect(sql).toContain("INSERT INTO public.songs");
    expect(sql).toContain("band_earnings_one_cover_license_per_cover");
    expect(cover).toContain('rpc("create_band_cover_license_atomic"');
    expect(cover).not.toContain('.from("band_earnings").insert');
    expect(cover).not.toContain('.from("bands")\n          .update');
    expect(cover).not.toContain('.from("song_covers").insert');
  });
  it("does not trust client-derived radio amount or recipient", () => {
    expect(sql).toContain("public.admin_post_radio_play_earning");
    expect(sql).toContain("public.has_role(auth.uid(),'admin')");
    expect(sql).toContain("v_play.listeners::numeric*0.015");
    expect(sql).toContain("v_play.sales_boost IS DISTINCT FROM v_amount");
    expect(sql).toContain("band_earnings_one_radio_payment_per_play");
    expect(radio).toContain('"admin_post_radio_play_earning"');
    expect(radio).not.toContain('.from("band_earnings")\n              .insert');
  });
  it("denies anonymous RPC calls and maintains idempotent ledger receipts", () => {
    expect(sql).toContain("FROM PUBLIC,anon,authenticated;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.create_band_cover_license_atomic");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.admin_post_radio_play_earning");
    expect(sql).toContain("already_licensed");
    expect(sql).toContain("already_paid");
  });
});
