import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  MapPin,
  Music,
  Package,
  Radio,
} from "lucide-react";
import { minorToMajor } from "@/lib/releaseMoney";
import { resolveActiveBandMembership } from "@/utils/activeBandMembership";

interface ReleaseSalesTabProps {
  userId: string;
  authUserId?: string | null;
}

type Summary = {
  gross_cents: number;
  tax_cents: number;
  dist_cents: number;
  manufacturer_cents: number;
  net_before_label_cents: number;
  label_cents: number;
  band_revenue_cents: number;
  units: number;
  economic_cost_cents: number;
  band_cost_cents: number;
  label_cost_cents: number;
  unknown_cost_cents: number;
};

type PeriodKind = "day" | "week" | "month";

type ReleaseOption = {
  id: string;
  title: string;
  scheduled_release_date: string | null;
};

type CityAnalyticsRow = {
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

type ReleaseTotalRow = {
  release_id: string;
  release_title: string;
  units: number;
  sales_gross_cents: number;
  sales_net_cents: number;
  streams: number;
  streaming_revenue: number;
};

type AnalyticsPayload = {
  period_kind: PeriodKind;
  scope: "all" | "release";
  rows: CityAnalyticsRow[];
  release_totals: ReleaseTotalRow[];
  totals: {
    units: number;
    sales_gross_cents: number;
    sales_net_cents: number;
    streams: number;
    streaming_revenue: number;
  };
  coverage: {
    sales_pct: number;
    streams_pct: number;
  };
};

const PAGE_SIZE = 50;
const EMPTY_SUMMARY: Summary = {
  gross_cents: 0,
  tax_cents: 0,
  dist_cents: 0,
  manufacturer_cents: 0,
  net_before_label_cents: 0,
  label_cents: 0,
  band_revenue_cents: 0,
  units: 0,
  economic_cost_cents: 0,
  band_cost_cents: 0,
  label_cost_cents: 0,
  unknown_cost_cents: 0,
};

const money = (minor: number) =>
  minorToMajor(minor || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });

