import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, MapPin } from "lucide-react";
import { minorToMajor } from "@/lib/releaseMoney";

type PeriodKind = "day" | "week" | "month";
type ActivityFilter = "all" | "streams" | "sales" | "digital" | "vinyl" | "cd" | "cassette";

type Row = {
  period_start: string;
  city_id: string | null;
  city_name: string;
  country: string;
  units: number;
  sales_gross_cents: number;
  sales_net_cents: number;
  streams: number;
  streaming_revenue: number;
};

type Payload = {
  rows: Row[];
  totals: {
    units: number;
    sales_gross_cents: number;
    sales_net_cents: number;
    streams: number;
    streaming_revenue: number;
  };
  coverage: { sales_pct: number; streams_pct: number };
};

const FILTER_OPTIONS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All activity" },
  { value: "streams", label: "Streams" },
  { value: "sales", label: "Record sales" },
  { value: "digital", label: "Digital sales" },
  { value: "vinyl", label: "Vinyl sales" },
  { value: "cd", label: "CD sales" },
  { value: "cassette", label: "Cassette sales" },
];

const moneyMinor = (value: number) => minorToMajor(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const moneyMajor = (value: number) => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ReleaseCityPeriodAnalytics({ release }: { release: any }) {
  const [period, setPeriod] = useState<PeriodKind>("day");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");

  const analytics = useQuery({
    queryKey: ["release-manage-city-period-analytics", release?.band_id, release?.id, period, activityFilter],
    queryFn: async () => {
      if (!release?.band_id || !release?.id) return null;
      const { data, error } = await (supabase as any).rpc("get_release_manager_city_analytics", {
        p_band_id: release.band_id,
        p_release_id: release.id,
        p_period_kind: period,
        p_activity_filter: activityFilter,
      });
      if (error) throw error;
      return data as Payload;
    },
    enabled: !!release?.band_id && !!release?.id,
    retry: false,
  });

  if (analytics.isLoading) return <div className="py-8 text-center text-muted-foreground">Loading city and period analytics…</div>;
  if (analytics.error || !analytics.data) return <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>City and period analytics are temporarily unavailable.</AlertDescription></Alert>;

  const { rows, totals, coverage } = analytics.data;
  const showSales = activityFilter !== "streams";
  const showStreams = activityFilter === "all" || activityFilter === "streams";
  const selectedFilterLabel = FILTER_OPTIONS.find((option) => option.value === activityFilter)?.label ?? "All activity";

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="font-semibold">Sales & streaming by city</h3>
        <p className="text-xs text-muted-foreground">Breakdown for this release only.</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={activityFilter} onValueChange={(value) => setActivityFilter(value as ActivityFilter)}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Filter activity" />
          </SelectTrigger>
          <SelectContent>
            {FILTER_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          {(["day", "week", "month"] as PeriodKind[]).map((value) => <Button key={value} type="button" size="sm" variant={period === value ? "default" : "outline"} onClick={() => setPeriod(value)} className="capitalize">{value}</Button>)}
        </div>
      </div>
    </div>

    <div className={`grid grid-cols-2 gap-3 ${showSales && showStreams ? "md:grid-cols-5" : showSales ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {showSales && <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Units</div><div className="text-xl font-bold">{Number(totals.units || 0).toLocaleString()}</div></CardContent></Card>}
      {showSales && <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Gross sales</div><div className="text-xl font-bold">{moneyMinor(totals.sales_gross_cents)}</div></CardContent></Card>}
      {showSales && <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Net sales</div><div className="text-xl font-bold">{moneyMinor(totals.sales_net_cents)}</div></CardContent></Card>}
      {showStreams && <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Streams</div><div className="text-xl font-bold">{Number(totals.streams || 0).toLocaleString()}</div></CardContent></Card>}
      {showStreams && <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Streaming revenue</div><div className="text-xl font-bold">{moneyMajor(totals.streaming_revenue)}</div></CardContent></Card>}
    </div>

    {((showSales && Number(coverage.sales_pct || 0) < 100) || (showStreams && Number(coverage.streams_pct || 0) < 100)) && <Alert><MapPin className="h-4 w-4" /><AlertDescription>Older activity did not store a city. Those rows are shown as <strong>Unknown city</strong>; new simulated activity will gain city attribution.</AlertDescription></Alert>}

    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{period === "day" ? "Daily" : period === "week" ? "Weekly" : "Monthly"} city breakdown · {selectedFilterLabel}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? <div className="py-8 text-center text-muted-foreground">No {selectedFilterLabel.toLowerCase()} recorded for this release yet.</div> : <table className={`w-full text-sm ${showSales && showStreams ? "min-w-[760px]" : "min-w-[540px]"}`}>
          <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Period</th><th className="py-2 pr-3">City</th><th className="py-2 pr-3">Country</th>{showSales && <th className="py-2 pr-3 text-right">Units</th>}{showSales && <th className="py-2 pr-3 text-right">Gross</th>}{showSales && <th className="py-2 pr-3 text-right">Net</th>}{showStreams && <th className="py-2 pr-3 text-right">Streams</th>}{showStreams && <th className="py-2 text-right">Stream rev.</th>}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row.period_start}-${row.city_id ?? row.city_name}-${index}`} className="border-b last:border-0"><td className="py-2 pr-3">{row.period_start}</td><td className="py-2 pr-3 font-medium">{row.city_name || "Unknown city"}</td><td className="py-2 pr-3">{row.country || "Unknown"}</td>{showSales && <td className="py-2 pr-3 text-right">{Number(row.units || 0).toLocaleString()}</td>}{showSales && <td className="py-2 pr-3 text-right">{moneyMinor(row.sales_gross_cents)}</td>}{showSales && <td className="py-2 pr-3 text-right">{moneyMinor(row.sales_net_cents)}</td>}{showStreams && <td className="py-2 pr-3 text-right">{Number(row.streams || 0).toLocaleString()}</td>}{showStreams && <td className="py-2 text-right">{moneyMajor(row.streaming_revenue)}</td>}</tr>)}</tbody>
        </table>}
      </CardContent>
    </Card>
  </div>;
}
