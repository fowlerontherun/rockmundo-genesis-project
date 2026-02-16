import { useState } from "react";
import { AdminRoute } from "@/components/AdminRoute";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Rocket, Search, DollarSign, Music, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export default function ReleasePump() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRelease, setSelectedRelease] = useState<any>(null);
  const [amount, setAmount] = useState(100);
  const [pumping, setPumping] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const { data: releases, isLoading } = useQuery({
    queryKey: ["admin-releases-search", searchTerm],
    queryFn: async () => {
      let query = (supabase as any)
        .from("releases")
        .select(`
          id, title, artist_name, release_status, total_units_sold, total_revenue, digital_sales,
          band_id, bands(name, fame),
          release_formats(id, format_type, retail_price)
        `)
        .eq("release_status", "released")
        .order("created_at", { ascending: false })
        .limit(20);

      if (searchTerm.length >= 2) {
        query = query.ilike("title", `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: true,
  });

  const handlePump = async () => {
    if (!selectedRelease || amount < 1) return;
    setPumping(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("admin-boost-plays", {
        body: { action: "release_pump", releaseId: selectedRelease.id, amount },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLastResult(data);
      toast.success(`Pumped ${amount} digital sales for "${selectedRelease.title}"`);
    } catch (err: any) {
      toast.error(err.message || "Failed to pump sales");
    } finally {
      setPumping(false);
    }
  };

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Rocket className="h-8 w-8 text-primary" />
            Release Pump
          </h1>
          <p className="text-muted-foreground">Boost a release's digital sales with a set amount of buys</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Search & Select */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Find Release
              </CardTitle>
              <CardDescription>Search released titles to pump</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Search by title</Label>
                <Input
                  placeholder="Type release title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {isLoading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : releases?.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No releases found</div>
                ) : (
                  releases?.map((r: any) => {
                    const hasDigital = r.release_formats?.some((f: any) => f.format_type === "digital");
                    return (
                      <div
                        key={r.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedRelease?.id === r.id
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        } ${!hasDigital ? "opacity-50" : ""}`}
                        onClick={() => hasDigital && setSelectedRelease(r)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{r.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.artist_name || r.bands?.name || "Unknown"} · {(r.digital_sales || 0).toLocaleString()} digital sales
                            </p>
                          </div>
                          {!hasDigital ? (
                            <Badge variant="secondary">No Digital</Badge>
                          ) : (
                            <Badge variant="outline">${((r.total_revenue || 0)).toLocaleString()}</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pump Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Pump Controls
              </CardTitle>
              <CardDescription>
                {selectedRelease
                  ? `Selected: ${selectedRelease.title}`
                  : "Select a release first"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedRelease && (
                <>
                  <Card className="bg-muted/30">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-3">
                        <Music className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-bold">{selectedRelease.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedRelease.artist_name || selectedRelease.bands?.name}
                          </p>
                          <div className="flex gap-3 mt-1 text-xs">
                            <span>{(selectedRelease.total_units_sold || 0).toLocaleString()} total units</span>
                            <span>{(selectedRelease.digital_sales || 0).toLocaleString()} digital</span>
                            <span className="text-green-500">${(selectedRelease.total_revenue || 0).toLocaleString()} revenue</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div>
                    <Label>Number of digital buys to add</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100000}
                      value={amount}
                      onChange={(e) => setAmount(Math.max(1, Math.min(100000, parseInt(e.target.value) || 1)))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Max 100,000 per pump. Sales go through standard tax & distribution.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    {[50, 100, 500, 1000, 5000].map((n) => (
                      <Button
                        key={n}
                        variant={amount === n ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAmount(n)}
                      >
                        {n >= 1000 ? `${n / 1000}K` : n}
                      </Button>
                    ))}
                  </div>

                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={handlePump}
                    disabled={pumping}
                  >
                    {pumping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4" />
                    )}
                    Pump {amount.toLocaleString()} Digital Sales
                  </Button>

                  {lastResult && (
                    <Card className="bg-green-500/10 border-green-500/30">
                      <CardContent className="py-4 space-y-2">
                        <p className="font-bold text-green-500 flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Pump Successful!
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Units Added: <strong>{lastResult.added?.toLocaleString()}</strong></div>
                          <div>Gross Revenue: <strong>${lastResult.gross_revenue?.toLocaleString()}</strong></div>
                          <div>Sales Tax: <strong>${lastResult.sales_tax?.toLocaleString()}</strong></div>
                          <div>Distribution: <strong>${lastResult.distribution_fee?.toLocaleString()}</strong></div>
                          <div className="col-span-2 text-green-500 font-bold">
                            Net to Band: ${lastResult.net_revenue?.toLocaleString()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}

              {!selectedRelease && (
                <div className="text-center py-8 text-muted-foreground">
                  <Rocket className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Select a release from the left to start pumping</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminRoute>
  );
}
