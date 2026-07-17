import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarDays, ExternalLink, HeartPulse } from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminFestivalCatalogue } from "../hooks";
import { formatFestivalMoney } from "../mappers";

export function AdminFestivalCatalogue() {
  const { data, isLoading, error } = useAdminFestivalCatalogue();
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => (data ?? []).filter((row) => [row.brandName, row.cityName, row.lifecycleState].join(" ").toLowerCase().includes(filter.toLowerCase())), [data, filter]);

  if (isLoading) return <Card><CardContent className="p-6">Loading festivals…</CardContent></Card>;
  if (error) return <Card><CardContent className="p-6 text-destructive">Festivals could not be loaded.</CardContent></Card>;

  const warnings = (data ?? []).reduce((sum, row) => sum + row.dataHealthWarnings.length, 0);
  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Festivals</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.length ?? 0}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Upcoming editions</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.filter((r) => r.nextEditionId).length ?? 0}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Live / settling</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{data?.filter((r) => r.lifecycleState === "live" || r.lifecycleState === "settling").length ?? 0}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">System check warnings</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{warnings}</CardContent></Card>
    </div>
    <Input placeholder="Filter by festival, city or lifecycle…" value={filter} onChange={(event) => setFilter(event.target.value)} />
    <div className="grid gap-3">
      {rows.map((row) => <Card key={row.festivalId}>
        <CardHeader><CardTitle className="flex flex-wrap items-center gap-2"><CalendarDays className="h-5 w-5" />{row.brandName}<Badge>{row.lifecycleState ?? "no edition"}</Badge>{row.dataHealthWarnings.length > 0 && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />{row.dataHealthWarnings.length}</Badge>}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div><p className="text-xs text-muted-foreground">City</p><p>{row.cityName ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Festival edition</p><p>{row.currentEditionTitle ?? row.currentEditionId ?? "No edition"}</p></div>
          <div><p className="text-xs text-muted-foreground">Stages / contracts</p><p>{row.stageCount} / {row.activeContractCount}</p></div>
          <div><p className="text-xs text-muted-foreground">Sessions / outcomes</p><p>{row.performanceSessionCount} / {row.outcomeCount}</p></div>
          <div><p className="text-xs text-muted-foreground">Forecast</p><p>{formatFestivalMoney(row.projectedFinanceCents, row.currencyCode)}</p></div>
          <div className="flex flex-wrap items-end gap-2">{(() => { const editionId = row.currentEditionId || row.nextEditionId || row.completedEditionId; return editionId ? <Button asChild variant="outline" size="sm"><Link to={`/festivals/${row.festivalId}/manage/editions/${editionId}`}><HeartPulse className="mr-2 h-4 w-4" />Open management</Link></Button> : <Button variant="outline" size="sm" disabled>Create first edition</Button>; })()}<Button asChild variant="ghost" size="sm"><Link to={`/festivals/${row.festivalId}`}><ExternalLink className="mr-2 h-4 w-4" />View public page</Link></Button><Button asChild variant="ghost" size="sm"><Link to="/admin/festivals#system-checks">View system checks</Link></Button></div>
          {row.dataHealthWarnings.length > 0 && <div className="md:col-span-6 text-sm text-muted-foreground">{row.dataHealthWarnings.map((issue) => issue.message).join(" · ")}</div>}
        </CardContent>
      </Card>)}
    </div>
  </div>;
}
