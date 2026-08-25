import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, DollarSign, TrendingUp, Globe, BarChart3, Package, Radio } from "lucide-react";
import { minorToMajor, releaseProfitMajor } from "@/lib/releaseMoney";
import { ReleaseCityPeriodAnalytics } from "./ReleaseCityPeriodAnalytics";

interface ReleaseAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  release: any;
}

export function ReleaseAnalyticsDialog({ open, onOpenChange, release }: ReleaseAnalyticsDialogProps) {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: streamingData, isLoading: loadingStreaming } = useQuery({
    queryKey: ["release-streaming-analytics", release?.id],
    queryFn: async () => {
      if (!release?.release_songs?.length) return null;
      const songIds = release.release_songs.map((rs: any) => rs.song_id);
      const { data, error } = await supabase
        .from("song_releases")
        .select("*, streaming_platforms(platform_name, platform_icon_url, base_payout_per_stream)")
        .in("song_id", songIds);
      if (error) throw error;

      const platformStats: Record<string, { name: string; streams: number; revenue: number }> = {};
      (data || []).forEach((sr: any) => {
        const name = sr.streaming_platforms?.platform_name || sr.platform_id || "Unknown";
        platformStats[name] ??= { name, streams: 0, revenue: 0 };
        platformStats[name].streams += Number(sr.total_streams || 0);
        platformStats[name].revenue += Number(sr.total_revenue || 0);
      });
      const platforms = Object.values(platformStats).sort((a, b) => b.streams - a.streams);
      return {
        platforms,
        totalStreams: platforms.reduce((sum, p) => sum + p.streams, 0),
        totalRevenue: platforms.reduce((sum, p) => sum + p.revenue, 0),
      };
    },
    enabled: open && !!release?.id,
  });

  const { data: salesData, isLoading: loadingSales, error: salesError } = useQuery({
    queryKey: ["release-sales-analytics", release?.id],
    queryFn: async () => {
      if (!release?.id) return null;
      const { data, error } = await (supabase as any).rpc("get_release_sales_breakdown", {
        p_release_id: release.id,
        p_sale_date: null,
      });
      if (error) throw error;
      const formats = (data || []).map((row: any) => ({
        format: row.format_type || "unknown",
        units: Number(row.units || 0),
        gross: minorToMajor(Number(row.gross_cents || 0)),
        tax: minorToMajor(Number(row.tax_cents || 0)),
        dist: minorToMajor(Number(row.dist_cents || 0)),
        manufacturer: minorToMajor(Number(row.manufacturer_cents || 0)),
        net: minorToMajor(Number(row.net_cents || 0)),
      })).filter((row: any) => row.units > 0);
      return {
        formats,
        totalUnits: formats.reduce((sum: number, row: any) => sum + row.units, 0),
        totalRevenue: formats.reduce((sum: number, row: any) => sum + row.gross, 0),
        totalNet: formats.reduce((sum: number, row: any) => sum + row.net, 0),
        totalTax: formats.reduce((sum: number, row: any) => sum + row.tax, 0),
        totalDist: formats.reduce((sum: number, row: any) => sum + row.dist, 0),
        totalManufacturer: formats.reduce((sum: number, row: any) => sum + row.manufacturer, 0),
      };
    },
    enabled: open && !!release?.id,
  });

  const { data: labelInfo } = useQuery({
    queryKey: ["release-label-cut", release?.id],
    queryFn: async () => {
      if (!release?.label_contract_id) return { labelCutPct: 0 };
      const { data: contract } = await supabase
        .from("artist_label_contracts")
        .select("royalty_label_pct, royalty_artist_pct, deal_type_id, end_date")
        .eq("id", release.label_contract_id)
        .maybeSingle();
      if (!contract) return { labelCutPct: 0 };
      let dealName = "Standard Deal";
      if (contract.deal_type_id) {
        const { data: deal } = await supabase.from("label_deal_types").select("name").eq("id", contract.deal_type_id).maybeSingle();
        if (deal?.name) dealName = deal.name;
      }
      const basePct = release.label_revenue_share_pct ?? contract.royalty_label_pct ?? (100 - (contract.royalty_artist_pct ?? 15));
      let cut = basePct / 100;
      if (dealName === "Distribution Deal") cut = Math.min(cut, 0.2);
      if (dealName === "Licensing Deal" && new Date(contract.end_date) < new Date()) cut = 0;
      return { labelCutPct: cut };
    },
    enabled: open && !!release?.id,
  });

  const { data: chartData, isLoading: loadingCharts } = useQuery({
    queryKey: ["release-chart-analytics", release?.id],
    queryFn: async () => {
      if (!release?.release_songs?.length) return null;
      const songIds = release.release_songs.map((rs: any) => rs.song_id);
      const { data, error } = await supabase.from("chart_entries").select("*").in("song_id", songIds).order("rank", { ascending: true }).limit(50);
      if (error) throw error;
      const best: Record<string, { country: string; rank: number; chartType: string }> = {};
      (data || []).forEach((entry: any) => {
        const country = entry.country || "Global";
        if (!best[country] || entry.rank < best[country].rank) best[country] = { country, rank: entry.rank, chartType: entry.chart_type };
      });
      return { chartPositions: Object.values(best).sort((a, b) => a.rank - b.rank), totalEntries: data?.length || 0 };
    },
    enabled: open && !!release?.id,
  });

  if (!release) return null;

  const totalStreams = streamingData?.totalStreams || release.total_streams || 0;
  const streamingRevenue = streamingData?.totalRevenue || 0;
  const salesRevenue = salesData?.totalRevenue || 0;
  const totalRevenue = streamingRevenue + salesRevenue;
  const labelCutPct = labelInfo?.labelCutPct || 0;
  const labelShare = (salesData?.totalNet || 0) * labelCutPct;
  const bandNet = (salesData?.totalNet || 0) - labelShare;
  const releaseCost = minorToMajor(release.total_cost || 0);
  const profit = releaseProfitMajor(bandNet, release.total_cost || 0);
  const isLoading = loadingStreaming || loadingSales || loadingCharts;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Analytics: {release.title}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="streaming">Streaming</TabsTrigger>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="cities">Cities & Time</TabsTrigger>
            <TabsTrigger value="charts">Charts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Metric icon={Play} label="Total Streams" value={totalStreams.toLocaleString()} />
              <Metric icon={DollarSign} label="Total Revenue" value={`$${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              <Metric icon={Package} label="Units Sold" value={(salesData?.totalUnits || release.units_sold || 0).toLocaleString()} />
              <Metric icon={TrendingUp} label="Chart Entries" value={(chartData?.totalEntries || 0).toLocaleString()} />
            </div>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Revenue Breakdown</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Streaming Revenue</span><strong>${streamingRevenue.toLocaleString()}</strong></div>
              <div className="flex justify-between"><span>Physical/Digital Sales</span><strong>${salesRevenue.toLocaleString()}</strong></div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="financials" className="space-y-4 mt-4">
            {salesError ? <div className="py-8 text-center text-muted-foreground">Release financial breakdown is temporarily unavailable.</div> : <Card><CardHeader><CardTitle className="text-sm">Profit & Loss Statement</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              <FinanceLine label="Gross Revenue" value={salesData?.totalRevenue || 0} />
              <FinanceLine label="Sales Tax Paid" value={-(salesData?.totalTax || 0)} />
              <FinanceLine label="Distribution Fees" value={-(salesData?.totalDist || 0)} />
              <FinanceLine label="Manufacturer Revenue Share" value={-(salesData?.totalManufacturer || 0)} />
              <FinanceLine label="Net Revenue" value={salesData?.totalNet || 0} strong />
              {labelCutPct > 0 && <FinanceLine label={`Label Share (${Math.round(labelCutPct * 100)}%)`} value={-labelShare} />}
              <FinanceLine label="Band Net Revenue" value={bandNet} strong />
              <FinanceLine label="Total Release Cost" value={-releaseCost} />
              <FinanceLine label={profit >= 0 ? "Band Profit" : "Band Loss"} value={profit} strong />
            </CardContent></Card>}
          </TabsContent>

          <TabsContent value="streaming" className="space-y-4 mt-4">
            {isLoading ? <Loading label="streaming data" /> : streamingData?.platforms?.length ? <>
              <div className="grid grid-cols-2 gap-4"><Metric icon={Play} label="Total Streams" value={streamingData.totalStreams.toLocaleString()} /><Metric icon={DollarSign} label="Streaming Revenue" value={`$${streamingData.totalRevenue.toLocaleString()}`} /></div>
              <Card><CardHeader><CardTitle className="text-sm">By Platform</CardTitle></CardHeader><CardContent className="space-y-2">{streamingData.platforms.map((platform) => <div key={platform.name} className="flex justify-between p-2 bg-muted/30 rounded text-sm"><span>{platform.name}</span><span>{platform.streams.toLocaleString()} streams · ${platform.revenue.toLocaleString()}</span></div>)}</CardContent></Card>
            </> : <Empty icon={Radio} label="No streaming data available yet" />}
          </TabsContent>

          <TabsContent value="sales" className="space-y-4 mt-4">
            {isLoading ? <Loading label="sales data" /> : salesData?.formats?.length ? <>
              <div className="grid grid-cols-2 gap-4"><Metric icon={Package} label="Units Sold" value={salesData.totalUnits.toLocaleString()} /><Metric icon={DollarSign} label="Sales Revenue" value={`$${salesData.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} /></div>
              <Card><CardHeader><CardTitle className="text-sm">By Format</CardTitle></CardHeader><CardContent className="space-y-2">{salesData.formats.map((fmt: any) => <div key={fmt.format} className="p-2 bg-muted/30 rounded"><div className="flex justify-between text-sm"><strong className="capitalize">{fmt.format}</strong><span>{fmt.units.toLocaleString()} units</span></div><div className="text-xs text-muted-foreground mt-1">Gross ${fmt.gross.toLocaleString(undefined, { maximumFractionDigits: 0 })} · Net ${fmt.net.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>)}</CardContent></Card>
            </> : <Empty icon={Package} label="No sales data available yet" />}
          </TabsContent>

          <TabsContent value="cities" className="space-y-4 mt-4">
            <ReleaseCityPeriodAnalytics release={release} />
          </TabsContent>

          <TabsContent value="charts" className="space-y-4 mt-4">
            {isLoading ? <Loading label="chart data" /> : chartData?.chartPositions?.length ? <Card><CardHeader><CardTitle className="text-sm">Chart Positions by Country</CardTitle></CardHeader><CardContent className="space-y-2">{chartData.chartPositions.map((pos) => <div key={`${pos.country}-${pos.chartType}`} className="flex justify-between p-2 bg-muted/30 rounded"><span className="flex items-center gap-2"><Globe className="h-4 w-4" />{pos.country}</span><Badge variant={pos.rank <= 10 ? "default" : "secondary"}>#{pos.rank}</Badge></div>)}</CardContent></Card> : <Empty icon={TrendingUp} label="Not charting yet" />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-sm mb-1"><Icon className="h-4 w-4" />{label}</div><p className="text-2xl font-bold">{value}</p></CardContent></Card>;
}

function FinanceLine({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return <div className={`flex justify-between ${strong ? "font-bold border-t border-border pt-2" : ""}`}><span>{label}</span><span>{value < 0 ? "-" : ""}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>;
}

function Loading({ label }: { label: string }) {
  return <div className="py-8 text-center text-muted-foreground">Loading {label}...</div>;
}

function Empty({ icon: Icon, label }: { icon: any; label: string }) {
  return <div className="py-8 text-center text-muted-foreground"><Icon className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>{label}</p></div>;
}
