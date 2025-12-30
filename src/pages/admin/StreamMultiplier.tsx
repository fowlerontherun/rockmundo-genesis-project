import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminRoute } from "@/components/AdminRoute";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { TrendingUp, Users, Play, AlertCircle, CheckCircle } from "lucide-react";

const StreamMultiplier = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isApplying, setIsApplying] = useState(false);

  // Fetch active band count
  const { data: bandStats, isLoading: loadingBands } = useQuery({
    queryKey: ["admin-band-stats"],
    queryFn: async () => {
      const { count: activeBands } = await supabase
        .from("bands")
        .select("*", { count: "exact", head: true });

      return { activeBands: activeBands || 0 };
    },
  });

  // Calculate multiplier based on band count
  const getMultiplier = (bandCount: number) => {
    if (bandCount < 25) return { multiplier: 4.0, tier: "Extremely Low" };
    if (bandCount < 50) return { multiplier: 3.0, tier: "Very Low" };
    if (bandCount < 100) return { multiplier: 2.5, tier: "Low" };
    if (bandCount < 200) return { multiplier: 2.0, tier: "Medium-Low" };
    if (bandCount < 500) return { multiplier: 1.5, tier: "Medium" };
    if (bandCount < 1000) return { multiplier: 1.25, tier: "Medium-High" };
    return { multiplier: 1.0, tier: "High" };
  };

  const multiplierInfo = bandStats ? getMultiplier(bandStats.activeBands) : null;

  // Mutation to apply stream multiplier
  const applyMultiplierMutation = useMutation({
    mutationFn: async () => {
      if (!multiplierInfo || multiplierInfo.multiplier === 1.0) {
        throw new Error("No multiplier needed - band count is sufficient");
      }

      // Get all active streaming releases
      const { data: releases, error: fetchError } = await supabase
        .from("song_releases")
        .select("id, total_streams")
        .eq("is_active", true)
        .eq("release_type", "streaming")
        .gt("total_streams", 0);

      if (fetchError) throw fetchError;

      if (!releases || releases.length === 0) {
        throw new Error("No active streaming releases found");
      }

      // Update each release with multiplied streams
      let updatedCount = 0;
      for (const release of releases) {
        const newStreams = Math.floor(release.total_streams * multiplierInfo.multiplier);
        const { error: updateError } = await supabase
          .from("song_releases")
          .update({ total_streams: newStreams })
          .eq("id", release.id);

        if (!updateError) updatedCount++;
      }

      return { updatedCount, multiplier: multiplierInfo.multiplier };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["streaming-releases"] });
      queryClient.invalidateQueries({ queryKey: ["song-releases"] });
      toast({
        title: "Stream Multiplier Applied",
        description: `Updated ${data.updatedCount} releases with ${data.multiplier}x multiplier`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleApplyMultiplier = async () => {
    setIsApplying(true);
    try {
      await applyMultiplierMutation.mutateAsync();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <AdminRoute>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Stream Multiplier</h1>
            <p className="text-muted-foreground">
              Boost streams based on active game band count
            </p>
          </div>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This tool multiplies all active streaming release counts to compensate for low player activity. 
            Use sparingly - multipliers stack if applied multiple times!
          </AlertDescription>
        </Alert>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Band Stats Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Current Band Population
              </CardTitle>
              <CardDescription>
                Active bands in the game determine the stream multiplier
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBands ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <p className="text-5xl font-bold text-primary">
                      {bandStats?.activeBands ?? 0}
                    </p>
                    <p className="text-muted-foreground">Active Bands</p>
                  </div>
                  {multiplierInfo && (
                    <div className="flex justify-center">
                      <Badge 
                        variant={multiplierInfo.multiplier > 1 ? "destructive" : "default"}
                        className="text-lg px-4 py-2"
                      >
                        {multiplierInfo.tier} Activity
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Multiplier Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Recommended Multiplier
              </CardTitle>
              <CardDescription>
                Based on current band count
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingBands ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <p className="text-5xl font-bold text-primary">
                      {multiplierInfo?.multiplier ?? 1}x
                    </p>
                    <p className="text-muted-foreground">Stream Multiplier</p>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleApplyMultiplier}
                    disabled={isApplying || !multiplierInfo || multiplierInfo.multiplier === 1.0}
                  >
                    {isApplying ? (
                      <>Applying...</>
                    ) : multiplierInfo?.multiplier === 1.0 ? (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        No Boost Needed
                      </>
                    ) : (
                      <>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Apply {multiplierInfo?.multiplier}x Multiplier
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Multiplier Tiers */}
        <Card>
          <CardHeader>
            <CardTitle>Multiplier Tiers</CardTitle>
            <CardDescription>
              How band count affects the stream multiplier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
              {[
                { bands: "< 25", mult: "4.0x", tier: "Extremely Low" },
                { bands: "25-49", mult: "3.0x", tier: "Very Low" },
                { bands: "50-99", mult: "2.5x", tier: "Low" },
                { bands: "100-199", mult: "2.0x", tier: "Medium-Low" },
                { bands: "200-499", mult: "1.5x", tier: "Medium" },
                { bands: "500-999", mult: "1.25x", tier: "Medium-High" },
                { bands: "1000+", mult: "1.0x", tier: "High (No boost)" },
              ].map((tier) => (
                <div
                  key={tier.tier}
                  className={`p-3 rounded-lg border ${
                    multiplierInfo?.tier === tier.tier
                      ? "border-primary bg-primary/10"
                      : "border-border"
                  }`}
                >
                  <p className="font-bold text-lg">{tier.mult}</p>
                  <p className="text-sm text-muted-foreground">{tier.bands} bands</p>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {tier.tier}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminRoute>
  );
};

export default StreamMultiplier;
