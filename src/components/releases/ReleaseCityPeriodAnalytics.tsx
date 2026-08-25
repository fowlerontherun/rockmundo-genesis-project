import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, MapPin } from "lucide-react";
import { minorToMajor } from "@/lib/releaseMoney";

type PeriodKind = "day" | "week" | "month";

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

const moneyMinor = (value: number) => minorToMajor(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const moneyMajor = (value: number) => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function ReleaseCityPeriodAnalytics({ release }: { release: any }) {
  const [period, setPeriod] = useState<PeriodKind>("day");

  const analytics = useQuery({
    queryKey: ["release-manage-city-period-analytics", release?.band_id, release?.id, period],
    queryFn: async () => {
      if (!release?.band_id || !release?.id) return null;
      const { data, error } = await (supabase as any).rpc("get_release_manager_city_analytics", {
        p_band_id: release.band_id,
        p_release_id: release.id,
        p_period_kind: period,
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

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="font-semibold">Sales & streaming by city</h3>
        <p className="text-xs text-muted-foreground">Breakdown for this release only.</p>
      </div>
      <div className="flex gap-1">
        {(["day", "week", "month"] as PeriodKind[]).map((value) => <Button key={value} type="button" size="sm" variant={period === value ? "default" : "outline"} onClick={() => setPeriod(value)} className="capitalize">{value}</Button>)}
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Units</div><div className="text-xl font-bold">{Number(totals.units || 0).toLocaleString()}</div></CardContent></Card>
      <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Gross sales</div><div className="text-xl font-bold">{moneyMinor(totals.sales_gross_cents)}</div></CardContent></Card>
      <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Net sales</div><div className="text-xl font-bold">{moneyMinor(totals.sales_net_cents)}</div></CardContent></Card>
      <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Streams</div><div className="text-xl font-bold">{Number(totals.streams || 0).toLocaleString()}</div></CardContent></Card>
      <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Streaming revenue</div><div className="text-xl font-bold">{moneyMajor(totals.streaming_revenue)}</div></CardContent></Card>
    </div>

    {(Number(coverage.sales_pct || 0) < 100 || Number(coverage.streams_pct || 0) < 100) && <Alert><MapPin className="h-4 w-4" /><AlertDescription>Older activity did not store a city. Those rows are shown as <strong>Unknown city</strong>; new simulated activity will gain city attribution.</AlertDescription></Alert>}

    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{period === "day" ? "Daily" : period === "week" ? "Weekly" : "Monthly"} city breakdown</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length === 0 ? <div className="py-8 text-center text-muted-foreground">No recorded sales or streams for this release yet.</div> : <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Period</th><th className="py-2 pr-3">City</th><th className="py-2 pr-3">Country</th><th className="py-2 pr-3 text-right">Units</th><th className="py-2 pr-3 text-right">Gross</th><th className="py-2 pr-3 text-right">Net</th><th className="py-2 pr-3 text-right">Streams</th><th className="py-2 text-right">Stream rev.</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row.period_start}-${row.city_id ?? row.city_name}-${index}`} className="border-b last:border-0"><td className="py-2 pr-3">{row.period_start}</td><td className="py-2 pr-3 font-medium">{row.city_name || "Unknown city"}</td><td className="py-2 pr-3">{row.country || "Unknown"}</td><td className="py-2 pr-3 text-right">{Number(row.units || 0).toLocaleString()}</td><td className="py-2 pr-3 text-right">{moneyMinor(row.sales_gross_cents)}</td><td className="py-2 pr-3 text-right">{moneyMinor(row.sales_net_cents)}</td><td className="py-2 pr-3 text-right">{Number(row.streams || 0).toLocaleString()}</td><td className="py-2 text-right">{moneyMajor(row.streaming_revenue)}</td></tr>)}</tbody>
        </table>}
      </CardContent>
    </Card>
  </div>;
}
