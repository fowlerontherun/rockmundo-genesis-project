import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read=(p:string)=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const sql=read("../../../supabase/migrations/20261013161500_atomic_band_leave.sql");
const client=read("../../../src/utils/bandMembers.ts");
describe("band leave atomic integrity",()=>{
 it("settles membership, royalty retention, chemistry and audit together",()=>{
 for (const statement of ["DELETE FROM public.band_members","UPDATE public.band_song_ownership","UPDATE public.bands","INSERT INTO public.band_chemistry_events","INSERT INTO public.band_history"]) expect(sql).toContain(statement);
 expect(sql).toContain("user_id=v_user");
 });
 it("refuses leader and solo departures without a prior membership deletion",()=>{
 expect(sql.indexOf("TRANSFER_LEADERSHIP_FIRST")).toBeLessThan(sql.indexOf("DELETE FROM public.band_members"));
 expect(sql).toContain("SOLO_ARTIST_CANNOT_LEAVE");
 expect(client).toContain("rpc('leave_band_atomic'");
 });
});