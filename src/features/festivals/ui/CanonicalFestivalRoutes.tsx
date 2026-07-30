import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { FestivalScheduleWorkspace } from "@/features/festivals/scheduling/components/FestivalScheduleWorkspace";
import { FestivalCompanyEligibilityCard } from "@/features/festival-company/ui/FestivalCompanyEligibilityCard";
import { resolveOwnerFestivalIdentifier, resolvePublicFestivalIdentifier } from "../resolver";
import { festivalRoutes } from "../routes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFestivalCompanySetup } from "@/features/festival-company/data/festivalCompanyRepository";
import { FestivalUpgradeWorkspace } from "@/features/festival-company/upgrades/FestivalUpgradeWorkspace";
import { FestivalLiveControlRoom } from "@/features/festivals/runtime/FestivalLiveControlRoom";
import { EditionSettlementWorkspace } from "@/features/festivals/settlement/EditionSettlementWorkspace";
import { settlementRepository } from "@/features/festivals/settlement/repository";

export function FestivalFoundingPage() { return <main className="mx-auto max-w-3xl space-y-5 p-6"><h1 className="text-3xl font-bold">Found a Festival company</h1><p>Start an annual Festival brand. Eligibility, limits, authority, funds and price are verified by the server.</p><FestivalCompanyEligibilityCard /></main>; }

export function FestivalCompanyHome() {
  const { festivalCompanyId } = useParams();
  const query = useQuery({ queryKey: ["festival-company-home", festivalCompanyId], enabled: Boolean(festivalCompanyId), queryFn: () => getFestivalCompanySetup(festivalCompanyId!) });
  if (query.isLoading) return <main className="p-6" role="status">Loading Festival company…</main>;
  if (query.error || !query.data) return <RouteState title="Festival company unavailable" body="The company was not found or you do not have management permission." />;
  const f = query.data;
  return <main className="mx-auto max-w-6xl space-y-5 p-6"><h1 className="text-3xl font-bold">{f.publicName}</h1><div className="grid gap-4 md:grid-cols-3"><Summary title="Company" value={f.legalCompanyName}/><Summary title="Balance" value={new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(f.companyBalance)}/><Summary title="Setup" value={f.setupCompleted ? "Ready" : "Action required"}/></div><p>{f.configurationComplete ? "Configuration complete." : "Configuration blocks the next edition."}</p><div className="flex flex-wrap gap-3"><Link className="underline" to={festivalRoutes.genericCompany(f.companyId)}>Generic company ownership and finance</Link><Link className="underline" to={festivalRoutes.editions(f.festivalCompanyId)}>Annual editions</Link><Link className="underline" to={festivalRoutes.upgrades(f.festivalCompanyId)}>Upgrades and licences</Link></div></main>;
}
export function FestivalUpgradesPage(){const {festivalCompanyId}=useParams();return <FestivalUpgradeWorkspace festivalCompanyId={festivalCompanyId!}/>;}
const Summary=({title,value}:{title:string;value:string})=><Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent>{value}</CardContent></Card>;

export const editionNavigation = ["overview", "schedule", "applications", "contracts", "operations", "finance", "live", "settlement", "history"] as const;
export function FestivalEditionShell() {
  const { festivalCompanyId, editionId } = useParams();
  const query = useQuery({ queryKey: ["festival-owner-resolution", festivalCompanyId, editionId], enabled: Boolean(festivalCompanyId && editionId), queryFn: () => resolveOwnerFestivalIdentifier(festivalCompanyId!, editionId) });
  if (query.isLoading) return <main className="p-6" role="status">Resolving annual edition…</main>;
  if (query.error) return <RouteState title="Festival edition access denied" body="Your active character does not have authority to manage this edition." />;
  if (!query.data || query.data.status !== "resolved") return <ResolutionState status={query.data?.status ?? "not_found"}/>;
  return <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-6"><nav aria-label="Breadcrumb"><Link to={festivalRoutes.company(festivalCompanyId!)}>Festival company</Link> / <span>Annual edition {query.data.editionYear ?? ""}</span></nav><h1 className="text-3xl font-bold">Annual edition</h1><nav className="flex flex-wrap gap-3" aria-label="Edition navigation">{editionNavigation.map(item=><Link className="underline" key={item} to={item === "overview" ? festivalRoutes.edition(festivalCompanyId!, editionId!) : festivalRoutes[item](festivalCompanyId!, editionId!)}>{item}</Link>)}</nav><Outlet context={query.data}/></main>;
}
export function FestivalEditionWorkspace({section}:{section:string}) { const { festivalCompanyId, editionId }=useParams(); if(section==="schedule") return <FestivalScheduleWorkspace editionId={editionId!}/>; if(section==="live") return <FestivalLiveControlRoom companyId={festivalCompanyId!} editionId={editionId!}/>; if(section==="settlement") return <EditionSettlementWorkspace companyId={festivalCompanyId!} editionId={editionId!}/>; return <Card><CardHeader><CardTitle className="capitalize">{section}</CardTitle></CardHeader><CardContent>This canonical annual-edition workspace is server-authoritative.</CardContent></Card>; }

