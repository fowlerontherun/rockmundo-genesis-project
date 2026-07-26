export const STAFF_WORKFLOW_ERROR="malformed_festival_staff_workflow_result";
export const SUPPLIER_WORKFLOW_ERROR="malformed_festival_supplier_workflow_result";
export const ACTION_RESULT_ERROR="malformed_festival_operations_action_result";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const uuid=(v:unknown)=>typeof v==="string"&&UUID.test(v);
const integer=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const timestamp=(v:unknown)=>typeof v==="string"&&!Number.isNaN(Date.parse(v));
const currency=(v:unknown)=>typeof v==="string"&&/^[A-Z]{3}$/.test(v);
export interface FestivalStaffVacancy {id:string;festivalCompanyId:string;title:string;role:string;department:string;employmentType:string;payMinor:number;currencyCode:string;positionsRemaining:number;startsAt:string;endsAt:string;deadline:string;playerEligible:boolean;scheduleCompatibility:string;travelSummary:string}
export interface FestivalSupplierOpportunity {id:string;festivalCompanyId:string;category:string;description:string|null;quantity:number;unit:string;minimumQuality:number;deliveryStart:string|null;deliveryEnd:string|null;serviceStart:string|null;serviceEnd:string|null;playerCompanyEligible:boolean;eligibility:{canQuote:boolean;authority:string;reasonCodes:string[]}}
export interface FestivalOperationsActionResult {operations:unknown;entity:Record<string,unknown>;communications:Record<string,unknown>[]}
export type FestivalStaffApplication=Record<string,unknown>&{id:string;status:string;application_version:number};
export type FestivalStaffAssignment=Record<string,unknown>&{id:string;status:string;assignment_version:number};
export type FestivalStaffShift=Record<string,unknown>&{id:string;starts_at:string;ends_at:string};
export type FestivalSupplierQuote=Record<string,unknown>&{id:string;status:string;quote_version:number;total_cost_minor:number;currency_code:string};
export type FestivalSupplierContract=Record<string,unknown>&{id:string;status:string;contract_version:number;total_commitment_minor:number;currency_code:string};
function fail(code:string):never{throw new Error(code)}
export function parseFestivalStaffVacancies(v:unknown):FestivalStaffVacancy[]{if(!record(v)||!Array.isArray(v.items))fail(STAFF_WORKFLOW_ERROR);return v.items.map(item=>{if(!record(item)||!uuid(item.id)||!uuid(item.festivalCompanyId)||typeof item.title!=="string"||typeof item.role!=="string"||typeof item.department!=="string"||typeof item.employmentType!=="string"||!integer(item.payMinor)||!currency(item.currencyCode)||!integer(item.positionsRemaining)||!timestamp(item.startsAt)||!timestamp(item.endsAt)||!timestamp(item.deadline)||typeof item.playerEligible!=="boolean"||typeof item.scheduleCompatibility!=="string"||typeof item.travelSummary!=="string")fail(STAFF_WORKFLOW_ERROR);return item as unknown as FestivalStaffVacancy})}
export function parseFestivalSupplierOpportunities(v:unknown):FestivalSupplierOpportunity[]{if(!record(v)||!Array.isArray(v.items))fail(SUPPLIER_WORKFLOW_ERROR);return v.items.map(item=>{if(!record(item)||!uuid(item.id)||!uuid(item.festivalCompanyId)||typeof item.category!=="string"||!integer(item.quantity)||typeof item.unit!=="string"||!integer(item.minimumQuality)||typeof item.playerCompanyEligible!=="boolean"||!record(item.eligibility)||typeof item.eligibility.canQuote!=="boolean"||typeof item.eligibility.authority!=="string"||!Array.isArray(item.eligibility.reasonCodes))fail(SUPPLIER_WORKFLOW_ERROR);return item as unknown as FestivalSupplierOpportunity})}
export function parseFestivalOperationsActionResult(v:unknown):FestivalOperationsActionResult{if(!record(v)||!record(v.entity)||!Array.isArray(v.communications))fail(ACTION_RESULT_ERROR);return v as unknown as FestivalOperationsActionResult}
