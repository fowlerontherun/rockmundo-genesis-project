import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const source = readFileSync(fileURLToPath(new URL("../../../src/utils/retirement.ts", import.meta.url)), "utf8");
describe("retirement career totals", () => {
 it("scopes written songs and chart history to the retiring character", () => {
  expect(source).toContain('.eq("profile_id", profileId)');
  expect(source).toContain('.in("song_id", ownedIds)');
  expect(source).not.toContain('.in("song_id", songs.map(s => s.id))');
 });
 it("counts distinct performed gigs and albums linked to owned tracks", () => {
  expect(source).toContain('new Set((performances ?? []).map(p => p.gig_id)).size');
  expect(source).toContain('.from("release_songs")');
  expect(source).toContain('.eq("release_type", "album")');
 });
});