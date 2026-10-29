import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { festivalRuntimeRepository,type FestivalRuntimeAction } from "../data/festivalRuntimeRepository";
import { parseFestivalPublicLiveStatus } from "../domain/festivalRuntime";
const key=(id:string)=>["festival-runtime",id] as const;
export const useFestivalRuntime=(id:string)=>useQuery({queryKey:key(id),queryFn:()=>festivalRuntimeRepository.get(id),enabled:Boolean(id)});
export const useFestivalRuntimeOwnerDashboard=(id:string)=>useQuery({queryKey:[...key(id),"owner"],queryFn:()=>festivalRuntimeRepository.ownerDashboard(id),enabled:Boolean(id)});
export const useFestivalRuntimeStageDashboard=(id:string)=>useQuery({queryKey:["festival-runtime-stage",id],queryFn:()=>festivalRuntimeRepository.stageDashboard(id),enabled:Boolean(id)});
export const useMyFestivalArtistRuntime=()=>useQuery({queryKey:["festival-runtime","artist","me"],queryFn:festivalRuntimeRepository.myArtist});
export const useMyFestivalStaffRuntime=()=>useQuery({queryKey:["festival-runtime","staff","me"],queryFn:festivalRuntimeRepository.myStaff});
export const useMyFestivalSupplierRuntime=()=>useQuery({queryKey:["festival-runtime","supplier","me"],queryFn:festivalRuntimeRepository.mySupplier});
const isUnavailablePublicRuntime = (error: Error | null) =>
  error?.message === "festival_public_runtime_not_deployed";
export const publicRuntimePolling = {
  retry: (attempt: number, error: Error) => !isUnavailablePublicRuntime(error) && attempt < 2,
  refetchInterval: (query: { state: { error: Error | null } }) =>
    isUnavailablePublicRuntime(query.state.error) ? false : 15_000,
  refetchOnWindowFocus: (query: { state: { error: Error | null } }) =>
    !isUnavailablePublicRuntime(query.state.error),
};
// Both visitor views consume one public-safe canonical projection and one
// React Query cache entry: no duplicate 15-second polling of the same RPC.
const publicCanonicalOptions = (slug: string) => ({
  queryKey: ["festival-public-canonical-edition", slug] as const,
  queryFn: () => festivalRuntimeRepository.publicExperience(slug),
  enabled: Boolean(slug),
  ...publicRuntimePolling,
});
// A public launch can exist before its canonical edition runtime has been created.
export const parseOptionalFestivalPublicLiveStatus = (value: unknown) =>
  value == null ? null : parseFestivalPublicLiveStatus(value);
export const usePublicFestivalLiveStatus=(slug:string)=>useQuery({
  ...publicCanonicalOptions(slug),
  select: parseOptionalFestivalPublicLiveStatus,
});
export const useFestivalRuntimeEventLog=(id:string)=>useQuery({queryKey:[...key(id),"events"],queryFn:()=>festivalRuntimeRepository.eventLog(id),enabled:Boolean(id)});
export const useFestivalCrowdRuntime=(id:string)=>useQuery({queryKey:[...key(id),"crowds"],queryFn:()=>festivalRuntimeRepository.crowds(id),enabled:Boolean(id),refetchInterval:15_000});
export const useFestivalIncidentDashboard=(id:string)=>useQuery({queryKey:[...key(id),"incidents"],queryFn:()=>festivalRuntimeRepository.incidents(id),enabled:Boolean(id),refetchInterval:10_000});
export const useFestivalVendorSales=(id:string)=>useQuery({queryKey:[...key(id),"vendor-sales"],queryFn:()=>festivalRuntimeRepository.vendorSales(id),enabled:Boolean(id),refetchInterval:15_000});
export const useFestivalSponsorActivations=(id:string)=>useQuery({queryKey:[...key(id),"sponsors"],queryFn:()=>festivalRuntimeRepository.sponsorActivations(id),enabled:Boolean(id),refetchInterval:15_000});
export const useFestivalOperationalOutcomes=(id:string)=>useQuery({queryKey:[...key(id),"outcomes"],queryFn:()=>festivalRuntimeRepository.operationalOutcomes(id),enabled:Boolean(id)});
export const useFestivalPerformanceSimulationJobs=(id:string)=>useQuery({queryKey:[...key(id),"simulation-jobs"],queryFn:()=>festivalRuntimeRepository.simulationJobs(id),enabled:Boolean(id),refetchInterval:5_000});
export const usePublicFestivalLiveExperience=(slug:string)=>useQuery(publicCanonicalOptions(slug));
export const usePrepareFestivalRuntime=()=>{const q=useQueryClient();return useMutation({mutationFn:(x:{launchId:string;version:number;idempotencyKey:string})=>festivalRuntimeRepository.prepare(x.launchId,x.version,x.idempotencyKey),onSuccess:r=>q.invalidateQueries({queryKey:key(r.id)})})};
export const useFestivalRuntimeAction=()=>{const q=useQueryClient();return useMutation({mutationFn:(x:{name:FestivalRuntimeAction;args:Record<string,unknown>;runtimeId?:string})=>festivalRuntimeRepository.action(x.name,x.args),onSuccess:(_,x)=>x.runtimeId&&q.invalidateQueries({queryKey:key(x.runtimeId)})})};
