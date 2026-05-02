import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { 
  Play, DollarSign, TrendingUp, Globe, Music, 
  BarChart3, Package, Radio, CalendarDays
} from "lucide-react";
import { format } from "date-fns";

interface ReleaseAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release: any;
}

export function ReleaseAnalyticsDialog({ 
  open, 
  onOpenChange, 
  release 
}: ReleaseAnalyticsDialogProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const [salesDayFilter, setSalesDayFilter] = useState<string>("all");
  const [salesFormatFilter, setSalesFormatFilter] = useState<string>("all");
  const [topMetric, setTopMetric] = useState<"gross" | "units">("gross");

  // Fetch streaming data for this release's songs
  const { data: streamingData, isLoading: loadingStreaming } = useQuery({
    queryKey: ["release-streaming-analytics", release?.id],
    queryFn: async () => {
      if (!release?.release_songs?.length) return null;
      
      const songIds = release.release_songs.map((rs: any) => rs.song_id);
      
      const { data, error } = await supabase
        .from("song_releases")
        .select(`
          *,
          streaming_platforms(platform_name, platform_icon_url, base_payout_per_stream)
        `)
        .in("song_id", songIds);
      
      if (error) {
        console.error("Error fetching streaming data:", error);
        return null;
      }

      // Aggregate by platform
      const platformStats: Record<string, { 
        name: string; 
        streams: number; 
        revenue: number;
        icon_url?: string;
      }> = {};

      data?.forEach((sr: any) => {
        const platformName = sr.streaming_platforms?.platform_name || sr.platform_id;
        if (!platformStats[platformName]) {
          platformStats[platformName] = {
            name: platformName,
            streams: 0,
            revenue: 0,
            icon_url: sr.streaming_platforms?.platform_icon_url,
          };
        }
        platformStats[platformName].streams += sr.total_streams || 0;
        platformStats[platformName].revenue += sr.total_revenue || 0;
      });

      const totalStreams = Object.values(platformStats).reduce((sum, p) => sum + p.streams, 0);
      const totalRevenue = Object.values(platformStats).reduce((sum, p) => sum + p.revenue, 0);

      return {
        platforms: Object.values(platformStats).sort((a, b) => b.streams - a.streams),
        totalStreams,
        totalRevenue,
        songCount: songIds.length,
      };
    },
    enabled: open && !!release?.id,
  });

  // Available sale dates (for daily filter)
  const { data: saleDates } = useQuery({
    queryKey: ["release-sale-dates", release?.id],
    queryFn: async () => {
      if (!release?.id) return [] as { sale_day: string; row_count: number }[];
      const { data, error } = await (supabase as any).rpc("get_release_sale_dates", {
        p_release_id: release.id,
      });
      if (error) {
        console.error("get_release_sale_dates error", error);
        return [];
      }
      return (data || []) as { sale_day: string; row_count: number }[];
    },
    enabled: open && !!release?.id,
  });

  // Fetch sales data via server-side aggregation (bypasses 1000-row PostgREST cap)
  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ["release-sales-analytics", release?.id, salesDayFilter],
    queryFn: async () => {
      if (!release?.id) return null;

      const formatIds = release.release_formats?.map((f: any) => f.id) || [];

      type FormatRow = {
        format: string;
        units: number;
        gross: number;
        tax: number;
        dist: number;
        net: number;
      };

      const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        "get_release_sales_breakdown",
        {
          p_release_id: release.id,
          p_sale_date: salesDayFilter === "all" ? null : salesDayFilter,
        },
      );

      if (rpcError) {
        console.error("get_release_sales_breakdown error", rpcError);
      }

      const formatStatsMap: Record<string, FormatRow> = {};
      (rpcData || []).forEach((row: any) => {
        const ft = row.format_type || "unknown";
        formatStatsMap[ft] = {
          format: ft,
          units: Number(row.units) || 0,
          gross: (Number(row.gross_cents) || 0) / 100,
          tax: (Number(row.tax_cents) || 0) / 100,
          dist: (Number(row.dist_cents) || 0) / 100,
          net: (Number(row.net_cents) || 0) / 100,
        };
      });

      // Fallback: synthesize from release-level columns if RPC empty AND no day filter
      if (salesDayFilter === "all") {
        const formatTypes = ["digital", "cd", "vinyl", "cassette"] as const;
        for (const ft of formatTypes) {
          const colUnits = release[`${ft}_sales`] || 0;
          if (!formatStatsMap[ft] && colUnits > 0) {
            const fmt = release.release_formats?.find((f: any) => f.format_type === ft);
            const pricePerUnit = fmt?.retail_price ? fmt.retail_price / 100 : 0;
            const gross = Math.round(colUnits * pricePerUnit * 100) / 100;
            const distRate = ft === "digital" ? 0.30 : ft === "cd" ? 0.20 : 0.15;
            const tax = Math.round(gross * 0.10 * 100) / 100;
            const dist = Math.round(gross * distRate * 100) / 100;
            formatStatsMap[ft] = {
              format: ft,
              units: colUnits,
              gross,
              tax,
              dist,
              net: gross - tax - dist,
            };
          }
        }
      }

      const formatStats = Object.values(formatStatsMap)
        .filter((v) => v.units > 0)
        .sort((a, b) => b.gross - a.gross);

      const totalUnits = formatStats.reduce((s, f) => s + f.units, 0);
      const totalRevenue = formatStats.reduce((s, f) => s + f.gross, 0);

      // Recent sales — apply day filter when chosen
      let recentQuery = supabase
        .from("release_sales")
        .select("*, release_formats!inner(format_type)")
        .in("release_format_id", formatIds)
        .order("sale_date", { ascending: false })
        .limit(10);

      if (salesDayFilter !== "all") {
        const dayStart = `${salesDayFilter}T00:00:00.000Z`;
        const dayEnd = `${salesDayFilter}T23:59:59.999Z`;
        recentQuery = recentQuery.gte("sale_date", dayStart).lte("sale_date", dayEnd);
      }

      const { data: recentSales } = await recentQuery;

      return {
        formats: formatStats,
        totalUnits,
        totalRevenue,
        recentSales: recentSales || [],
      };
    },
    enabled: open && !!release?.id,
  });


  // Top releases for the same band (drives the "what's selling" chart)
  const { data: topReleases } = useQuery({
    queryKey: ["top-releases-by-sales", release?.band_id, salesDayFilter, salesFormatFilter],
    queryFn: async () => {
      if (!release?.band_id) return [] as Array<{ release_id: string; title: string; units: number; gross: number; net: number; is_current: boolean }>;
      const { data, error } = await (supabase as any).rpc("get_top_releases_by_sales", {
        p_band_id: release.band_id,
        p_sale_date: salesDayFilter === "all" ? null : salesDayFilter,
        p_format_type: salesFormatFilter === "all" ? null : salesFormatFilter,
        p_limit: 10,
      });
      if (error) {
        console.error("get_top_releases_by_sales error", error);
        return [];
      }
      return (data || []).map((row: any) => ({
        release_id: row.release_id as string,
        title: row.title as string,
        units: Number(row.units) || 0,
        gross: (Number(row.gross_cents) || 0) / 100,
        net: (Number(row.net_cents) || 0) / 100,
        is_current: row.release_id === release.id,
      }));
    },
    enabled: open && !!release?.band_id,
  });

  // Resolve label cut % for this release (matches edge function logic)
  const { data: labelInfo } = useQuery({
    queryKey: ["release-label-cut", release?.id],
    queryFn: async () => {
      if (!release?.label_contract_id) return { labelCutPct: 0, dealTypeName: null as string | null };
      const { data: contract } = await supabase
        .from("artist_label_contracts")
        .select("royalty_label_pct, royalty_artist_pct, deal_type_id, end_date")
        .eq("id", release.label_contract_id)
        .maybeSingle();
      if (!contract) return { labelCutPct: 0, dealTypeName: null };

      let dealTypeName: string | null = "Standard Deal";
      if (contract.deal_type_id) {
        const { data: dt } = await supabase
          .from("label_deal_types")
          .select("name")
          .eq("id", contract.deal_type_id)
          .maybeSingle();
        if (dt?.name) dealTypeName = dt.name;
      }

      const overridePct = release.label_revenue_share_pct;
      const basePct = overridePct ?? contract.royalty_label_pct ?? (100 - (contract.royalty_artist_pct ?? 15));
      let cut = basePct / 100;
      if (dealTypeName === "Distribution Deal") cut = Math.min(cut, 0.20);
      if (dealTypeName === "Licensing Deal" && new Date(contract.end_date) < new Date()) cut = 0;
      return { labelCutPct: cut, dealTypeName };
    },
    enabled: open && !!release?.id,
  });

  // Financial summary computed from per-format breakdown (source of truth: release_sales)
  const financialData = (() => {
    if (!salesData) return null;
    const grossRevenue = salesData.formats.reduce((s, f) => s + f.gross, 0);
    const taxPaid = salesData.formats.reduce((s, f) => s + f.tax, 0);
    const distributionFees = salesData.formats.reduce((s, f) => s + f.dist, 0);
    const netRevenue = salesData.formats.reduce((s, f) => s + f.net, 0);
    const labelCutPct = labelInfo?.labelCutPct || 0;
    const labelShare = Math.round(netRevenue * labelCutPct * 100) / 100;
    const bandNet = netRevenue - labelShare;
    return { grossRevenue, taxPaid, distributionFees, netRevenue, labelShare, bandNet, labelCutPct };
  })();
  const loadingFinancials = loadingSales;

  // Fetch chart positions
  const { data: chartData, isLoading: loadingCharts } = useQuery({
    queryKey: ["release-chart-analytics", release?.id],
    queryFn: async () => {
      if (!release?.release_songs?.length) return null;
      
      const songIds = release.release_songs.map((rs: any) => rs.song_id);
      
      const { data, error } = await supabase
        .from("chart_entries")
        .select("*")
        .in("song_id", songIds)
        .order("rank", { ascending: true })
        .limit(50);
      
      if (error) {
        console.error("Error fetching chart data:", error);
        return null;
      }

      // Get best positions by country
      const countryBest: Record<string, { country: string; rank: number; chartType: string }> = {};
      
      data?.forEach((entry) => {
        const country = entry.country || "Global";
        if (!countryBest[country] || entry.rank < countryBest[country].rank) {
          countryBest[country] = {
            country,
            rank: entry.rank,
            chartType: entry.chart_type,
          };
        }
      });

      return {
        chartPositions: Object.values(countryBest).sort((a, b) => a.rank - b.rank),
        totalEntries: data?.length || 0,
      };
    },
    enabled: open && !!release?.id,
  });

  if (!release) return null;

  const totalStreams = streamingData?.totalStreams || release.total_streams || 0;
  const streamingRevenue = streamingData?.totalRevenue || 0;
  const salesRevenue = salesData?.totalRevenue || 0;
  const totalRevenue = release.total_revenue || (streamingRevenue + salesRevenue);

  const isLoading = loadingStreaming || loadingSales || loadingCharts || loadingFinancials;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Analytics: {release.title}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="streaming">Streaming</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Play className="h-4 w-4" />
                    Total Streams
                  </div>
                  <p className="text-2xl font-bold">{totalStreams.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <DollarSign className="h-4 w-4" />
                    Total Revenue
                  </div>
                  <p className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <Package className="h-4 w-4" />
                    Units Sold
                  </div>
                  <p className="text-2xl font-bold">{(salesData?.totalUnits || release.units_sold || 0).toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <TrendingUp className="h-4 w-4" />
                    Chart Entries
                  </div>
                  <p className="text-2xl font-bold">{chartData?.totalEntries || 0}</p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Radio className="h-4 w-4" /> Streaming Revenue
                    </span>
                    <span className="font-medium">${streamingRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Package className="h-4 w-4" /> Physical/Digital Sales
                    </span>
                    <span className="font-medium">${salesRevenue.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Charts */}
            {chartData?.chartPositions && chartData.chartPositions.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Best Chart Positions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {chartData.chartPositions.slice(0, 5).map((pos, idx) => (
                      <Badge key={idx} variant="outline" className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {pos.country}: #{pos.rank}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="financials" className="space-y-4">
            {(() => {
              const mfgCost = release.total_cost || 0;
              const gross = financialData?.grossRevenue || 0;
              const tax = financialData?.taxPaid || 0;
              const dist = financialData?.distributionFees || 0;
              const net = financialData?.netRevenue || 0;
              const labelShare = financialData?.labelShare || 0;
              const bandNet = financialData?.bandNet || net;
              const labelCutPct = financialData?.labelCutPct || 0;
              const profit = bandNet - mfgCost;
              const totalTracks = release.release_songs?.length || 1;

              return (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Profit & Loss Statement</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Gross Revenue</span>
                        <span className="font-medium text-green-600">${gross.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Sales Tax Paid</span>
                        <span className="font-medium text-orange-500">-${tax.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Distribution Fees</span>
                        <span className="font-medium text-orange-500">-${dist.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-border pt-2">
                        <span className="text-muted-foreground">Net Revenue</span>
                        <span className="font-medium">${net.toLocaleString()}</span>
                      </div>
                      {labelCutPct > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Label Share ({Math.round(labelCutPct * 100)}%)</span>
                          <span className="font-medium text-purple-500">-${labelShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm border-t border-border pt-2">
                        <span className="text-muted-foreground">Band Net Revenue</span>
                        <span className="font-medium">${bandNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Manufacturing Cost</span>
                        <span className="font-medium text-orange-500">-${mfgCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-border pt-2 font-bold">
                        <span>{profit >= 0 ? 'Band Profit' : 'Band Loss'}</span>
                        <span className={profit >= 0 ? 'text-green-600' : 'text-destructive'}>
                          ${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Per-Song Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {release.release_songs?.map((rs: any, idx: number) => {
                          const songRevShare = totalTracks > 0 ? net / totalTracks : 0;
                          const songCostShare = totalTracks > 0 ? mfgCost / totalTracks : 0;
                          const songProfit = songRevShare - songCostShare;
                          return (
                            <div key={idx} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded">
                              <span className="truncate flex-1">{rs.song?.title || `Track ${rs.track_number}`}</span>
                              <div className="flex gap-4 text-xs">
                                <span className="text-muted-foreground">Rev: ${songRevShare.toFixed(0)}</span>
                                <span className="text-muted-foreground">Cost: ${songCostShare.toFixed(0)}</span>
                                <span className={songProfit >= 0 ? 'text-green-600' : 'text-destructive'}>
                                  {songProfit >= 0 ? '+' : ''}${songProfit.toFixed(0)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </>
              );
            })()}
          </TabsContent>

          <TabsContent value="streaming" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading streaming data...</div>
            ) : streamingData?.platforms && streamingData.platforms.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground mb-1">Total Streams</div>
                      <p className="text-2xl font-bold">{streamingData.totalStreams.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground mb-1">Streaming Revenue</div>
                      <p className="text-2xl font-bold text-green-600">${streamingData.totalRevenue.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">By Platform</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {streamingData.platforms.map((platform, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                          <span className="font-medium">{platform.name}</span>
                          <div className="flex gap-4 text-sm">
                            <span>{platform.streams.toLocaleString()} streams</span>
                            <span className="text-green-600">${platform.revenue.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Radio className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No streaming data available yet</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sales" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-3 flex items-center gap-2 flex-wrap">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Day:</span>
                <Select value={salesDayFilter} onValueChange={setSalesDayFilter}>
                  <SelectTrigger className="h-8 w-[170px] text-xs">
                    <SelectValue placeholder="All time" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    {(saleDates || []).map((d) => (
                      <SelectItem key={d.sale_day} value={d.sale_day}>
                        {format(new Date(`${d.sale_day}T00:00:00Z`), "MMM d, yyyy")} ({d.row_count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground ml-2">Type:</span>
                <Select value={salesFormatFilter} onValueChange={setSalesFormatFilter}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue placeholder="All formats" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All formats</SelectItem>
                    <SelectItem value="vinyl">Vinyl</SelectItem>
                    <SelectItem value="cd">CD</SelectItem>
                    <SelectItem value="digital">Digital</SelectItem>
                    <SelectItem value="cassette">Cassette</SelectItem>
                    <SelectItem value="streaming">Streaming</SelectItem>
                  </SelectContent>
                </Select>
                {(salesDayFilter !== "all" || salesFormatFilter !== "all") && (
                  <Badge variant="outline" className="text-[10px]">Filtered</Badge>
                )}
              </CardContent>
            </Card>

            {/* Top Releases by gross/units (band-wide, respects day + type filters) */}
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm">Top Releases — what's driving the numbers</CardTitle>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setTopMetric("gross")}
                    className={`text-[10px] px-2 py-1 rounded border ${topMetric === "gross" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                  >
                    Gross
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopMetric("units")}
                    className={`text-[10px] px-2 py-1 rounded border ${topMetric === "units" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
                  >
                    Units
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {!topReleases || topReleases.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-4 text-center">
                    No sales for this band on the selected filters.
                  </div>
                ) : (
                  (() => {
                    const max = Math.max(...topReleases.map((r) => (topMetric === "gross" ? r.gross : r.units)), 1);
                    return (
                      <div className="space-y-2">
                        {topReleases.map((r, idx) => {
                          const value = topMetric === "gross" ? r.gross : r.units;
                          const pct = (value / max) * 100;
                          const display = topMetric === "gross"
                            ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                            : `${value.toLocaleString()} units`;
                          return (
                            <div key={r.release_id} className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className={`truncate flex-1 ${r.is_current ? "font-semibold text-primary" : ""}`}>
                                  #{idx + 1} {r.title}{r.is_current && " (this release)"}
                                </span>
                                <span className="text-muted-foreground tabular-nums">{display}</span>
                              </div>
                              <div className="h-2 w-full bg-muted rounded overflow-hidden">
                                <div
                                  className={`h-full rounded ${r.is_current ? "bg-primary" : "bg-primary/50"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>


            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading sales data...</div>
            ) : salesData?.formats && salesData.formats.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground mb-1">Units Sold</div>
                      <p className="text-2xl font-bold">{salesData.totalUnits.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-muted-foreground mb-1">Sales Revenue</div>
                      <p className="text-2xl font-bold text-green-600">${salesData.totalRevenue.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">By Format (Gross → Band Net)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {salesData.formats.map((fmt, idx) => {
                        const labelCutPct = labelInfo?.labelCutPct || 0;
                        const labelShare = fmt.net * labelCutPct;
                        const bandNet = fmt.net - labelShare;
                        return (
                          <div key={idx} className="p-2 bg-muted/30 rounded space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-medium capitalize text-sm">{fmt.format}</span>
                              <span className="text-xs text-muted-foreground">{fmt.units.toLocaleString()} units</span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-1 text-[11px]">
                              <span className="text-green-600">Gross ${fmt.gross.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              <span className="text-orange-500">Tax -${fmt.tax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              <span className="text-orange-500">Dist -${fmt.dist.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              {labelCutPct > 0 && (
                                <span className="text-purple-500">Label -${labelShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              )}
                              <span className="font-semibold">Band ${bandNet.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {salesData.recentSales.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Recent Sales</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {salesData.recentSales.map((sale: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              {format(new Date(sale.sale_date), "MMM d, yyyy")}
                            </span>
                            <span className="capitalize">{sale.release_formats?.format_type || sale.platform}</span>
                            <span>{sale.quantity_sold} units</span>
                            <span className="text-green-600">${((sale.total_amount || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No sales data available yet</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="charts" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading chart data...</div>
            ) : chartData?.chartPositions && chartData.chartPositions.length > 0 ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Chart Positions by Country</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {chartData.chartPositions.map((pos, idx) => (
                      <div key={idx} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                        <span className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          {pos.country}
                        </span>
                        <Badge variant={pos.rank <= 10 ? "default" : "secondary"}>
                          #{pos.rank}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Not charting yet</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