export function PublicFestivalEditionPage() {
  const { festivalCompanyIdentifier, editionIdentifier }=useParams();
  const q=useQuery({queryKey:["public-festival-resolution",festivalCompanyIdentifier,editionIdentifier],queryFn:()=>resolvePublicFestivalIdentifier(festivalCompanyIdentifier!,"festival_company",editionIdentifier)});
  if(q.isLoading)return <main className="p-6" role="status">Resolving Festival edition…</main>;
  if(!q.data||q.data.status!=="resolved")return <ResolutionState status={q.data?.status??"unavailable"}/>;
  return <PublicEditionHistory editionId={q.data.editionId!} slug={q.data.publicSlug!} year={q.data.editionYear}/>;
}
function PublicEditionHistory({editionId,slug,year}:{editionId:string;slug:string;year?:number}){const q=useQuery({queryKey:["public-festival-history",editionId],queryFn:()=>settlementRepository.history(editionId)});return <main className="mx-auto max-w-5xl space-y-5 p-6"><nav aria-label="Breadcrumb"><Link to={festivalRoutes.publicCompany(slug)}>Festival company</Link> / Annual edition</nav><h1 className="text-3xl font-bold">{q.data?.festivalName??"Festival"} {year}</h1>{q.isLoading?<p role="status">Loading immutable edition history…</p>:!q.data?<p>This edition has no completed public history yet.</p>:<div className="grid gap-4 sm:grid-cols-2"><Summary title="Dates" value={`${q.data.dates?.startsOn??"—"} – ${q.data.dates?.endsOn??"—"}`}/><Summary title="Attendance" value={(q.data.attendance??0).toLocaleString("en-GB")}/><Summary title="Audience rating" value={`${q.data.audienceScore??"—"}/100`}/><Summary title="Result" value={q.data.profitabilityBand.replaceAll("_"," ")}/><Summary title="Headliners" value={q.data.headliners.map(String).join(", ")||"—"}/><Summary title="Reputation" value={`${q.data.reputationChange>=0?"+":""}${q.data.reputationChange}`}/></div>}<p className="text-sm text-muted-foreground">This public snapshot is frozen at settlement completion. Private contracts, medical information and exact financial totals are not published.</p></main>}
export function LegacyFestivalRedirect({target}:{target:"overview"|"schedule"|"operations"}) { const {festivalId,editionId}=useParams(); const {search}=useLocation(); const q=useQuery({queryKey:["legacy-festival-redirect",festivalId,editionId],queryFn:()=>resolveOwnerFestivalIdentifier(festivalId!,editionId)}); if(q.isLoading)return <main className="p-6">Resolving historical Festival route…</main>; if(!q.data||q.data.status!=="resolved"||!q.data.festivalCompanyId||!q.data.editionId)return <ResolutionState status={q.data?.status??"not_found"}/>; const destination=target==="overview"?festivalRoutes.edition(q.data.festivalCompanyId,q.data.editionId):festivalRoutes[target](q.data.festivalCompanyId,q.data.editionId); return <Navigate replace to={`${destination}${search}`}/>; }
export const RouteState=({title,body}:{title:string;body:string})=><main className="mx-auto max-w-2xl p-8"><h1 className="text-3xl font-bold">{title}</h1><p className="mt-3">{body}</p></main>;
export function ResolutionState({status}:{status:string}) { if(status==="legacy_only")return <RouteState title="Historical Festival record" body="This read-only legacy record has no canonical company mapping. Applications, purchases and management actions are unavailable."/>; if(status==="ambiguous")return <RouteState title="Festival mapping needs repair" body="More than one mapping exists, so the application will not guess a destination."/>; if(status==="unavailable")return <RouteState title="Festival service unavailable" body="Festival resolution is temporarily unavailable."/>; return <RouteState title="Festival not found" body="No Festival matches this identifier."/>; }
export function LegacyFestivalSetupRedirect() { const {festivalCompanyId}=useParams(); const {search}=useLocation(); return <Navigate replace to={`${festivalRoutes.company(festivalCompanyId!)}${search}`}/>; }
