import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Camera, Sparkles, DollarSign, Star, Clock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { createScheduledActivity } from "@/hooks/useActivityBooking";
import { ModelingCareerProgress } from "./ModelingCareerProgress";

interface ModelingOffersPanelProps {
  userId: string;
  playerLooks: number;
  playerFame: number;
}

interface ModelingGig {
  id: string;
  title: string;
  description: string | null;
  gig_type: string;
  min_looks_required: number;
  min_fame_required: number;
  compensation_min: number;
  compensation_max: number;
  fame_boost: number;
  duration_hours: number;
  agency: { name: string; tier: string } | null;
  brand: { name: string } | null;
}

const gigTypeLabels: Record<string, string> = {
  photo_shoot: "Photo Shoot",
  runway: "Runway Show",
  commercial: "Commercial",
  music_video_cameo: "Music Video",
  cover_shoot: "Cover Shoot",
  brand_ambassador: "Brand Ambassador",
};

const tierColors: Record<string, string> = {
  elite: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  international: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  national: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  local: "bg-muted text-muted-foreground",
};

export const ModelingOffersPanel = ({ userId, playerLooks, playerFame }: ModelingOffersPanelProps) => {
  const queryClient = useQueryClient();

  const { data: eligibleGigs, isLoading } = useQuery({
    queryKey: ["modeling-gigs-eligible", playerLooks, playerFame],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modeling_gigs")
        .select(`
          *,
          agency:modeling_agencies(name, tier),
          brand:sponsorship_brands(name)
        `)
        .eq("is_available", true)
        .lte("min_looks_required", playerLooks)
        .lte("min_fame_required", playerFame)
        .order("compensation_max", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as unknown as ModelingGig[];
    },
    enabled: playerLooks > 0,
  });

  const { data: activeContracts } = useQuery({
    queryKey: ["modeling-contracts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_modeling_contracts")
        .select("*, gig:modeling_gigs(title, gig_type)")
        .eq("user_id", userId)
        .in("status", ["offered", "accepted", "shooting"]);

      if (error) throw error;
      return data;
    },
  });

  const acceptGig = useMutation({
    mutationFn: async (gig: ModelingGig) => {
      const compensation = Math.floor(
        gig.compensation_min + Math.random() * (gig.compensation_max - gig.compensation_min)
      );

      const shootDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const shootEnd = new Date(shootDate.getTime() + gig.duration_hours * 60 * 60 * 1000);

      const { error } = await supabase.from("player_modeling_contracts").insert({
        user_id: userId,
        gig_id: gig.id,
        brand_id: gig.brand?.name ? undefined : undefined,
        status: "accepted",
        gig_type: gig.gig_type,
        compensation,
        fame_boost: gig.fame_boost,
        shoot_date: shootDate.toISOString().split("T")[0],
      });

      if (error) throw error;

      // Block schedule for the shoot
      try {
        await createScheduledActivity({
          userId,
          activityType: "pr_appearance",
          scheduledStart: shootDate,
          scheduledEnd: shootEnd,
          title: `Modeling: ${gig.title}`,
          description: `${gigTypeLabels[gig.gig_type] || gig.gig_type} for ${gig.brand?.name || gig.agency?.name || "brand"}`,
          metadata: {
            gig_id: gig.id,
            gig_type: gig.gig_type,
            compensation,
          },
        });
      } catch (scheduleError) {
        console.warn("Failed to create schedule entry for modeling gig:", scheduleError);
      }

      return { compensation };
    },
    onSuccess: (data) => {
      toast.success(`Modeling gig accepted! You'll earn $${data.compensation.toLocaleString()}`);
      queryClient.invalidateQueries({ queryKey: ["modeling-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["scheduled-activities"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to accept gig");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const formatCompensation = (min: number, max: number) => {
    const format = (n: number) => (n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : `$${(n / 1000).toFixed(0)}K`);
    return `${format(min)} - ${format(max)}`;
  };

  const completedCount = activeContracts?.filter(c => c.status === 'completed').length ?? 0;
  const totalEarnings = activeContracts?.reduce((sum, c) => sum + (c.compensation || 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Career Progress */}
      <ModelingCareerProgress
        totalGigsCompleted={completedCount}
        totalEarnings={totalEarnings}
        playerLooks={playerLooks}
        currentTier=""
      />

      {/* Active Contracts */}
      {activeContracts && activeContracts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Active Contracts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeContracts.map((contract) => (
              <div key={contract.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                <span>{contract.gig?.title}</span>
                <Badge variant="secondary">{contract.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Available Gigs */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Available Modeling Gigs ({eligibleGigs?.length || 0})
        </h3>

        {eligibleGigs?.length === 0 ? (
          <Card className="bg-muted/50">
            <CardContent className="p-6 text-center text-muted-foreground">
              <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No modeling opportunities available at your current looks/fame level.</p>
              <p className="text-sm mt-1">Increase your looks attribute to unlock more gigs!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {eligibleGigs?.map((gig) => (
              <Card key={gig.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold">{gig.title}</h4>
                        <Badge variant="outline">{gigTypeLabels[gig.gig_type] || gig.gig_type}</Badge>
                        {gig.agency && (
                          <Badge className={tierColors[gig.agency.tier] || tierColors.local}>
                            {gig.agency.name}
                          </Badge>
                        )}
                      </div>

                      {gig.brand && (
                        <p className="text-sm text-muted-foreground">Brand: {gig.brand.name}</p>
                      )}

                      {gig.description && (
                        <p className="text-sm text-muted-foreground">{gig.description}</p>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-green-500" />
                          {formatCompensation(gig.compensation_min, gig.compensation_max)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-amber-500" />
                          +{gig.fame_boost} fame
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {gig.duration_hours}h
                        </span>
                      </div>
                    </div>

                    <Button
                      onClick={() => acceptGig.mutate(gig)}
                      disabled={acceptGig.isPending}
                      className="shrink-0"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
