import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TATTOO_FONTS } from "@/data/tattooFonts";

const root = process.cwd();
const page = (path: string) => readFileSync(`${root}/${path}`, "utf8");
const tattoo = page("src/pages/TattooParlour.tsx");
const video = page("src/pages/MusicVideos.tsx");
const migration = page("supabase/migrations/20261118163000_atomic_personal_purchases_4235_4245.sql");

describe("#4235/#4245 atomic purchase boundaries", () => {
  it("routes custom ink, text ink and infection treatment through the transactional RPC", () => {
    expect(tattoo.match(/\.rpc\("purchase_personal_tattoo_atomic"/g)).toHaveLength(3);
    expect(tattoo).not.toMatch(/\.from\("profiles"\)\.update/);
    expect(tattoo).not.toMatch(/\.from\("player_tattoos"\)\.insert/);
    expect(migration).toContain("INSERT INTO public.custom_tattoo_requests");
    expect(migration).toContain("p_tattoo_id AND profile_id=p_profile_id AND user_id=v_actor");
    expect(migration).toContain("public.current_active_player_profile_id()");
  });

  it("routes video production, TV placement and promotion through the transactional RPC", () => {
    expect(video.match(/\.rpc\("purchase_music_video_atomic"/g)).toHaveLength(3);
    expect(video).not.toMatch(/\.from\("profiles"\)\.update/);
    expect(video).not.toMatch(/\.from\("music_videos"\)\.insert/);
    expect(migration).toContain("v_profile.fame<coalesce(v_fame");
    expect(migration).toContain("one_tv_placement_per_video_show");
    expect(migration).toContain("bm.profile_id=p_profile_id");
  });

  it("keeps displayed prices and reward boosts in sync with authoritative DB catalogues", () => {
    const rows = (block: string, pattern: RegExp) => [...block.matchAll(pattern)]
      .map((m) => m.slice(1)).sort((a, b) => a[0].localeCompare(b[0]));
    const tvUI = video.split("const TV_SHOWS = [")[1].split("];")[0];
    const promoUI = video.split("const PROMO_OPTIONS = [")[1].split("];")[0];
    const tvSQL = migration.split("SELECT x.cost,x.views,x.hype,x.fame")[1].split("AS x(")[0];
    const promoSQL = migration.split("SELECT x.cost,x.views INTO")[1].split("AS x(")[0];
    expect(rows(tvSQL, /\('([a-z_0-9]+)',(\d+),(\d+),(\d+),(\d+)\)/g))
      .toEqual(rows(tvUI, /\{ id: "([a-z_0-9]+)", name: "[^"]+", cost: (\d+), viewBoost: (\d+), hypeBoost: (\d+), fameRequired: (\d+)/g));
    expect(rows(promoSQL, /\('([a-z_0-9]+)',(\d+),(\d+)\)/g))
      .toEqual(rows(promoUI, /\{ id: "([a-z_0-9]+)", name: "[^"]+", cost: (\d+), viewBoost: (\d+)/g));
    const budgets = [...video.split("const budgetOptions = [")[1].split("];")[0].matchAll(/value: "(\d+)"/g)]
      .map((m) => m[1]).sort();
    expect(migration.split("p_budget NOT IN (")[1].split(")")[0].split(",").sort()).toEqual(budgets);
  });

  it("accepts only the font styles displayed in the tattoo creator", () => {
    const fontMap = migration.split("v_fmult := CASE p_font_style")[1].split("ELSE NULL END")[0];
    expect([...fontMap.matchAll(/WHEN '([a-z_0-9]+)' THEN/g)].map((m) => m[1]).sort())
      .toEqual(TATTOO_FONTS.map((font) => font.id).sort());
  });
});
