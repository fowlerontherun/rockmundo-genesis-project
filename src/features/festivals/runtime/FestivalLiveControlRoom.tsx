import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CloudRain, Radio, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getEditionRuntime } from "./service";

const money = (minor: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(minor / 100);
export function FestivalLiveControlRoom({ companyId, editionId }: { companyId: string; editionId: string }) {
  const query = useQuery({ queryKey: ["festival-edition-runtime", companyId, editionId], queryFn: () => getEditionRuntime(companyId, editionId), refetchInterval: 10_000 });
  if (query.isLoading) return <section role="status">Loading live control room…</section>;
  if (query.error) return <section role="alert"><h2>Live control room unavailable</h2><p>The secured runtime projection could not be loaded.</p></section>;
  const r = query.data;
  if (!r) return <section className="rounded-lg border p-6"><h2 className="text-2xl font-semibold">Prepare live runtime</h2><p className="text-muted-foreground">No canonical runtime exists. Preparation freezes the published schedule, contracts, upgrades, licence, capacity and operational plans.</p></section>;
  const occupancy = r.attendance.capacity ? Math.round(r.attendance.onsite / r.attendance.capacity * 100) : 0;
  return <section className="space-y-4" aria-label="Festival live control room">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="flex items-center gap-2 text-sm uppercase tracking-wide"><Radio className="h-4 w-4"/>Authoritative live runtime</p><h2 className="text-2xl font-bold capitalize">{r.state.replaceAll("_", " ")}</h2></div><time>{new Date(r.simulatedTime).toLocaleString()}</time></header>
    {r.weather.warning && <div role="alert" className="flex gap-2 rounded-md border border-amber-500 bg-amber-50 p-3 text-amber-950"><CloudRain/> {r.weather.warning}</div>}
    {r.blockers.map(b => <div role="alert" key={b.code} className="flex gap-2 rounded-md border border-destructive p-3"><AlertTriangle/> <strong>{b.code}</strong>: {b.message}</div>)}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric title="Gates" value={r.gates.status} detail={`${r.gates.queueSize} queued · ${r.gates.waitMinutes} min`}/><Metric title="Attendance" value={`${r.attendance.onsite.toLocaleString()} / ${r.attendance.capacity.toLocaleString()}`} detail={`${occupancy}% site occupancy`}/><Metric title="Food & drink" value={money(r.sales.foodAndDrinkMinor)} detail="unposted evidence"/><Metric title="Merchandise" value={money(r.sales.merchandiseMinor)} detail="unposted evidence"/></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Site capacity</CardTitle></CardHeader><CardContent><Progress value={Math.min(100, occupancy)}/><p className="mt-2 text-sm">{r.attendance.admitted} admitted · {r.attendance.departed} departed · {r.gates.queueSize} at entrances</p></CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Stages and artists</CardTitle></CardHeader><CardContent className="space-y-3">{r.stages.map(s=><article key={s.id} className="rounded border p-3"><div className="flex justify-between"><strong>{s.name}</strong><span className="capitalize">{s.status}</span></div><p>{s.currentArtist ?? "No current performance"}</p><p className="text-sm text-muted-foreground">Next: {s.nextArtist ?? "—"} · Artist {s.artistReady ? "ready" : "not ready"}{s.delayMinutes ? ` · ${s.delayMinutes} min delay` : ""}</p></article>)}</CardContent></Card><Card><CardHeader><CardTitle>Incidents</CardTitle></CardHeader><CardContent>{r.incidents.length ? r.incidents.map(i=><article key={i.id} className="mb-3 rounded border p-3"><strong className="capitalize">{i.severity} {i.category}</strong><p>{i.summary}</p><small>{i.location} · {i.status}</small></article>) : <p>No active incidents.</p>}</CardContent></Card></div>
    <div className="grid gap-3 sm:grid-cols-3"><Readiness title="Staff" {...r.readiness.staff}/><Readiness title="Suppliers" {...r.readiness.suppliers}/><Readiness title="Sponsors" {...r.readiness.sponsors}/></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5"/>Satisfaction and operations</CardTitle></CardHeader><CardContent><p>Audience {r.satisfaction.audience}% · Artists {r.satisfaction.artist}%</p><p className="mt-2 text-sm">Role: {r.permissions.role}. Authorised actions: {r.permissions.actions.join(", ") || "view only"}.</p>{r.recentEvents.slice(0, 8).map(e=><p className="text-sm" key={e.id}>{new Date(e.occurredAt).toLocaleTimeString()} — {e.message}</p>)}</CardContent></Card>
  </section>;
}
const Metric=({title,value,detail}:{title:string;value:string;detail:string})=><Card><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent><p className="text-xl font-semibold capitalize">{value}</p><p className="text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
const Readiness=({title,ready=0,total=0}:{title:string;ready?:number;total?:number})=><Metric title={title} value={`${ready}/${total}`} detail={ready===total ? "Ready" : "Attention required"}/>;
