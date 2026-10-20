import { describe, expect, it } from "vitest";
import { parseEditionSponsorIdentities } from "./model";

const editionId = "aa13a001-0000-4000-8000-123456789123";
const brandId = "aa13a002-0000-4000-8000-123456789123";
const row = {
  brandId, name: "Moonwave Audio", logoUrl: "/sponsors/moonwave.svg",
  category: "music_gear", source: "npc_fallback",
};
const valid = {
  editionId, main: row, supporting: [],
  financialAuthority: "simplified_automatic_budget", postsRevenue: false,
};
describe("#2182 edition sponsor display contract", () => {
  it("accepts canonical edition identities while keeping funds separate", () => {
    expect(parseEditionSponsorIdentities(valid, editionId).main?.name).toBe("Moonwave Audio");
    expect(parseEditionSponsorIdentities({...valid, main:null}, editionId).main).toBe(null);
  });
  it("rejects revenue flags and spoofed edition identities", () => {
    expect(() => parseEditionSponsorIdentities({...valid, postsRevenue:true}, editionId)).toThrow();
    expect(() => parseEditionSponsorIdentities({...valid, editionId:brandId}, editionId)).toThrow();
  });
  it("rejects duplicate brands and a fifth supporting slot", () => {
    expect(() => parseEditionSponsorIdentities({...valid, supporting:[row]}, editionId)).toThrow();
    expect(() => parseEditionSponsorIdentities({...valid, main:null, supporting:Array(5).fill(row)}, editionId)).toThrow();
  });
  it("rejects untrusted, malformed or missing brand identities", () => {
    expect(() => parseEditionSponsorIdentities({...valid, main:{...row,name:""}}, editionId)).toThrow();
    expect(() => parseEditionSponsorIdentities({...valid, supporting:[{...row, source:"paid_contract"}], main:null}, editionId)).toThrow();
  });
});
