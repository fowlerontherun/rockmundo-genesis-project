import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {getFestivalOperationsPlan,saveFestivalOperationsPlan,festivalOperationsAction,getAvailableFestivalStaffVacancies,getAvailableFestivalSupplierOpportunities} from "../data/festivalCompanyRepository";
import type {FestivalOperationsDraft} from "../domain/festivalOperationsPlan";
import type {FestivalOperationsActionResult} from "../domain/festivalOperationsWorkflows";
export const festivalOperationsQueryKey=(id?:string)=>["festival-operations",id] as const;
export const useFestivalOperationsPlan=(id?:string,enabled=true)=>useQuery({queryKey:festivalOperationsQueryKey(id),enabled:enabled&&Boolean(id),retry:false,queryFn:()=>getFestivalOperationsPlan(id!)});

// Owner-side operations and supplier actions also change publicly visible staffing,
// procurement and live-edition availability. Refresh both public and owner consumers.
const refreshFestivalOperationsViews=(client:ReturnType<typeof useQueryClient>,festivalCompanyId:string)=>
  Promise.all([
    festivalOperationsQueryKey(festivalCompanyId),["festival-jobs"],
    ["company-procurement"],["festival-edition-budget"],["notifications"],["mail"],
    ["festival-runtime"],["festival-timetable"],["public-festival"],
    ["festival-directory"],["public-festival-timetable"],
  ].map(queryKey=>client.invalidateQueries({queryKey})));
export const useSaveFestivalOperationsPlan=()=>{const client=useQueryClient();return useMutation({mutationFn:(input:{festivalCompanyId:string;expectedVersion:number;plan:FestivalOperationsDraft;idempotencyKey:string;complete?:boolean})=>saveFestivalOperationsPlan(input),onSuccess:data=>{client.setQueryData(festivalOperationsQueryKey(data.festivalCompanyId),data);void refreshFestivalOperationsViews(client,data.festivalCompanyId);}})};
export const useFestivalOperationsAction=(action:string)=>{const client=useQueryClient();return useMutation({mutationFn:(input:{festivalCompanyId:string;payload:Record<string,unknown>;idempotencyKey:string})=>festivalOperationsAction(action,input.payload,input.idempotencyKey),onSuccess:(_,input)=>void refreshFestivalOperationsViews(client,input.festivalCompanyId)})};

export const useAvailableFestivalVacancies=(filters:Record<string,unknown>={})=>useQuery({queryKey:["festival-jobs",filters],queryFn:()=>getAvailableFestivalStaffVacancies(filters)});
export const useFestivalSupplierOpportunities=(filters:Record<string,unknown>={})=>useQuery({queryKey:["company-procurement",filters],queryFn:()=>getAvailableFestivalSupplierOpportunities(filters)});
const workflowHook=(action:string,related:"jobs"|"suppliers")=>()=>{const client=useQueryClient();return useMutation({mutationKey:["festival-operations-action",action],mutationFn:(input:{festivalCompanyId:string;payload:Record<string,unknown>;idempotencyKey:string})=>festivalOperationsAction(action,input.payload,input.idempotencyKey),onSuccess:(result:FestivalOperationsActionResult,input)=>{client.setQueryData(festivalOperationsQueryKey(input.festivalCompanyId),result.operations);void client.invalidateQueries({queryKey:related==="jobs"?["festival-jobs"]:["company-procurement"]});void client.invalidateQueries({queryKey:["notifications"]});void client.invalidateQueries({queryKey:["mail"]});void client.invalidateQueries({queryKey:["festival-edition-budget"]})}})};
export const useApplyForFestivalStaffVacancy=workflowHook("apply_for_festival_staff_vacancy","jobs");
export const useWithdrawFestivalStaffApplication=workflowHook("withdraw_festival_staff_application","jobs");
export const useReviewFestivalStaffApplication=workflowHook("review_festival_staff_application","jobs");
export const useHireFestivalStaffApplicant=workflowHook("hire_festival_staff_applicant","jobs");
export const useHireFestivalNpcStaff=workflowHook("hire_festival_npc_staff","jobs");
export const useAssignFestivalStaffShift=workflowHook("assign_festival_staff_shift","jobs");
export const useCancelFestivalStaffAssignment=workflowHook("cancel_festival_staff_assignment","jobs");
export const useSubmitFestivalSupplierQuote=workflowHook("submit_festival_supplier_quote","suppliers");
export const useWithdrawFestivalSupplierQuote=workflowHook("withdraw_festival_supplier_quote","suppliers");
export const useReviewFestivalSupplierQuote=workflowHook("review_festival_supplier_quote","suppliers");
export const useAcceptFestivalSupplierQuote=workflowHook("accept_festival_supplier_quote","suppliers");
export const useCancelFestivalSupplierContract=workflowHook("cancel_festival_supplier_contract","suppliers");
export const useRefreshFestivalNpcSupplierQuotes=workflowHook("refresh_festival_npc_supplier_quotes","suppliers");
