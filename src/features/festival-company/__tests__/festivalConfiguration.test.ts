import { describe, expect, it } from "vitest";
import { inclusiveDuration, parseFestivalConfiguration } from "../domain/festivalConfiguration";
const id="123e4567-e89b-42d3-a456-426614174000";
describe("festival configuration boundary",()=>{
 it("calculates inclusive UTC dates",()=>expect(inclusiveDuration("2030-06-01","2030-06-03")).toBe(3));
 it("rejects backwards dates",()=>expect(inclusiveDuration("2030-06-03","2030-06-01")).toBeNull());
 it("rejects malformed RPC data",()=>expect(()=>parseFestivalConfiguration({festivalCompanyId:id})).toThrow("malformed_festival_configuration_result"));
 it("parses canonical empty configuration",()=>expect(parseFestivalConfiguration({festivalCompanyId:id,legalCompanyName:"Co",publicName:"Fest",shortName:"",tagline:"",description:"",homeCity:null,festivalScale:null,plannedStartDate:null,plannedEndDate:null,durationDays:null,setupStatus:"not_started",currentStep:1,configurationVersion:1,updatedAt:null,canWrite:true,scales:[],cities:[]}).publicName).toBe("Fest"));
});
