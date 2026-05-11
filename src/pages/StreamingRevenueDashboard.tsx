import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { ArrowLeft, BarChart3, Download, TrendingUp, DollarSign, Headphones } from "lucide-react";
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
  Legend,
} from "recharts";

type Row = {
  id: string;
  song_release_id: string;
  analytics_date: string;
  daily_streams: number;
  daily_revenue: number;
  unique_listeners: number | null;
  platform_id: string | null;
  platform_name: string | null;
  listener_region: string | null;
  release: {
    id: string;
    band_id: string | null;
    user_id: string | null;
    platform_id: string | null;
    platform_name: string | null;
    country: string | null;
    song: { title: string | null } | null;
    band: { id: string; name: string } | null;
    platform: { id: string; platform_name: string } | null;
  } | null;
};

const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function StreamingRevenueDashboard() {
  const { userId } = useActiveProfile();

  const [bandFilter, setBandFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all" | "custom">("30d");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["streaming-dashboard", userId],
    enabled: !!userId,
    queryFn: async () => {
      // Fetch user's song releases (own + their bands)
      const { data: releases, error: relErr } = await supabase
        .from("song_releases")
        .select(`
          id, band_id, user_id, platform_id, platform_name, country,
          song:songs(title),
          band:bands(id, name),
          platform:streaming_platforms(id, platform_name)
        `)
        .or(`user_id.eq.${userId},band_id.in.(select band_id from band_members where user_id='${userId}')`);
      if (relErr) throw relErr;

      const releaseIds = (releases ?? []).map((r: any) => r.id);
      if (releaseIds.length === 0) return [] as Row[];
      const releaseMap = new Map((releases ?? []).map((r: any) => [r.id, r]));

      // Fetch analytics in chunks of 200 ids
      const all: Row[] = [];
      for (let i = 0; i < releaseIds.length; i += 200) {
        const chunk = releaseIds.slice(i, i + 200);
        const { data, error } = await supabase
          .from("streaming_analytics_daily")
          .select(
            "id, song_release_id, analytics_date, daily_streams, daily_revenue, unique_listeners, platform_id, platform_name, listener_region",
          )
          .in("song_release_id", chunk)
          .order("analytics_date", { ascending: false })
          .range(0, 4999);
        if (error) throw error;
        for (const a of data ?? []) {
          all.push({ ...(a as any), release: releaseMap.get((a as any).song_release_id) ?? null });
        }
      }
      return all;
    },
  });

  const bandOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => {
      if (r.release?.band) m.set(r.release.band.id, r.release.band.name);
    });
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const platformOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const p = r.platform_name || r.release?.platform?.platform_name || r.release?.platform_name;
      if (p) set.add(p);
    });
    return Array.from(set);
  }, [rows]);

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      const reg = r.listener_region || r.release?.country;
      if (reg) set.add(reg);
    });
    return Array.from(set);
  }, [rows]);

  const effectiveFrom = useMemo(() => {
    if (range === "custom") return dateFrom || "";
    if (range === "7d") return isoDaysAgo(7);
    if (range === "30d") return isoDaysAgo(30);
    if (range === "90d") return isoDaysAgo(90);
    return "";
  }, [range, dateFrom]);
  const effectiveTo = useMemo(() => (range === "custom" ? dateTo || "" : ""), [range, dateTo]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (bandFilter !== "all" && r.release?.band?.id !== bandFilter) return false;
      const platName = r.platform_name || r.release?.platform?.platform_name || r.release?.platform_name;
      if (platformFilter !== "all" && platName !== platformFilter) return false;
      const reg = r.listener_region || r.release?.country || "";
      if (regionFilter !== "all" && reg !== regionFilter) return false;
      if (effectiveFrom && r.analytics_date < effectiveFrom) return false;
      if (effectiveTo && r.analytics_date > effectiveTo) return false;
      return true;
    });
  }, [rows, bandFilter, platformFilter, regionFilter, effectiveFrom, effectiveTo]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.streams += r.daily_streams || 0;
        acc.revenue += r.daily_revenue || 0;
        acc.listeners += r.unique_listeners || 0;
        return acc;
      },
      { streams: 0, revenue: 0, listeners: 0 },
    );
  }, [filtered]);

  const dailySeries = useMemo(() => {
    const m = new Map<string, { date: string; streams: number; revenue: number }>();
    filtered.forEach((r) => {
      const d = r.analytics_date;
      const cur = m.get(d) ?? { date: d, streams: 0, revenue: 0 };
      cur.streams += r.daily_streams || 0;
      cur.revenue += r.daily_revenue || 0;
      m.set(d, cur);
    });
    return Array.from(m.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  const platformSeries = useMemo(() => {
    const m = new Map<string, { platform: string; streams: number; revenue: number }>();
    filtered.forEach((r) => {
      const p = r.platform_name || r.release?.platform?.platform_name || "Unknown";
      const cur = m.get(p) ?? { platform: p, streams: 0, revenue: 0 };
      cur.streams += r.daily_streams || 0;
      cur.revenue += r.daily_revenue || 0;
      m.set(p, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.streams - a.streams);
  }, [filtered]);

  const regionSeries = useMemo(() => {
    const m = new Map<string, { region: string; streams: number; revenue: number }>();
    filtered.forEach((r) => {
      const reg = r.listener_region || r.release?.country || "Unknown";
      const cur = m.get(reg) ?? { region: reg, streams: 0, revenue: 0 };
      cur.streams += r.daily_streams || 0;
      cur.revenue += r.daily_revenue || 0;
      m.set(reg, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.streams - a.streams).slice(0, 10);
  }, [filtered]);

  const tableRows = useMemo(
    () => [...filtered].sort((a, b) => b.analytics_date.localeCompare(a.analytics_date)),
    [filtered],
  );
  const totalPages = Math.max(1, Math.ceil(tableRows.length / PAGE_SIZE));
  const pageRows = tableRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCsv = () => {
    const header = ["Date", "Band", "Song", "Platform", "Region", "Streams", "Revenue", "Listeners"];
    const lines = [header.join(",")];
    tableRows.forEach((r) => {
      const cols = [
        r.analytics_date,
        r.release?.band?.name ?? "",
        r.release?.song?.title ?? "",
        r.platform_name || r.release?.platform?.platform_name || "",
        r.listener_region || r.release?.country || "",
        String(r.daily_streams || 0),
        String(r.daily_revenue || 0),
        String(r.unique_listeners || 0),
      ].map((s) => `"${String(s).replace(/"/g, '""')}"`);
      lines.push(cols.join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `streaming-revenue-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/streaming-platforms">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Streaming &amp; Revenue
          </h1>
        </div>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={tableRows.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Select value={bandFilter} onValueChange={setBandFilter}>
            <SelectTrigger><SelectValue placeholder="Band" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bands</SelectItem>
              {bandOptions.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {platformOptions.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {regionOptions.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {range === "custom" ? (
            <div className="flex gap-1 col-span-2 md:col-span-1">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          ) : <div />}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Headphones className="h-3 w-3" />Streams</div>
          <div className="text-xl font-bold">{totals.streams.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Revenue</div>
          <div className="text-xl font-bold text-green-500">${totals.revenue.toLocaleString()}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" />Listeners</div>
          <div className="text-xl font-bold">{totals.listeners.toLocaleString()}</div>
        </CardContent></Card>
      </div>

      {/* Charts */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Streams &amp; Revenue Over Time</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailySeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="l" />
              <YAxis yAxisId="r" orientation="right" />
              <Tooltip />
              <Legend />
              <Area yAxisId="l" type="monotone" dataKey="streams" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" name="Streams" />
              <Area yAxisId="r" type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2, 142 76% 36%))" fill="hsl(var(--chart-2, 142 76% 36%)/0.2)" name="Revenue ($)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">By Platform</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={platformSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="streams" fill="hsl(var(--primary))" name="Streams" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Regions</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={regionSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="region" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="streams" fill="hsl(var(--chart-3, 217 91% 60%))" name="Streams" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Drill-down table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Drill-Down ({tableRows.length.toLocaleString()} rows)</CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Prev</Button>
            <span className="text-xs text-muted-foreground px-2">{page + 1}/{totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
          ) : tableRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No streaming activity for the selected filters.</p>
          ) : (
            <ResponsiveTable>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Band</TableHead>
                    <TableHead>Song</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Streams</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.analytics_date}</TableCell>
                      <TableCell>{r.release?.band?.name ?? "—"}</TableCell>
                      <TableCell>{r.release?.song?.title ?? "—"}</TableCell>
                      <TableCell>{r.platform_name || r.release?.platform?.platform_name || "—"}</TableCell>
                      <TableCell>{r.listener_region || r.release?.country || "—"}</TableCell>
                      <TableCell className="text-right">{(r.daily_streams || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-500">${(r.daily_revenue || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ResponsiveTable>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
