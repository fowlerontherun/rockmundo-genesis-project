import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Award, BarChart3, History, Radio, Trophy } from "lucide-react";
import { festivalLegacyService } from "@/features/festivals/legacy/service";
import type { FestivalAward, FestivalLegacyFilter, FestivalRecord, FestivalResult, FestivalResultDetail, FestivalStatistics } from "@/features/festivals/legacy/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const links = [["Results", "/festivals/results"], ["History", "/festivals/history"], ["Awards", "/festivals/awards"], ["Hall of Fame", "/festivals/hall-of-fame"], ["World records", "/festivals/records"], ["Statistics", "/festivals/statistics"]];
const money = (minor: number, currency: string) => new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(minor / 100);
const title: Record<string,string> = {results:"Published results",history:"Historical archive",awards:"Festival awards","hall-of-fame":"Hall of Fame",records:"World records",statistics:"Festival statistics"};

export default function FestivalLegacyPage() {
  const { pathname } = useLocation();
  const { resultId } = useParams();
  const section = pathname.split("/")[2] ?? "results";
  const [filter, setFilter] = useState<FestivalLegacyFilter>({limit:24,offset:0});
  const [items, setItems] = useState<Array<FestivalResult | FestivalAward | FestivalRecord>>([]);
  const [detail, setDetail] = useState<FestivalResultDetail | null>(null);
  const [statistics, setStatistics] = useState<FestivalStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true; setLoading(true); setError(""); setDetail(null); setStatistics(null);
    const request: Promise<unknown> = resultId ? festivalLegacyService.detail(resultId).then(value => { if(live)setDetail(value); })
      : section === "awards" ? festivalLegacyService.awards(filter.year).then(value=>{if(live)setItems(value)})
      : section === "records" ? festivalLegacyService.records().then(value=>{if(live)setItems(value)})
      : section === "hall-of-fame" ? festivalLegacyService.hallOfFame().then(value=>{if(live)setItems(value as FestivalResult[])})
      : section === "statistics" ? festivalLegacyService.statistics(filter).then(value=>{if(live)setStatistics(value)})
      : festivalLegacyService[section === "history" ? "history" : "results"](filter).then(value=>{if(live)setItems(value.items)});
    request.catch(()=>{if(live)setError("Festival legacy data is temporarily unavailable.")}).finally(()=>{if(live)setLoading(false)});
    return ()=>{live=false};
  }, [filter, resultId, section]);

  const filters = !resultId && !["awards","records","hall-of-fame"].includes(section);
  return <main className="container mx-auto space-y-6 px-4 py-6 md:py-8" aria-labelledby="legacy-title">
    <header className="rounded-xl bg-gradient-to-r from-purple-950 to-slate-950 p-6 text-white md:p-8">
      <div className="flex items-center gap-3"><Trophy aria-hidden/><h1 id="legacy-title" className="text-2xl font-bold md:text-3xl">{resultId ? detail?.festivalName ?? "Festival result" : title[section]}</h1></div>
      <p className="mt-2 text-slate-300">Verified, immutable Festival history built from final runtime and settlement evidence.</p>
    </header>
    <nav className="flex flex-wrap gap-2" aria-label="Festival legacy sections">{links.map(([label, href]) => <Button key={href} asChild size="sm" variant={pathname === href ? "default" : "outline"}><Link to={href}>{label}</Link></Button>)}</nav>
    {filters && <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Archive filters">
      <Input aria-label="Year" type="number" placeholder="Year" onChange={(e) => setFilter(v=>({...v,year:e.target.value?Number(e.target.value):undefined,offset:0}))}/>
      {(["country","city","festivalType","genre"] as const).map(key=><Input key={key} aria-label={key} placeholder={key==="festivalType"?"Festival type":key[0].toUpperCase()+key.slice(1)} onChange={e=>setFilter(v=>({...v,[key]:e.target.value||undefined,offset:0}))}/>)}</section>}
    {loading && <p role="status" aria-live="polite">Loading {title[section]?.toLowerCase()}…</p>}
    {error && <Card role="alert"><CardContent className="space-y-3 py-8"><p>{error}</p><Button onClick={()=>setFilter(v=>({...v}))}>Try again</Button></CardContent></Card>}
    {!loading && !error && resultId && !detail && <Empty/>}
    {!loading && detail && <Detail value={detail}/>}
    {!loading && !error && statistics && <Statistics value={statistics}/>}
    {!loading && !error && !resultId && !statistics && items.length===0 && <Empty/>}
    {!loading && !resultId && !statistics && <section aria-label={title[section]} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(item=><LegacyCard key={item.id} item={item} section={section}/>)}</section>}
    {filters && items.length>0 && <nav className="flex justify-center gap-3" aria-label="Results pages"><Button variant="outline" disabled={!filter.offset} onClick={()=>setFilter(v=>({...v,offset:Math.max(0,(v.offset??0)-(v.limit??24))}))}>Previous</Button><Button variant="outline" disabled={items.length<(filter.limit??24)} onClick={()=>setFilter(v=>({...v,offset:(v.offset??0)+(v.limit??24)}))}>Next</Button></nav>}
  </main>;
}

