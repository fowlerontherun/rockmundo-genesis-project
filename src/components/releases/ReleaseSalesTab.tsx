import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Package, Music, Radio } from "lucide-react";

interface ReleaseSalesTabProps {
  userId: string;
}

export function ReleaseSalesTab({ userId }: ReleaseSalesTabProps) {
  // Fetch physical/digital sales
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["release-sales", userId],
    queryFn: async () => {
      // Get user's band IDs
      const { data: bandMembers } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);
      const bandIds = bandMembers?.map(bm => bm.band_id) || [];

      // Get releases
      const releaseQuery = supabase
        .from("releases")
        .select("id");
      
      if (bandIds.length > 0) {
        releaseQuery.or(`user_id.eq.${userId},band_id.in.(${bandIds.join(",")})`);
      } else {
        releaseQuery.eq("user_id", userId);
      }

      const { data: releases } = await releaseQuery;
      const releaseIds = releases?.map(r => r.id) || [];

      if (releaseIds.length === 0) return { sales: [], totalRevenue: 0, totalUnits: 0 };

      // Get sales
      const { data: sales } = await supabase
        .from("release_sales")
        .select(`
          *,
          release_format:release_formats(
            format_type,
            release:releases(title, artist_name)
          )
        `)
        .in("release_format_id", 
          await supabase.from("release_formats")
            .select("id")
            .in("release_id", releaseIds)
            .then(res => res.data?.map(rf => rf.id) || [])
        )
        .order("sale_date", { ascending: false });

      const totalRevenue = sales?.reduce((sum, sale) => sum + (sale.total_amount || 0) / 100, 0) || 0;
      const totalUnits = sales?.reduce((sum, sale) => sum + sale.quantity_sold, 0) || 0;

      return { sales: sales || [], totalRevenue, totalUnits };
    }
  });

  // Fetch streaming revenue
  const { data: streamingData, isLoading: streamingLoading } = useQuery({
    queryKey: ["streaming-revenue", userId],
    queryFn: async () => {
      // Get user's band IDs
      const { data: bandMembers } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);
      const bandIds = bandMembers?.map(bm => bm.band_id) || [];

      // Get streaming releases
      let query = supabase
        .from("song_releases")
        .select(`
          id,
          total_streams,
          total_revenue,
          songs!inner(title, band_id),
          streaming_platforms(platform_name)
        `)
        .eq("is_active", true)
        .eq("release_type", "streaming");

      if (bandIds.length > 0) {
        query = query.or(`user_id.eq.${userId},band_id.in.(${bandIds.join(",")})`);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data: releases } = await query;

      const totalStreams = releases?.reduce((sum, r) => sum + (r.total_streams || 0), 0) || 0;
      const totalRevenue = releases?.reduce((sum, r) => sum + (r.total_revenue || 0), 0) || 0;

      return { releases: releases || [], totalStreams, totalRevenue };
    }
  });

  const isLoading = salesLoading || streamingLoading;
  const { sales = [], totalRevenue: physicalRevenue = 0, totalUnits = 0 } = salesData || {};
  const { releases: streamingReleases = [], totalStreams = 0, totalRevenue: streamingRevenue = 0 } = streamingData || {};
  
  const combinedRevenue = physicalRevenue + streamingRevenue;

  if (isLoading) {
    return <div>Loading revenue data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Combined Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold">${combinedRevenue.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Streaming Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold">${streamingRevenue.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Streams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Music className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{totalStreams.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Units Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{totalUnits}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="streaming" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="streaming">Streaming</TabsTrigger>
          <TabsTrigger value="physical">Physical & Digital Sales</TabsTrigger>
        </TabsList>

        <TabsContent value="streaming" className="mt-4">
          {streamingReleases.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Radio className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Streaming Revenue Yet</h3>
                <p className="text-muted-foreground">
                  Release songs to streaming platforms to start earning.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Streaming Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {streamingReleases.map((release: any) => (
                    <div key={release.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <div className="font-medium">{release.songs?.title || "Unknown Song"}</div>
                        <div className="text-sm text-muted-foreground">
                          {release.streaming_platforms?.platform_name || "Platform"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-500">${(release.total_revenue || 0).toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">{(release.total_streams || 0).toLocaleString()} streams</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="physical" className="mt-4">
          {sales.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Sales Yet</h3>
                <p className="text-muted-foreground">
                  Sales data will appear here once your releases start selling.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Recent Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sales.map((sale: any) => (
                    <div key={sale.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <div className="font-medium">{sale.release_format?.release?.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {sale.release_format?.format_type} • {new Date(sale.sale_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">${((sale.total_amount || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className="text-sm text-muted-foreground">{sale.quantity_sold} units</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}