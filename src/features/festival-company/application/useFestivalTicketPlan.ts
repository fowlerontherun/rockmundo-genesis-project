import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {getFestivalTicketPlan,saveFestivalTicketPlan} from "../data/festivalCompanyRepository";
import type {FestivalTicketPlanDraft} from "../domain/festivalTicketPlan";
export const festivalTicketPlanQueryKey=(id?:string)=>["festival-ticket-plan",id] as const;
export const useFestivalTicketPlan=(id?:string,enabled=true)=>useQuery({queryKey:festivalTicketPlanQueryKey(id),enabled:enabled&&Boolean(id),retry:false,queryFn:()=>getFestivalTicketPlan(id!)});
export const useSaveFestivalTicketPlan=()=>{const client=useQueryClient();return useMutation({mutationFn:(input:{festivalCompanyId:string;expectedVersion:number;draft:FestivalTicketPlanDraft;idempotencyKey:string;complete?:boolean})=>saveFestivalTicketPlan(input),onSuccess:data=>{client.setQueryData(festivalTicketPlanQueryKey(data.festivalCompanyId),data);void Promise.all([["festival-company-setup"],["owned-festival-companies"],["festival-site-plan",data.festivalCompanyId]].map(queryKey=>client.invalidateQueries({queryKey})));}})};