function Empty(){return <Card><CardContent className="py-12 text-center text-muted-foreground">No published Festival legacy matches this view.</CardContent></Card>}
function LegacyCard({item,section}:{item:FestivalResult|FestivalAward|FestivalRecord;section:string}){
  const r=item as FestivalResult,a=item as FestivalAward,w=item as FestivalRecord;
  return <Card><CardHeader><CardTitle className="flex items-center gap-2">{section==="awards"?<Award aria-hidden/>:section==="records"?<Radio aria-hidden/>:<History aria-hidden/>}{r.festivalName??a.winnerName??w.holderName}</CardTitle></CardHeader><CardContent className="space-y-2">
    {r.editionYear&&<><p>{r.city}, {r.country} · {r.editionYear}</p><p className="text-2xl font-semibold">{r.overallRating}/100</p><p>{r.attendance.toLocaleString("en-GB")} attended · {r.sellOutPercentage.toFixed(1)}% capacity</p><p>{money(r.profitLossMinor,r.currencyCode)} profit/loss</p><Button asChild variant="outline"><Link to={`/festivals/results/${r.id}`}>View full result</Link></Button></>}
    {a.category&&<><Badge>{a.category.replaceAll("_"," ")}</Badge><p>{a.citation}</p><p>Score {a.score.toFixed(1)}</p></>}
    {w.category&&<><Badge>{w.category.replaceAll("_"," ")}</Badge><p className="text-2xl font-semibold">{w.value.toLocaleString("en-GB")} {w.unit}</p><p>Set in {w.achievedYear}</p></>}
  </CardContent></Card>;
}
function Detail({value:r}:{value:FestivalResultDetail}){return <article className="space-y-4"><Button asChild variant="outline"><Link to="/festivals/results">Back to results</Link></Button><div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Edition outcome</CardTitle></CardHeader><CardContent className="space-y-2"><p>{r.city}, {r.country} · {r.editionYear}</p><p>{r.attendance.toLocaleString("en-GB")} total · {r.peakAttendance.toLocaleString("en-GB")} peak · {r.siteCapacity.toLocaleString("en-GB")} capacity</p><p>{money(r.revenueMinor,r.currencyCode)} revenue</p><p>{money(r.profitLossMinor,r.currencyCode)} profit/loss</p></CardContent></Card><Card><CardHeader><CardTitle>Review evidence</CardTitle></CardHeader><CardContent><dl className="grid grid-cols-2 gap-2">{Object.entries(r.review).filter(([,v])=>typeof v==="number").map(([k,v])=><div key={k}><dt className="capitalize text-muted-foreground">{k.replaceAll("_"," ")}</dt><dd className="font-semibold">{String(v)}/100</dd></div>)}</dl></CardContent></Card></div><Card><CardHeader><CardTitle>Archive detail</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><p>{r.performanceCount} performances · largest crowd {r.largestPerformanceCrowd.toLocaleString("en-GB")}</p><p>Incidents: {Object.entries(r.incidentSummary).map(([k,v])=>`${k} ${v}`).join(", ")||"none"}</p><p>{r.awards.length} awards · {r.recordsHeld.length} records held</p><p>{r.publicationStories.length} public stories</p></CardContent></Card></article>}
function Statistics({value:s}:{value:FestivalStatistics}){return <section aria-label="Festival statistics" className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Editions",s.editions],["Attendance",s.attendance.toLocaleString("en-GB")],["Average rating",`${s.averageRating}/100`],["Sell-outs",s.sellOuts]].map(([k,v])=><Card key={k}><CardContent className="py-6"><BarChart3 aria-hidden/><p className="text-sm text-muted-foreground">{k}</p><p className="text-2xl font-bold">{v}</p></CardContent></Card>)}</div><div className="overflow-x-auto"><table className="w-full min-w-[36rem] text-left"><caption className="sr-only">Statistics grouped by Festival</caption><thead><tr><th scope="col">Festival</th><th scope="col">Editions</th><th scope="col">Attendance</th><th scope="col">Rating</th></tr></thead><tbody>{s.groups.map(g=><tr key={g.label} className="border-t"><th scope="row" className="py-2">{g.label}</th><td>{g.editions}</td><td>{g.attendance.toLocaleString("en-GB")}</td><td>{g.averageRating}</td></tr>)}</tbody></table></div></section>}
