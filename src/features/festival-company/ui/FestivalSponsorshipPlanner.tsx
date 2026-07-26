import {useState} from "react";
import {Handshake,LockKeyhole} from "lucide-react";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import {PageLoadingState} from "@/components/ui/page-state";
import {formatSponsorshipMoney} from "../domain/festivalSponsorship";
import {useFestivalSponsorshipPlan} from "../application/useFestivalSponsorship";

const sections=["Overview","Inventory","Packages","Prospects","Applications","Invitations","Proposals","Contracts","Branding","Deliverables","Commercial summary","Readiness"] as const;
type Section=typeof sections[number];
const recordSections:Record<Exclude<Section,"Overview"|"Commercial summary"|"Readiness">,string>={Inventory:"inventory",Packages:"packages",Prospects:"prospects",Applications:"applications",Invitations:"invitations",Proposals:"proposals",Contracts:"contracts",Branding:"brandingPlacements",Deliverables:"deliverables"};
export function FestivalSponsorshipPlanner({festivalCompanyId}:{festivalCompanyId:string}){
 const q=useFestivalSponsorshipPlan(festivalCompanyId);const [section,setSection]=useState<Section>("Overview");
 if(q.isLoading)return <PageLoadingState title="Loading sponsorship" description="Loading the commercial plan."/>;
 if(q.isError||!q.data)return <Card><CardHeader><CardTitle>Sponsorship & commercial partnerships</CardTitle></CardHeader><CardContent><p role="alert">Sponsorship unlocks after operations reaches ready for sponsorship.</p></CardContent></Card>;
 const d=q.data,p=d.sponsorshipPlan,s=d.commercialSummary;if(!p)return <Card><CardHeader><CardTitle className="flex gap-2"><LockKeyhole aria-hidden/>Sponsorship locked</CardTitle></CardHeader><CardContent>Complete Phase 5 operations before configuring commercial inventory.</CardContent></Card>;
 const records=section in recordSections?d[recordSections[section as keyof typeof recordSections] as keyof typeof d] as unknown[]:[];
 return <section aria-labelledby="sponsorship-heading" className="space-y-4 overflow-hidden"><header><h2 id="sponsorship-heading" className="flex items-center gap-2 text-2xl font-semibold"><Handshake aria-hidden/>Sponsorship & partnerships</h2><p>Commercial commitments and planned receivables do not transfer funds or realise revenue.</p></header>
 <nav aria-label="Sponsorship workflow" className="flex flex-wrap gap-2">{sections.map(x=><Button key={x} type="button" variant={section===x?"default":"outline"} aria-current={section===x?"page":undefined} className="min-h-11" onClick={()=>setSection(x)}>{x}</Button>)}</nav>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Target",s.sponsorshipTargetMinor],["Contracted cash",s.contractedCashMinor],["Contracted in-kind",s.contractedInKindMinor],["Remaining",s.remainingTargetMinor]].map(([label,value])=><Card key={String(label)}><CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader><CardContent className="break-words text-xl font-semibold tabular-nums">{formatSponsorshipMoney(Number(value),p.currencyCode)}</CardContent></Card>)}</div>
 {section in recordSections&&<Card><CardHeader><CardTitle>{section}</CardTitle></CardHeader><CardContent><Badge variant="secondary">{records.length} items</Badge>{records.length===0?<p className="mt-3 text-sm text-muted-foreground">No {section.toLowerCase()} yet.</p>:<ol aria-label={`${section} ordered records`} className="mt-3 grid gap-3">{records.map((item,index)=><li key={String((item as Record<string,unknown>).id??index)} className="rounded-md border p-3"><strong>{String((item as Record<string,unknown>).name??(item as Record<string,unknown>).status??`${section} item ${index+1}`)}</strong><p className="text-sm">Status: {String((item as Record<string,unknown>).status??"planned")}</p></li>)}</ol>}<p className="mt-3 text-sm text-muted-foreground">Binding actions require the Festival commercial manager role and current record version.</p></CardContent></Card>}
 {section==="Commercial summary"&&<Card><CardHeader><CardTitle>Commercial summary</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2"><p>Cash target progress: {s.cashTargetProgressBasisPoints/100}%</p><p>Inventory utilisation: {s.inventoryUtilisationBasisPoints/100}%</p><p>Player-company share: {s.playerSponsorShareBasisPoints/100}%</p><p>Readiness score: {s.commercialReadinessScore}/100</p></CardContent></Card>}
 {section==="Readiness"&&<Card><CardHeader><CardTitle>Readiness review</CardTitle></CardHeader><CardContent><p>Status: {d.readiness?"Ready for final readiness":"Not ready"}</p><p>Applications, invitations and unaccepted proposals do not count as secured sponsorship.</p></CardContent></Card>}
 {(section==="Overview"||d.issues.length>0)&&d.issues.length>0&&<div role="alert" tabIndex={-1} className="rounded border border-destructive p-4"><h3 className="font-semibold">Commercial readiness issues</h3><ul>{d.issues.map((x,i)=><li key={`${x.code}-${i}`}>{x.blocking?"Blocking":"Warning"}: {x.code}</li>)}</ul></div>}</section>;
}
