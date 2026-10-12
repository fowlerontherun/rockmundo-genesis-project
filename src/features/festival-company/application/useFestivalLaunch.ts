import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {useRef} from "react";
import * as repository from "../data/festivalCompanyRepository";
import {useActiveProfile} from "@/hooks/useActiveProfile";
export const festivalLaunchKey=(id?:string)=>["festival-launch",id] as const;
export const publicFestivalKey=(slug?:string)=>["public-festival",slug] as const;
export const festivalDirectoryKey=(filters:Record<string,unknown>={})=>["festival-directory",filters] as const;
export const festivalTicketWalletKey=["festival-ticket-wallet"] as const;
export const useFestivalLaunchPlan=(id?:string)=>useQuery({queryKey:festivalLaunchKey(id),enabled:Boolean(id),queryFn:()=>repository.getFestivalLaunchPlan(id!)});
export const usePublicFestival=(slug?:string)=>useQuery({queryKey:publicFestivalKey(slug),enabled:Boolean(slug),queryFn:()=>repository.getPublicFestival(slug!),refetchInterval:60_000});
export const usePublicFestivalDirectory=(filters:Record<string,unknown>={})=>useQuery({queryKey:festivalDirectoryKey(filters),queryFn:()=>repository.getPublicFestivalDirectory(filters),refetchInterval:60_000});
export const usePublicFestivalTimetable=(slug?:string)=>useQuery({queryKey:["public-festival-timetable",slug],enabled:Boolean(slug),queryFn:()=>repository.getPublicFestivalTimetable(slug!)});
export const usePublicFestivalTicketProducts=(launchId?:string)=>useQuery({queryKey:["public-festival-tickets",launchId],enabled:Boolean(launchId),queryFn:()=>repository.getPublicFestivalTicketProducts(launchId!)});
export const useMyFestivalTickets=(enabled=true)=>{const {profileId}=useActiveProfile();return useQuery({queryKey:[...festivalTicketWalletKey,profileId],queryFn:repository.getMyFestivalTickets,enabled:enabled&&Boolean(profileId)});};
export const useFestivalPlayerTicketSalesBreakdown=(id?:string)=>useQuery({queryKey:["festival-player-sales-breakdown",id],enabled:Boolean(id),queryFn:()=>repository.getFestivalPlayerTicketSalesBreakdown(id!),refetchInterval:60_000});
export const useFestivalSalesSummary=(id?:string)=>useQuery({queryKey:["festival-sales-summary",id],enabled:Boolean(id),queryFn:()=>repository.getFestivalTicketSalesSummary(id!),refetchInterval:60_000});
const useLaunchMutation=<T,>(fn:(i:T)=>Promise<unknown>)=>{const c=useQueryClient();return useMutation({mutationFn:fn,onSuccess:(_,i)=>{const id=(i as {festivalCompanyId?:string}).festivalCompanyId;void Promise.all([c.invalidateQueries({queryKey:["festival-launch"]}),c.invalidateQueries({queryKey:["festival-sales-summary",id]}),c.invalidateQueries({queryKey:["festival-player-sales-breakdown",id]}),c.invalidateQueries({queryKey:["festival-directory"]}),c.invalidateQueries({queryKey:["public-festival"]}),c.invalidateQueries({queryKey:["public-festival-tickets"]}),c.invalidateQueries({queryKey:["notifications"]}),c.invalidateQueries({queryKey:["mail"]})])}})};
export const useSaveFestivalPublicProfile=()=>useLaunchMutation(repository.saveFestivalPublicProfile);export const useBeginFestivalLaunchReview=()=>useLaunchMutation(repository.beginFestivalLaunchReview);export const useLaunchFestival=()=>useLaunchMutation(repository.launchFestival);export const useOpenFestivalTicketSales=()=>useLaunchMutation(repository.openFestivalTicketSales);export const usePauseFestivalTicketSales=()=>useLaunchMutation(repository.pauseFestivalTicketSales);export const useResumeFestivalTicketSales=()=>useLaunchMutation(repository.resumeFestivalTicketSales);export const useCloseFestivalTicketSales=()=>useLaunchMutation(repository.closeFestivalTicketSales);export const useIssueFestivalComplimentaryTickets=()=>useLaunchMutation(repository.issueFestivalComplimentaryTickets);export const useCancelLaunchedFestival=()=>useLaunchMutation(repository.cancelLaunchedFestival);
export const usePurchaseFestivalTickets = () => {
  const queryClient = useQueryClient();
  const requestKeys = useRef(new Map<string, string>());
  type TicketPurchaseInput = Parameters<typeof repository.purchaseFestivalTickets>[0];
  const signature = (input: TicketPurchaseInput) =>
    `${input.festivalLaunchId}:${input.ticketProductId}:${input.quantity}`;
  return useMutation({
    mutationFn: (input: TicketPurchaseInput) => {
      const key = signature(input);
      if (!requestKeys.current.has(key)) requestKeys.current.set(key, input.idempotencyKey);
      return repository.purchaseFestivalTickets({ ...input, idempotencyKey: requestKeys.current.get(key)! });
    },
    onSuccess: (_, input) => {
      requestKeys.current.delete(signature(input));
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["public-festival-tickets", input.festivalLaunchId] }),
        queryClient.invalidateQueries({ queryKey: ["public-festival"] }),
        queryClient.invalidateQueries({ queryKey: ["festival-directory"] }),
        queryClient.invalidateQueries({ queryKey: ["festival-sales-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["festival-player-sales-breakdown"] }),
        queryClient.invalidateQueries({ queryKey: festivalTicketWalletKey }),
        queryClient.invalidateQueries({ queryKey: ["festival-player-attendance"] }),
        queryClient.invalidateQueries({ queryKey: ["festival-check-in-eligibility"] }),
        queryClient.invalidateQueries({ queryKey: ["festival-memorabilia"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
    },
  });
};