const streamingMoney = (major: number) =>
  Number(major || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const periodLabel = (date: string, period: PeriodKind) => {
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime())) return date;

  if (period === "month") {
    return value.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  if (period === "week") {
    const end = new Date(value);
    end.setUTCDate(end.getUTCDate() + 6);
    const startLabel = value.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    const endLabel = end.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    return `${startLabel} – ${endLabel}`;
  }

  return value.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

export function ReleaseSalesTab({ userId, authUserId }: ReleaseSalesTabProps) {
  const [releaseFilter, setReleaseFilter] = useState("all");
  const [periodKind, setPeriodKind] = useState<PeriodKind>("day");
  const [page, setPage] = useState(0);

  const membership = useQuery({
    queryKey: ["release-sales-membership", userId, authUserId],
    queryFn: () => resolveActiveBandMembership(userId, authUserId),
    retry: false,
  });

  const health = useQuery({
    queryKey: ["release-finance-health"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_release_finance_health");
      if (error) throw error;
      if (!data?.ready || Number(data.contract_version) < 2) {
        throw new Error("Incomplete release finance backend");
      }
      return data;
    },
    retry: false,
  });

  const { data: finance, isLoading: financeLoading, error: financeError } = useQuery({
    queryKey: ["release-financial-summary", userId, authUserId, membership.data?.band_id],
    queryFn: async () => {
      if (!membership.data) return null;
      const { data, error } = await (supabase as any).rpc("get_release_financial_summary", {
        p_release_id: null,
        p_band_id: membership.data.band_id,
      });
      if (error) throw error;

      return ((data || []) as Summary[]).reduce((acc, row) => {
        (Object.keys(acc) as Array<keyof Summary>).forEach((key) => {
          acc[key] += Number(row[key] || 0);
        });
        return acc;
      }, { ...EMPTY_SUMMARY });
    },
    enabled: health.isSuccess && membership.isSuccess,
    retry: false,
  });

  const { data: releases = [] } = useQuery({
    queryKey: ["release-manager-analytics-releases", membership.data?.band_id],
    queryFn: async () => {
      if (!membership.data?.band_id) return [] as ReleaseOption[];
      const { data, error } = await supabase
        .from("releases")
        .select("id,title,scheduled_release_date")
        .eq("band_id", membership.data.band_id)
        .eq("release_status", "released")
        .order("scheduled_release_date", { ascending: false });
      if (error) throw error;
      return (data || []) as ReleaseOption[];
    },
    enabled: !!membership.data?.band_id,
  });

  const analytics = useQuery({
    queryKey: [
      "release-manager-city-analytics",
      membership.data?.band_id,
      releaseFilter,
      periodKind,
    ],
    queryFn: async () => {
      if (!membership.data?.band_id) return null;
      const { data, error } = await (supabase as any).rpc(
        "get_release_manager_city_analytics",
        {
          p_band_id: membership.data.band_id,
          p_release_id: releaseFilter === "all" ? null : releaseFilter,
          p_period_kind: periodKind,
        },
      );
      if (error) throw error;
      return data as AnalyticsPayload;
    },
    enabled: !!membership.data?.band_id,
    retry: false,
  });

  const { data: streaming } = useQuery({
    queryKey: ["streaming-revenue", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("song_releases")
        .select("total_streams,total_revenue")
        .eq("user_id", userId)
        .eq("is_active", true)
        .eq("release_type", "streaming");
      if (error) throw error;
      return {
        streams: (data || []).reduce((sum, row) => sum + (row.total_streams || 0), 0),
        revenue: (data || []).reduce((sum, row) => sum + (row.total_revenue || 0), 0),
      };
    },
  });

  useEffect(() => {
    setPage(0);
  }, [releaseFilter, periodKind]);

  const rows = analytics.data?.rows || [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visibleRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  const selectedReleaseTitle =
    releaseFilter === "all"
      ? "All records"
      : releases.find((release) => release.id === releaseFilter)?.title || "Selected record";

  const periodTotals = useMemo(() => {
    const totals = new Map<
      string,
      { units: number; sales: number; streams: number; streamingRevenue: number }
    >();
    rows.forEach((row) => {
      const current = totals.get(row.period_start) || {
        units: 0,
        sales: 0,
        streams: 0,
        streamingRevenue: 0,
      };
      current.units += Number(row.units || 0);
      current.sales += Number(row.sales_gross_cents || 0);
      current.streams += Number(row.streams || 0);
      current.streamingRevenue += Number(row.streaming_revenue || 0);
      totals.set(row.period_start, current);
    });
    return Array.from(totals.entries())
      .map(([period, values]) => ({ period, ...values }))
      .sort((a, b) => b.period.localeCompare(a.period));
  }, [rows]);

  if (membership.isLoading || health.isLoading || financeLoading) {
    return <div>Loading release analytics…</div>;
  }

  if (health.error || financeError || membership.error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Release financial data is temporarily unavailable.</AlertDescription>
      </Alert>
    );
  }

  if (!membership.data || !finance) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          You are not currently an active member of a band. Existing releases remain available in My Releases.
        </AlertDescription>
      </Alert>
    );
  }

  const profit = finance.band_revenue_cents - finance.band_cost_cents;
  const cards = [
    ["Gross Sales", money(finance.gross_cents), DollarSign],
    ["Band Revenue", money(finance.band_revenue_cents), DollarSign],
    ["Costs Paid by Band", money(finance.band_cost_cents), Package],
    ["Band Profit / Loss", money(profit), DollarSign],
    ["Units Sold", finance.units.toLocaleString(), Package],
    ["Streams", (streaming?.streams || 0).toLocaleString(), Music],
  ] as const;

  const breakdownTotals = analytics.data?.totals;
  const coverage = analytics.data?.coverage;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, value, Icon]) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex gap-1 text-xs text-muted-foreground">
                <Icon className="h-4 w-4" />
                {label}
              </div>
              <div className="mt-1 text-xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Sales & streaming by city
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              View {selectedReleaseTitle.toLowerCase()} by day, ISO week or month. Sales and streams remain separate so every total can be reconciled.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="release-analytics-record">
                Record
              </label>
              <Select value={releaseFilter} onValueChange={setReleaseFilter}>
                <SelectTrigger id="release-analytics-record">
                  <SelectValue placeholder="Choose a record" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All records</SelectItem>
                  {releases.map((release) => (
                    <SelectItem key={release.id} value={release.id}>
                      {release.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="release-analytics-period">
                Breakdown
              </label>
              <Select value={periodKind} onValueChange={(value) => setPeriodKind(value as PeriodKind)}>
                <SelectTrigger id="release-analytics-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {analytics.isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading city breakdown…</div>
          ) : analytics.error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                The city sales and streaming breakdown could not be loaded.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Units sold</div>
                  <div className="text-lg font-semibold">{Number(breakdownTotals?.units || 0).toLocaleString()}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Gross sales</div>
                  <div className="text-lg font-semibold">{money(Number(breakdownTotals?.sales_gross_cents || 0))}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Net sales</div>
                  <div className="text-lg font-semibold">{money(Number(breakdownTotals?.sales_net_cents || 0))}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Streams</div>
                  <div className="text-lg font-semibold">{Number(breakdownTotals?.streams || 0).toLocaleString()}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Streaming revenue</div>
                  <div className="text-lg font-semibold">{streamingMoney(Number(breakdownTotals?.streaming_revenue || 0))}</div>
                </div>
              </div>

              {coverage && (coverage.sales_pct < 100 || coverage.streams_pct < 100) && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Historical city coverage is incomplete: {Number(coverage.sales_pct).toFixed(1)}% of sale units and {Number(coverage.streams_pct).toFixed(1)}% of streams have a recorded city. Older country-only facts are retained below as <strong>Unknown city</strong> rather than being guessed.
                  </AlertDescription>
                </Alert>
              )}

              {releaseFilter === "all" && (analytics.data?.release_totals?.length || 0) > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">All records</h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="px-3 py-2 font-medium">Record</th>
                          <th className="px-3 py-2 text-right font-medium">Units</th>
                          <th className="px-3 py-2 text-right font-medium">Gross sales</th>
                          <th className="px-3 py-2 text-right font-medium">Net sales</th>
                          <th className="px-3 py-2 text-right font-medium">Streams</th>
                          <th className="px-3 py-2 text-right font-medium">Streaming revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.data?.release_totals.map((row) => (
                          <tr key={row.release_id} className="border-t">
                            <td className="px-3 py-2 font-medium">{row.release_title}</td>
                            <td className="px-3 py-2 text-right">{Number(row.units).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{money(Number(row.sales_gross_cents))}</td>
                            <td className="px-3 py-2 text-right">{money(Number(row.sales_net_cents))}</td>
                            <td className="px-3 py-2 text-right">{Number(row.streams).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{streamingMoney(Number(row.streaming_revenue))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {periodTotals.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <CalendarDays className="h-4 w-4" />
                    {periodKind === "day" ? "Daily" : periodKind === "week" ? "Weekly" : "Monthly"} totals
                  </h3>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[700px] text-sm">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="px-3 py-2 font-medium">Period</th>
                          <th className="px-3 py-2 text-right font-medium">Units</th>
                          <th className="px-3 py-2 text-right font-medium">Gross sales</th>
                          <th className="px-3 py-2 text-right font-medium">Streams</th>
                          <th className="px-3 py-2 text-right font-medium">Streaming revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periodTotals.map((row) => (
                          <tr key={row.period} className="border-t">
                            <td className="px-3 py-2 font-medium">{periodLabel(row.period, periodKind)}</td>
                            <td className="px-3 py-2 text-right">{row.units.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{money(row.sales)}</td>
                            <td className="px-3 py-2 text-right">{row.streams.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{streamingMoney(row.streamingRevenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Period & city breakdown</h3>
                  {rows.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {rows.length.toLocaleString()} city-period rows
                    </span>
                  )}
                </div>

                {rows.length === 0 ? (
                  <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No sales or streaming history has been recorded for this selection yet.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full min-w-[940px] text-sm">
                        <thead className="bg-muted/50 text-left">
                          <tr>
                            <th className="px-3 py-2 font-medium">Period</th>
                            <th className="px-3 py-2 font-medium">City</th>
                            <th className="px-3 py-2 font-medium">Country</th>
                            <th className="px-3 py-2 text-right font-medium">Units</th>
                            <th className="px-3 py-2 text-right font-medium">Gross sales</th>
                            <th className="px-3 py-2 text-right font-medium">Net sales</th>
                            <th className="px-3 py-2 text-right font-medium">Streams</th>
                            <th className="px-3 py-2 text-right font-medium">Streaming revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row, index) => (
                            <tr
                              key={`${row.period_start}-${row.city_id || row.country}-${index}`}
                              className="border-t"
                            >
                              <td className="whitespace-nowrap px-3 py-2">{periodLabel(row.period_start, periodKind)}</td>
                              <td className="px-3 py-2 font-medium">
                                {row.city_id ? row.city_name : "Unknown city"}
                              </td>
                              <td className="px-3 py-2">{row.country}</td>
                              <td className="px-3 py-2 text-right">{Number(row.units).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right">{money(Number(row.sales_gross_cents))}</td>
                              <td className="px-3 py-2 text-right">{money(Number(row.sales_net_cents))}</td>
                              <td className="px-3 py-2 text-right">{Number(row.streams).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right">{streamingMoney(Number(row.streaming_revenue))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">
                          Page {page + 1} of {totalPages}
                        </span>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((current) => Math.max(0, current - 1))}
                            disabled={page === 0}
                          >
                            <ChevronLeft className="mr-1 h-4 w-4" />
                            Previous
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                            disabled={page >= totalPages - 1}
                          >
                            Next
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recorded-release financial breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            ["Gross sales", finance.gross_cents],
            ["Sales tax", -finance.tax_cents],
            ["Distributor fees", -finance.dist_cents],
            ["Manufacturer revenue share", -finance.manufacturer_cents],
            ["Net revenue before label", finance.net_before_label_cents],
            ["Label share", -finance.label_cents],
            ["Band revenue received", finance.band_revenue_cents],
          ].map(([label, value]) => (
            <div className="flex justify-between" key={label as string}>
              <span>{label}</span>
              <strong>{money(value as number)}</strong>
            </div>
          ))}
          <hr />
          {[
            ["Economic release costs", finance.economic_cost_cents],
            ["Paid by band", finance.band_cost_cents],
            ["Paid by label", finance.label_cost_cents],
            ["Band profit / loss", profit],
          ].map(([label, value]) => (
            <div className="flex justify-between" key={label as string}>
              <span>{label}</span>
              <strong>{money(value as number)}</strong>
            </div>
          ))}
          {finance.unknown_cost_cents > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Some legacy costs ({money(finance.unknown_cost_cents)}) could not be attributed to band or label. They are excluded from band profit.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex gap-2">
            <Radio className="h-5 w-5" />
            Streaming accounting (lifetime)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(streaming?.streams || 0).toLocaleString()} streams · {streamingMoney(streaming?.revenue || 0)} revenue
        </CardContent>
      </Card>
    </div>
  );
}
