import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Row = {
  occurred_at: string;
  axis: "fame" | "fans" | "xp";
  source_system: string;
  event_type: string;
  delta: number;
  xp_delta: number | null;
  cash_delta: number | null;
  gig_grade: string | null;
  entity_kind: string | null;
  entity_id: string | null;
  scope: string | null;
  notes: any;
};

const FameFansAttribution = () => {
  const [profileQuery, setProfileQuery] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [day, setDay] = useState<Date>(new Date());
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const { data: profiles } = useQuery({
    queryKey: ["attr-profile-search", profileQuery],
    enabled: profileQuery.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, fame, fans")
        .or(`username.ilike.%${profileQuery}%,display_name.ilike.%${profileQuery}%`)
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const dayStr = format(day, "yyyy-MM-dd");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["fame-fans-attribution", profileId, dayStr],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_fame_fans_attribution", {
        p_profile_id: profileId,
        p_day: dayStr,
      });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    if (sourceFilter === "all") return rows;
    return rows.filter((r) => r.source_system === sourceFilter);
  }, [rows, sourceFilter]);

  const sources = useMemo(() => Array.from(new Set(rows.map((r) => r.source_system))), [rows]);

  const totals = useMemo(() => {
    const acc = { fame: 0, fans: 0, xp: 0, cash: 0, bySource: {} as Record<string, { fame: number; fans: number }> };
    for (const r of rows) {
      if (r.axis === "fame") acc.fame += Number(r.delta) || 0;
      if (r.axis === "fans") acc.fans += Number(r.delta) || 0;
      acc.xp += r.xp_delta || 0;
      acc.cash += r.cash_delta || 0;
      const s = acc.bySource[r.source_system] ?? { fame: 0, fans: 0 };
      if (r.axis === "fame") s.fame += Number(r.delta) || 0;
      if (r.axis === "fans") s.fans += Number(r.delta) || 0;
      acc.bySource[r.source_system] = s;
    }
    return acc;
  }, [rows]);

  const exportCsv = () => {
    const headers = [
      "occurred_at", "axis", "source_system", "event_type", "delta",
      "xp_delta", "cash_delta", "gig_grade", "entity_kind", "entity_id", "scope", "notes",
    ];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push([
        r.occurred_at, r.axis, r.source_system, r.event_type, r.delta,
        r.xp_delta ?? "", r.cash_delta ?? "", r.gig_grade ?? "", r.entity_kind ?? "",
        r.entity_id ?? "", r.scope ?? "", JSON.stringify(r.notes ?? {}).replace(/"/g, '""'),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fame-fans-${profileId}-${dayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderTable = (axis: "fame" | "fans") => {
    const list = filtered.filter((r) => r.axis === axis);
    return (
      <ScrollArea className="h-[480px] border rounded-md">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="w-[110px]">Time</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="text-right">Δ</TableHead>
              <TableHead className="text-right">XP</TableHead>
              <TableHead className="text-right">Cash</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Entity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No {axis} events recorded for this day.</TableCell></TableRow>
            )}
            {list.map((r, i) => (
              <TableRow key={i} className="text-xs">
                <TableCell className="font-mono">{format(new Date(r.occurred_at), "HH:mm:ss")}</TableCell>
                <TableCell><Badge variant="outline" className="text-[10px]">{r.source_system}</Badge></TableCell>
                <TableCell>{r.event_type}</TableCell>
                <TableCell className={cn("text-right font-mono", Number(r.delta) >= 0 ? "text-emerald-500" : "text-destructive")}>
                  {Number(r.delta) >= 0 ? "+" : ""}{Number(r.delta).toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{r.xp_delta ?? ""}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{r.cash_delta ?? ""}</TableCell>
                <TableCell>{r.gig_grade ?? ""}</TableCell>
                <TableCell className="text-muted-foreground">{r.scope ?? ""}</TableCell>
                <TableCell className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px]" title={r.entity_id ?? ""}>
                  {r.entity_kind}:{r.entity_id?.slice(0, 8)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    );
  };

  return (
    <AdminRoute>
      <div className="container mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Fame & Fans Attribution</h1>
          <p className="text-sm text-muted-foreground">Per-character breakdown of every event that contributed to fame or fans on a given day.</p>
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Select character & day</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[220px]">
                <label className="text-xs text-muted-foreground">Search by username or display name</label>
                <Input value={profileQuery} onChange={(e) => setProfileQuery(e.target.value)} placeholder="Type 2+ characters…" />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <CalendarIcon className="h-4 w-4 mr-2" />{format(day, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={day} onSelect={(d) => d && setDay(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Button variant="outline" disabled={!filtered.length} onClick={exportCsv}>
                <Download className="h-4 w-4 mr-2" />CSV
              </Button>
            </div>

            {profiles && profiles.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {profiles.map((p: any) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={profileId === p.id ? "default" : "outline"}
                    onClick={() => setProfileId(p.id)}
                    className="text-xs"
                  >
                    {p.display_name || p.username} <span className="ml-1 text-muted-foreground">· {p.fame}f {p.fans}fan</span>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {profileId && (
          <>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-base">Day totals</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-4">
                  <div><div className="text-xs text-muted-foreground">Fame</div><div className={cn("text-xl font-bold", totals.fame >= 0 ? "text-emerald-500" : "text-destructive")}>{totals.fame >= 0 ? "+" : ""}{totals.fame.toLocaleString()}</div></div>
                  <div><div className="text-xs text-muted-foreground">Fans</div><div className={cn("text-xl font-bold", totals.fans >= 0 ? "text-emerald-500" : "text-destructive")}>{totals.fans >= 0 ? "+" : ""}{totals.fans.toLocaleString()}</div></div>
                  <div><div className="text-xs text-muted-foreground">XP</div><div className="text-xl font-bold">{totals.xp.toLocaleString()}</div></div>
                  <div><div className="text-xs text-muted-foreground">Cash</div><div className="text-xl font-bold">${totals.cash.toLocaleString()}</div></div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant={sourceFilter === "all" ? "default" : "outline"} onClick={() => setSourceFilter("all")} className="text-xs">All sources</Button>
                  {sources.map((s) => {
                    const b = totals.bySource[s];
                    return (
                      <Button key={s} size="sm" variant={sourceFilter === s ? "default" : "outline"} onClick={() => setSourceFilter(s)} className="text-xs">
                        {s} <span className="ml-1 text-muted-foreground">{b?.fame ? `${b.fame >= 0 ? "+" : ""}${b.fame}f ` : ""}{b?.fans ? `${b.fans >= 0 ? "+" : ""}${b.fans}fan` : ""}</span>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <Tabs defaultValue="fame">
                  <TabsList>
                    <TabsTrigger value="fame">Fame ({rows.filter(r => r.axis === "fame").length})</TabsTrigger>
                    <TabsTrigger value="fans">Fans ({rows.filter(r => r.axis === "fans").length})</TabsTrigger>
                    <TabsTrigger value="xp">XP context ({rows.filter(r => r.axis === "xp").length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="fame" className="mt-3">{isLoading ? <div className="p-8 text-center text-muted-foreground">Loading…</div> : renderTable("fame")}</TabsContent>
                  <TabsContent value="fans" className="mt-3">{isLoading ? <div className="p-8 text-center text-muted-foreground">Loading…</div> : renderTable("fans")}</TabsContent>
                  <TabsContent value="xp" className="mt-3">
                    <ScrollArea className="h-[480px] border rounded-md">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card">
                          <TableRow>
                            <TableHead>Time</TableHead><TableHead>Activity</TableHead><TableHead>Skill</TableHead>
                            <TableHead className="text-right">XP</TableHead><TableHead>Metadata</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.filter(r => r.axis === "xp").map((r, i) => (
                            <TableRow key={i} className="text-xs">
                              <TableCell className="font-mono">{format(new Date(r.occurred_at), "HH:mm:ss")}</TableCell>
                              <TableCell>{r.event_type}</TableCell>
                              <TableCell>{r.scope}</TableCell>
                              <TableCell className="text-right font-mono">{r.xp_delta}</TableCell>
                              <TableCell className="font-mono text-[10px] text-muted-foreground truncate max-w-[280px]">{JSON.stringify(r.notes)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminRoute>
  );
};

export default FameFansAttribution;
