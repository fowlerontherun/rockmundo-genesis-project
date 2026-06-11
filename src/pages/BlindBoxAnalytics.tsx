import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ChartLine, Package, Sparkles, ArrowLeft, Trophy, BarChart3, Download, ChevronLeft, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";

type Opening = {
  id: string;
  box_id: string;
  tier: string;
  rolled_at: string;
  xp_awarded: number;
  ap_awarded: number;
  reward_summary: { quality?: number; song?: string; instrument?: string } | null;
};

type Box = { id: string; name: string; tier_odds: Record<string, number> };

const TIERS = ["common", "rare", "epic", "legendary"] as const;
const TIER_HSL: Record<string, string> = {
  common: "hsl(215 16% 65%)",
  rare: "hsl(217 91% 65%)",
  epic: "hsl(270 91% 70%)",
  legendary: "hsl(43 96% 60%)",
};
const TIER_LABEL: Record<string, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

export default function BlindBoxAnalytics() {
  const { profileId } = useActiveProfile();
  const [boxFilter, setBoxFilter] = useState<string>("all");
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [qMin, setQMin] = useState<string>("");
  const [qMax, setQMax] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const { data: boxes = [] } = useQuery({
    queryKey: ["blind-boxes-meta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blind_boxes" as any)
        .select("id, name, tier_odds");
      if (error) throw error;
      return (data ?? []) as unknown as Box[];
    },
  });

  const { data: openings = [], isLoading } = useQuery({
    queryKey: ["blind-box-openings", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blind_box_openings" as any)
        .select("id, box_id, tier, rolled_at, xp_awarded, ap_awarded, reward_summary")
        .eq("profile_id", profileId!)
        .order("rolled_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Opening[];
    },
  });

  const filtered = useMemo(() => {
    const cutoff =
      range === "7d"
        ? Date.now() - 7 * 86400000
        : range === "30d"
        ? Date.now() - 30 * 86400000
        : 0;
    return openings.filter((o) => {
      if (boxFilter !== "all" && o.box_id !== boxFilter) return false;
      if (cutoff && new Date(o.rolled_at).getTime() < cutoff) return false;
      return true;
    });
  }, [openings, boxFilter, range]);

  const tableRows = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : 0;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86400000 : 0;
    const min = qMin ? Number(qMin) : -Infinity;
    const max = qMax ? Number(qMax) : Infinity;
    const rows = filtered.filter((o) => {
      if (tierFilter !== "all" && o.tier !== tierFilter) return false;
      const ts = new Date(o.rolled_at).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts >= toTs) return false;
      const q = Number(o.reward_summary?.quality ?? 0);
      if (q < min || q > max) return false;
      return true;
    });
    return rows.slice().sort((a, b) => new Date(b.rolled_at).getTime() - new Date(a.rolled_at).getTime());
  }, [filtered, tierFilter, dateFrom, dateTo, qMin, qMax]);

  const boxNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of boxes) m.set(b.id, b.name);
    return m;
  }, [boxes]);

  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const pageRows = tableRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const exportCsv = () => {
    const header = ["Date", "Box", "Tier", "Quality", "Instrument", "Song", "XP", "AP"];
    const lines = [header.join(",")];
    for (const o of tableRows) {
      const cells = [
        new Date(o.rolled_at).toISOString(),
        boxNameById.get(o.box_id) ?? o.box_id,
        o.tier,
        String(o.reward_summary?.quality ?? ""),
        o.reward_summary?.instrument ?? "",
        o.reward_summary?.song ?? "",
        String(o.xp_awarded ?? 0),
        String(o.ap_awarded ?? 0),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blind-box-openings-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total = filtered.length;
  const tierCounts = useMemo(() => {
    const c: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (const o of filtered) c[o.tier] = (c[o.tier] ?? 0) + 1;
    return c;
  }, [filtered]);

  const expectedOdds = useMemo(() => {
    if (boxFilter !== "all") {
      const b = boxes.find((x) => x.id === boxFilter);
      return b?.tier_odds ?? null;
    }
    if (boxes.length === 0) return null;
    const agg: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (const b of boxes) {
      for (const t of TIERS) agg[t] += Number(b.tier_odds?.[t] ?? 0);
    }
    for (const t of TIERS) agg[t] = agg[t] / boxes.length;
    return agg;
  }, [boxes, boxFilter]);

  const tierData = TIERS.map((t) => ({
    tier: TIER_LABEL[t],
    key: t,
    actual: total > 0 ? +((tierCounts[t] / total) * 100).toFixed(1) : 0,
    expected: expectedOdds ? +((expectedOdds[t] ?? 0) * 100).toFixed(1) : 0,
    count: tierCounts[t],
  }));

  const qualities = filtered
    .map((o) => Number(o.reward_summary?.quality ?? 0))
    .filter((n) => n > 0);
  const avgQuality = qualities.length
    ? Math.round(qualities.reduce((a, b) => a + b, 0) / qualities.length)
    : 0;
  const bestQuality = qualities.length ? Math.max(...qualities) : 0;
  const totalXp = filtered.reduce((s, o) => s + (o.xp_awarded ?? 0), 0);
  const totalAp = filtered.reduce((s, o) => s + (o.ap_awarded ?? 0), 0);

  // Time-series: bucket by day with cumulative best tier and rolling quality
  const series = useMemo(() => {
    if (filtered.length === 0) return [] as Array<{
      date: string;
      opens: number;
      avgQuality: number;
      epicPlus: number;
    }>;
    const byDay = new Map<string, Opening[]>();
    for (const o of filtered) {
      const d = new Date(o.rolled_at);
      const key = d.toISOString().slice(0, 10);
      const arr = byDay.get(key) ?? [];
      arr.push(o);
      byDay.set(key, arr);
    }
    const keys = Array.from(byDay.keys()).sort();
    let cumEpic = 0;
    return keys.map((k) => {
      const arr = byDay.get(k)!;
      const qs = arr.map((o) => Number(o.reward_summary?.quality ?? 0)).filter((n) => n > 0);
      const epic = arr.filter((o) => o.tier === "epic" || o.tier === "legendary").length;
      cumEpic += epic;
      return {
        date: k,
        opens: arr.length,
        avgQuality: qs.length ? Math.round(qs.reduce((a, b) => a + b, 0) / qs.length) : 0,
        epicPlus: cumEpic,
      };
    });
  }, [filtered]);

  return (
    <div className="container mx-auto max-w-6xl space-y-4 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" /> Blind Box Analytics
          </h1>
          <p className="text-sm text-muted-foreground">
            Pull rates, average quality, and your progression over time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={boxFilter} onValueChange={setBoxFilter}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="All boxes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All boxes</SelectItem>
              {boxes.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v as any)}>
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild variant="outline" size="sm">
            <Link to="/blind-boxes">
              <ArrowLeft className="h-4 w-4 mr-1" /> Store
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : total === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Package className="mx-auto h-8 w-8 mb-2 opacity-60" />
            No openings in this range yet. Open a box to start tracking your luck.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat title="Total Opens" value={total.toLocaleString()} icon={<Package className="h-4 w-4" />} />
            <Stat title="Avg Quality" value={avgQuality} icon={<Sparkles className="h-4 w-4" />} />
            <Stat title="Best Roll" value={bestQuality} icon={<Trophy className="h-4 w-4" />} />
            <Stat title="XP / AP" value={`${totalXp.toLocaleString()} / ${totalAp}`} icon={<ChartLine className="h-4 w-4" />} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Pull Rates by Tier</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={tierData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="tier" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="expected" name="Expected" fill="hsl(var(--muted-foreground))" opacity={0.4} />
                    <Bar dataKey="actual" name="Actual">
                      {tierData.map((d) => (
                        <Cell key={d.key} fill={TIER_HSL[d.key]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {tierData.map((d) => (
                    <div key={d.key} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: TIER_HSL[d.key] }}
                      />
                      <span className="flex-1">{d.tier}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {d.count} pulls
                      </Badge>
                      <span className="w-14 text-right tabular-nums">{d.actual}%</span>
                      <span className="w-16 text-right tabular-nums text-muted-foreground">
                        exp {d.expected}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Quality Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={qualityBuckets(qualities)}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <Mini label="Min" value={qualities.length ? Math.min(...qualities) : 0} />
                  <Mini label="Avg" value={avgQuality} />
                  <Mini label="Max" value={bestQuality} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Progression Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={series}>
                  <defs>
                    <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    }
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="avgQuality"
                    name="Avg Quality"
                    stroke="hsl(var(--primary))"
                    fill="url(#qGrad)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="epicPlus"
                    name="Cumulative Epic+"
                    stroke={TIER_HSL.epic}
                    fill={TIER_HSL.epic}
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Daily Opens</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    }
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="opens" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Opening Drill-Down</CardTitle>
                <Button size="sm" variant="outline" onClick={exportCsv} disabled={tableRows.length === 0}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setPage(0); }}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Tier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tiers</SelectItem>
                    {TIERS.map((t) => (
                      <SelectItem key={t} value={t}>{TIER_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  className="h-8"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                  placeholder="From"
                />
                <Input
                  type="date"
                  className="h-8"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                  placeholder="To"
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  className="h-8"
                  placeholder="Min quality"
                  value={qMin}
                  onChange={(e) => { setQMin(e.target.value); setPage(0); }}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  className="h-8"
                  placeholder="Max quality"
                  value={qMax}
                  onChange={(e) => { setQMax(e.target.value); setPage(0); }}
                />
              </div>

              <ResponsiveTable>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Box</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Quality</TableHead>
                      <TableHead>Instrument</TableHead>
                      <TableHead>Song</TableHead>
                      <TableHead className="text-right">XP</TableHead>
                      <TableHead className="text-right">AP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                          No openings match these filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pageRows.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="whitespace-nowrap">
                            {new Date(o.rolled_at).toLocaleString("en-US", {
                              month: "short", day: "numeric", year: "2-digit", hour: "numeric", minute: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate">{boxNameById.get(o.box_id) ?? "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                              style={{ borderColor: TIER_HSL[o.tier], color: TIER_HSL[o.tier] }}
                            >
                              {TIER_LABEL[o.tier] ?? o.tier}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{o.reward_summary?.quality ?? "—"}</TableCell>
                          <TableCell className="max-w-[140px] truncate">{o.reward_summary?.instrument ?? "—"}</TableCell>
                          <TableCell className="max-w-[160px] truncate">{o.reward_summary?.song ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{o.xp_awarded ?? 0}</TableCell>
                          <TableCell className="text-right tabular-nums">{o.ap_awarded ?? 0}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ResponsiveTable>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {tableRows.length === 0 ? 0 : page * PAGE_SIZE + 1}–
                  {Math.min(tableRows.length, (page + 1) * PAGE_SIZE)} of {tableRows.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-1 tabular-nums">
                    {page + 1} / {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function qualityBuckets(qualities: number[]) {
  const ranges: Array<[number, number, string]> = [
    [0, 40, "0-40"],
    [40, 60, "40-60"],
    [60, 75, "60-75"],
    [75, 90, "75-90"],
    [90, 101, "90+"],
  ];
  return ranges.map(([lo, hi, label]) => ({
    bucket: label,
    count: qualities.filter((q) => q >= lo && q < hi).length,
  }));
}

function Stat({ title, value, icon }: { title: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{title}</span>
          <span className="text-primary">{icon}</span>
        </div>
        <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
