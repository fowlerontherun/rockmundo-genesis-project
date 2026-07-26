import {describe,expect,it} from "vitest";
import {calculatePlayerShareBasisPoints,parseArtistIdentity,parseFestivalArtistProgrammeResult} from "../domain/festivalArtistProgramme";
const id="123e4567-e89b-42d3-a456-426614174000";
const budget={artistBudgetMinor:100000,contingencyBudgetMinor:10000,draftOfferCommitmentsMinor:0,sentOfferCommitmentsMinor:0,acceptedCommitmentsMinor:0,remainingMinor:110000,potentialApplicationRequestsMinor:0,headlineBudgetShareBasisPoints:0,playerArtistBudgetShareBasisPoints:0,npcArtistBudgetShareBasisPoints:0};
describe("Festival artist programme contract",()=>{
 it("parses each exclusive artist identity",()=>{expect(parseArtistIdentity({type:"solo",artistProfileId:id})).toEqual({type:"solo",artistProfileId:id});expect(()=>parseArtistIdentity({type:"solo",artistProfileId:id,bandId:id})).toThrow("malformed_festival_artist_programme_result")});
 it("rejects malformed canonical responses",()=>{expect(()=>parseFestivalArtistProgrammeResult({festivalCompanyId:id})).toThrow("malformed_festival_artist_programme_result")});
 it("parses an empty locked Phase 4 result",()=>{expect(parseFestivalArtistProgrammeResult({festivalCompanyId:id,festivalName:"Demo",festivalDates:["2030-01-01"],stages:[],programme:null,applicationWindows:[],applications:[],invitations:[],offers:[],bookings:[],budget,issues:[],playerArtistCount:0,npcArtistCount:0,playerArtistShareBasisPoints:0,ready:false,canWrite:true,planningVersion:0,updatedAt:null}).planningVersion).toBe(0)});
 it("uses deterministic integer player share",()=>{expect(calculatePlayerShareBasisPoints(2,3)).toBe(6666);expect(calculatePlayerShareBasisPoints(0,0)).toBe(0)});
});
