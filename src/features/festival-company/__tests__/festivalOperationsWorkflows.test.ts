import {describe,expect,it} from "vitest";
import {parseFestivalOperationsActionResult,parseFestivalStaffVacancies,parseFestivalSupplierOpportunities} from "../domain/festivalOperationsWorkflows";
const id="123e4567-e89b-42d3-a456-426614174000";
describe("Festival operations workflow contracts",()=>{
 it("strictly parses safe vacancy discovery fields",()=>expect(parseFestivalStaffVacancies({items:[{id,festivalCompanyId:id,title:"Steward",role:"security",department:"Security",employmentType:"temporary_contract",payMinor:750000,currencyCode:"GBP",positionsRemaining:2,startsAt:"2030-01-01T09:00:00Z",endsAt:"2030-01-01T17:00:00Z",deadline:"2029-12-20T00:00:00Z",playerEligible:true,scheduleCompatibility:"available",travelSummary:"local"}]})).toHaveLength(1));
 it("rejects private or malformed vacancy payloads",()=>expect(()=>parseFestivalStaffVacancies({items:[{id}]})).toThrow("malformed_festival_staff_workflow_result"));
 it("parses supplier authority without competitor data",()=>expect(parseFestivalSupplierOpportunities({items:[{id,festivalCompanyId:id,category:"power",description:null,quantity:1,unit:"contract",minimumQuality:60,deliveryStart:null,deliveryEnd:null,serviceStart:null,serviceEnd:null,playerCompanyEligible:true,eligibility:{canQuote:true,authority:"server_verified",reasonCodes:[]}}]})).toHaveLength(1));
 it("rejects malformed transactional results",()=>expect(()=>parseFestivalOperationsActionResult({entity:null})).toThrow("malformed_festival_operations_action_result"));
});
