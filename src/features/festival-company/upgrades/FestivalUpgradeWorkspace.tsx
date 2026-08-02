import {useState} from "react";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {Link} from "react-router-dom";
import {ChevronDown,Construction} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {festivalRoutes} from "@/features/festivals/routes";
import {getFestivalCompanyUpgrades,previewFestivalUpgrade,purchaseFestivalUpgrade} from "./repository";
import {FESTIVAL_UPGRADE_MESSAGES,type FestivalLicenceProgress,type FestivalUpgradeCategory} from "./types";

const money=(minor:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(minor/100);
const dateTime=(value:string)=>new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
const effectLabel=(key:string)=>key.replace(/([A-Z])/g," $1").replace(/^./,x=>x.toUpperCase());

export function FestivalUpgradeWorkspace({festivalCompanyId}:{festivalCompanyId:string}) {
 const qc=useQueryClient(),[selectedKey,setSelectedKey]=useState<string|null>(null);
 const q=useQuery({queryKey:["festival-company-upgrades",festivalCompanyId],queryFn:()=>getFestivalCompanyUpgrades(festivalCompanyId),enabled:Boolean(festivalCompanyId)});
 const selected=q.data?.categories.find(c=>c.key===selectedKey)??null;
 const preview=useQuery({queryKey:["festival-upgrade-preview",festivalCompanyId,selected?.key],queryFn:()=>previewFestivalUpgrade({festivalCompanyId,categoryKey:selected!.key}),enabled:Boolean(selected?.nextLevel)});
 const buy=useMutation({mutationFn:async()=>{const p=preview.data!;return purchaseFestivalUpgrade({festivalCompanyId,categoryKey:p.category.key,nextLevel:p.category.nextLevel!,catalogueVersion:p.catalogueVersion,companyVersion:p.companyVersion,idempotencyKey:crypto.randomUUID()})},onSuccess:async()=>{setSelectedKey(null);await qc.invalidateQueries({queryKey:["festival-company-upgrades",festivalCompanyId]})}});
 if(q.isLoading)return <main className="p-6" role="status">Loading authoritative upgrade catalogue…</main>;
 if(q.error||!q.data)return <main className="p-6"><h1 className="text-2xl font-bold">Upgrades unavailable</h1><p role="alert">{q.error instanceof Error?q.error.message:"The server did not return the catalogue."}</p></main>;
 const window=q.data.purchaseWindow;
 return <main className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
  <Link className="underline" to={festivalRoutes.company(festivalCompanyId)}>← Festival company</Link>
  <div><h1 className="text-3xl font-bold">Upgrades and licences</h1><p>Catalogue v{q.data.catalogueVersion}. Available company funds: {money(q.data.availableBalanceMinor)}.</p></div>
  <Card><CardHeader><CardTitle>Rolling purchase window</CardTitle></CardHeader><CardContent><p>{window.used} of {window.limit} purchases used in the last {window.windowDays} days. {window.remaining} remaining.</p>{window.nextAvailableAt&&<p className="font-medium">Next purchase available {dateTime(window.nextAvailableAt)}.</p>}</CardContent></Card>
  <Licence data={q.data.licence}/>
  <div className="grid gap-2 md:grid-cols-2">{q.data.categories.map(c=><UpgradeCard key={c.key} category={c} selected={selected?.key===c.key} quotaAvailable={window.remaining>0} onToggle={()=>setSelectedKey(selected?.key===c.key?null:c.key)} preview={selected?.key===c.key?preview:null} buy={buy}/>)}</div>
  {buy.error&&<p role="alert">{buy.error.message}</p>}
 </main>;
}

function UpgradeCard({category:c,selected,quotaAvailable,onToggle,preview,buy}:{category:FestivalUpgradeCategory;selected:boolean;quotaAvailable:boolean;onToggle:()=>void;preview:ReturnType<typeof useQuery>|null;buy:ReturnType<typeof useMutation>}) {
 const complete=c.nextLevel===null;
 const bandProgress=Math.max(0,c.ownedLevel-c.bandStartLevel+1);
 return <Card><button className="flex w-full items-center justify-between gap-3 p-4 text-left" aria-expanded={selected} onClick={onToggle}><span><strong>{c.displayName}</strong><span className="block text-sm text-muted-foreground">{c.ownedLevel===0?"Not installed":c.status==="building"?"Under construction":c.delinquent?"Delinquent":complete?"Maximum level":c.bandName} · effective level {c.effectiveLevel}</span></span><span className="flex items-center gap-2">{c.status==="building"&&<Construction aria-label="Under construction"/>}<span aria-label={`${c.ownedLevel} of ${c.maximumLevel} levels`} role="progressbar" aria-valuemin={0} aria-valuemax={c.maximumLevel} aria-valuenow={c.ownedLevel}>Level {c.ownedLevel} of {c.maximumLevel}</span><ChevronDown/></span></button>
 {selected&&<CardContent className="space-y-3 border-t pt-4"><p>{c.description}</p><p><strong>{c.bandName}</strong> · levels {c.bandStartLevel}–{c.bandEndLevel}</p><div><label className="text-sm">Current band progress</label><progress className="block w-full" max={c.bandEndLevel-c.bandStartLevel+1} value={bandProgress}/></div><div><label className="text-sm">Overall progress</label><progress className="block w-full" max={c.maximumLevel} value={c.ownedLevel}/></div><p>Current upkeep: {money(c.currentUpkeepMinor)} per week.</p>
 {c.delinquent&&<p className="font-medium text-destructive">Upkeep is delinquent; effective benefits are reduced by one progression band.</p>}
 {complete?<p className="font-medium">Maximum level reached. No further purchase is available.</p>:<><p>Next milestone: {c.nextMilestoneName} at level {c.nextMilestoneLevel} ({c.levelsUntilMilestone} levels away).</p><p>Next level: {c.nextLevel} · {money(c.nextCostMinor!)} · upkeep {money(c.nextUpkeepMinor!)} weekly · construction {c.buildDurationHours} hours.</p>{c.effectDelta&&<ul aria-label="Effect changes">{Object.entries(c.effectDelta).map(([key,value])=><li key={key}>{effectLabel(key)}: {String(value.current)} → {String(value.next)} ({value.kind==="number"?`${value.delta>=0?"+":""}${value.delta}`:value.changed?"changes":"unchanged"})</li>)}</ul>}{preview?.isLoading?<p role="status">Loading server quote…</p>:preview?.data&&<><ul aria-label="Purchase blockers">{preview.data.reasonCodes.map(code=><li key={code} className="text-destructive">{FESTIVAL_UPGRADE_MESSAGES[code]??code}</li>)}{preview.data.category.missingRequirements.map(x=><li key={x.code} className="text-destructive">{x.message}</li>)}</ul><p>Balance after purchase: {money(preview.data.remainingBalanceMinor)}. Purchases are final.</p><Button disabled={!preview.data.eligible||!quotaAvailable||buy.isPending} onClick={()=>buy.mutate()}>{buy.isPending?"Purchasing…":"Purchase next level"}</Button></>}</>}</CardContent>}</Card>;
}

function Licence({data}:{data:FestivalLicenceProgress}) {return <Card><CardHeader><CardTitle>Licence progression</CardTitle></CardHeader><CardContent><p>Current: {data.current?.name??"None"} · Highest eligible: {data.highestEligible?.name??"None"}</p>{data.next&&<p>Next: {data.next.name} ({money(data.next.feeMinor)} application fee)</p>}<ul className="mt-2 grid gap-1 md:grid-cols-2">{data.requirements.map(r=><li key={r.code}>{r.complete?"✓":"○"} {r.description}</li>)}</ul></CardContent></Card>}
