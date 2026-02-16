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
  Play, DollarSign, TrendingUp, Globe, Music, 
  BarChart3, Package, Radio 
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

  // Fetch sales data
  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ["release-sales-analytics", release?.id],
    queryFn: async () => {
      if (!release?.id) return null;
      
      // Get release format IDs for this release
      const formatIds = release.release_formats?.map((f: any) => f.id) || [];
      if (formatIds.length === 0) return null;
      
      const { data, error } = await supabase
        .from("release_sales")
        .select("*, release_formats!inner(format_type)")
        .in("release_format_id", formatIds)
        .order("sale_date", { ascending: false })
        .limit(100);
      
      if (error) {
        console.error("Error fetching sales data:", error);
        return null;
      }

      // Aggregate by format type
      const formatStats: Record<string, { 
        format: string; 
        units: number; 
        revenue: number;
      }> = {};

      data?.forEach((sale: any) => {
        const format = sale.release_formats?.format_type || sale.platform || "unknown";
        if (!formatStats[format]) {
          formatStats[format] = { format, units: 0, revenue: 0 };
        }
        formatStats[format].units += sale.quantity_sold || 0;
        formatStats[format].revenue += (sale.total_amount || 0) / 100;
      });

      const totalUnits = Object.values(formatStats).reduce((sum, f) => sum + f.units, 0);
      const totalRevenue = Object.values(formatStats).reduce((sum, f) => sum + f.revenue, 0);

      return {
        formats: Object.values(formatStats).sort((a, b) => b.revenue - a.revenue),
        totalUnits,
        totalRevenue,
        recentSales: data?.slice(0, 10) || [],
      };
    },
    enabled: open && !!release?.id,
  });

  // Fetch financial summary from release_sales
  const { data: financialData, isLoading: loadingFinancials } = useQuery({
    queryKey: ["release-financials", release?.id],
    queryFn: async () => {
      if (!release?.id) return null;
      const formatIds = release.release_formats?.map((f: any) => f.id) || [];
      if (formatIds.length === 0) return null;

      const { data, error } = await supabase
        .from("release_sales")
        .select("total_amount, sales_tax_amount, distribution_fee, net_revenue, release_format_id, release_formats!inner(format_type)")
        .in("release_format_id", formatIds);

      if (error) return null;

      let grossRevenue = 0, taxPaid = 0, distributionFees = 0, netRevenue = 0;
      data?.forEach((s: any) => {
        grossRevenue += (s.total_amount || 0) / 100;
        taxPaid += (s.sales_tax_amount || 0) / 100;
        distributionFees += (s.distribution_fee || 0) / 100;
        netRevenue += (s.net_revenue || 0) / 100;
      });

      return { grossRevenue, taxPaid, distributionFees, netRevenue };
    },
    enabled: open && !!release?.id,
  });

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
              const profit = net - mfgCost;
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
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Manufacturing Cost</span>
                        <span className="font-medium text-orange-500">-${mfgCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-border pt-2 font-bold">
                        <span>{profit >= 0 ? 'Profit' : 'Loss'}</span>
                        <span className={profit >= 0 ? 'text-green-600' : 'text-destructive'}>
                          ${profit.toLocaleString()}
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
                    <CardTitle className="text-sm">By Format</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {salesData.formats.map((fmt, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                          <span className="font-medium capitalize">{fmt.format}</span>
                          <div className="flex gap-4 text-sm">
                            <span>{fmt.units.toLocaleString()} units</span>
                            <span className="text-green-600">${fmt.revenue.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
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
