import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, UserMinus, Music, Disc3, Album, DollarSign, Search,
  TrendingUp, Heart, Star, Flame, BarChart3, Eye, ChevronDown, ChevronUp, Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { ScoutOfferDialog } from "./ScoutOfferDialog";
import { RecoupmentTracker } from "../RecoupmentTracker";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface LabelRosterTabProps {
  labelId: string;
  rosterCapacity: number;
  labelReputation?: number;
}

export function LabelRosterTab({ labelId, rosterCapacity, labelReputation = 0 }: LabelRosterTabProps) {
  const [showScoutDialog, setShowScoutDialog] = useState(false);
  const [expandedArtist, setExpandedArtist] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ["label-roster-contracts", labelId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("artist_label_contracts")
        .select(`
          *,
          bands:band_id(id, name, genre, fame, total_fans, band_balance, chemistry),
          label_releases(id, status, title, release_type, units_sold, revenue_generated, release_date, promotion_budget),
          label_royalty_statements(id, artist_share, label_share)
        `)
        .eq("label_id", labelId)
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch campaigns through releases
  const { data: campaigns = [] } = useQuery({
    queryKey: ["label-roster-campaigns", labelId],
    queryFn: async () => {
      if (contracts.length === 0) return [];
      // Get all release IDs from contracts
      const releaseIds = contracts.flatMap(c =>
        (c.label_releases || []).map((r: any) => r.id)
      ).filter(Boolean);
      if (releaseIds.length === 0) return [];
      const { data } = await supabase
        .from("label_promotion_campaigns")
        .select("id, release_id, campaign_type, budget, effectiveness")
        .in("release_id", releaseIds);
      return data || [];
    },
    enabled: contracts.length > 0,
  });

  const dropArtistMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const { error } = await supabase
        .from("artist_label_contracts")
        .update({ status: "terminated", terminated_at: new Date().toISOString() })
        .eq("id", contractId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["label-roster-contracts", labelId] });
      queryClient.invalidateQueries({ queryKey: ["label-artists", labelId] });
      toast.success("Artist released from roster");
    },
    onError: () => toast.error("Failed to release artist"),
  });

  const activeContracts = contracts.filter(c => c.status === "active");

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading roster...</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Signed Artists</h3>
          <p className="text-xs text-muted-foreground">
            {activeContracts.length} / {rosterCapacity} roster slots
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setShowScoutDialog(true)}>
            <Search className="h-3.5 w-3.5 mr-1" />
            Scout & Offer
          </Button>
          <Progress value={(activeContracts.length / rosterCapacity) * 100} className="w-24 h-2" />
        </div>
      </div>

      {activeContracts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No artists signed yet</p>
            <p className="text-sm text-muted-foreground">Review demo submissions or scout bands to sign new artists</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeContracts.map((contract) => {
            const band = contract.bands as any;
            const releases = (contract.label_releases || []) as any[];
            const releasedReleases = releases.filter(r => r.status === 'released');
            const inProgressReleases = releases.filter(r => r.status !== 'released');
            const singlesCompleted = contract.singles_completed ?? 0;
            const albumsCompleted = contract.albums_completed ?? 0;
            const totalLabelRoyalties = contract.label_royalty_statements?.reduce(
              (sum: number, s: any) => sum + (s.label_share ?? 0), 0
            ) ?? 0;
            const totalArtistRoyalties = contract.label_royalty_statements?.reduce(
              (sum: number, s: any) => sum + (s.artist_share ?? 0), 0
            ) ?? 0;
            const totalUnits = releases.reduce((s, r) => s + (r.units_sold ?? 0), 0);
            const totalRevenue = releases.reduce((s, r) => s + (r.revenue_generated ?? 0), 0);
            const releaseIds = releases.map((r: any) => r.id);
            const artistCampaigns = campaigns.filter(c => releaseIds.includes(c.release_id));
            const totalCampaignBudget = artistCampaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
            const isExpanded = expandedArtist === contract.id;

            const singleQuota = contract.single_quota ?? contract.release_quota ?? 0;
            const albumQuota = contract.album_quota ?? 0;
            const singlePct = singleQuota > 0 ? (singlesCompleted / singleQuota) * 100 : 100;
            const albumPct = albumQuota > 0 ? (albumsCompleted / albumQuota) * 100 : 100;

            // Contract health indicator
            const advanceAmount = contract.advance_amount ?? 0;
            const recouped = contract.recouped_amount ?? 0;
            const isRecouped = advanceAmount === 0 || recouped >= advanceAmount;
            const isProfitable = totalRevenue > advanceAmount;

            return (
              <Card key={contract.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Main artist row */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Music className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{band?.name || "Unknown Artist"}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">{band?.genre || "Various"}</Badge>
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3 w-3 text-amber-400" />
                              {band?.fame ?? 0}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Heart className="h-3 w-3 text-pink-400" />
                              {(band?.total_fans ?? 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {isProfitable && (
                          <Badge className="bg-emerald-500/15 text-emerald-500 border-0 text-[10px] px-1.5 h-5">
                            Profitable
                          </Badge>
                        )}
                        {!isRecouped && (
                          <Badge className="bg-amber-500/15 text-amber-500 border-0 text-[10px] px-1.5 h-5">
                            Unrecouped
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Quick stats grid */}
                    <div className="grid grid-cols-4 gap-1.5 mt-2.5">
                      <div className="bg-muted/40 rounded px-2 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Singles</p>
                        <p className="text-xs font-bold">{singlesCompleted}/{singleQuota}</p>
                        <Progress value={singlePct} className="h-0.5 mt-0.5" />
                      </div>
                      <div className="bg-muted/40 rounded px-2 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Albums</p>
                        <p className="text-xs font-bold">{albumsCompleted}/{albumQuota}</p>
                        <Progress value={albumPct} className="h-0.5 mt-0.5" />
                      </div>
                      <div className="bg-muted/40 rounded px-2 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Units</p>
                        <p className="text-xs font-bold tabular-nums">{totalUnits.toLocaleString()}</p>
                      </div>
                      <div className="bg-muted/40 rounded px-2 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Revenue</p>
                        <p className="text-xs font-bold tabular-nums text-emerald-500">${totalRevenue.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Recoupment bar (compact) */}
                    {advanceAmount > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                          <span>Recoupment</span>
                          <span>${recouped.toLocaleString()} / ${advanceAmount.toLocaleString()}</span>
                        </div>
                        <Progress value={Math.min(100, (recouped / advanceAmount) * 100)} className="h-1" />
                      </div>
                    )}

                    {/* Expand/collapse */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 h-6 text-xs text-muted-foreground"
                      onClick={() => setExpandedArtist(isExpanded ? null : contract.id)}
                    >
                      {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                      {isExpanded ? "Hide Details" : "View Releases & Details"}
                    </Button>
                  </div>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-3 space-y-3">
                      {/* Contract terms */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Royalty Split</span>
                          <p className="font-semibold">{contract.royalty_artist_pct}% artist / {contract.royalty_label_pct ?? (100 - contract.royalty_artist_pct)}% label</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Advance</span>
                          <p className="font-semibold">${advanceAmount.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Label Royalties</span>
                          <p className="font-semibold text-emerald-500">${totalLabelRoyalties.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Campaign Spend</span>
                          <p className="font-semibold flex items-center gap-1">
                            <Megaphone className="h-3 w-3 text-purple-400" />
                            ${totalCampaignBudget.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Release catalog */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Release Catalog ({releases.length})</p>
                        {releases.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No releases yet — artist needs to deliver recordings</p>
                        ) : (
                          <div className="space-y-1.5">
                            {releases.map((rel: any) => {
                              const relCampaigns = artistCampaigns.filter(c => c.release_id === rel.id);
                              return (
                                <div key={rel.id} className="flex items-center justify-between bg-background/60 rounded-md px-2.5 py-1.5 text-xs border">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Disc3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                      <p className="font-medium truncate">{rel.title}</p>
                                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                        <span>{rel.release_type || "Single"}</span>
                                        {rel.release_date && <span>· {format(new Date(rel.release_date), "MMM yyyy")}</span>}
                                        {relCampaigns.length > 0 && (
                                          <span className="flex items-center gap-0.5 text-purple-400">
                                            <Megaphone className="h-2.5 w-2.5" />
                                            {relCampaigns.length} campaigns
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 text-right shrink-0">
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Units</p>
                                      <p className="font-medium tabular-nums">{(rel.units_sold ?? 0).toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Rev</p>
                                      <p className="font-medium tabular-nums text-emerald-500">${(rel.revenue_generated ?? 0).toLocaleString()}</p>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={cn("text-[10px] px-1 h-4", {
                                        "border-emerald-500/30 text-emerald-500": rel.status === "released",
                                        "border-blue-500/30 text-blue-500": rel.status === "manufacturing",
                                        "border-amber-500/30 text-amber-500": rel.status === "planning",
                                      })}
                                    >
                                      {rel.status || "planning"}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive text-xs h-7"
                          onClick={() => {
                            if (confirm(`Release ${band?.name} from the label? This will terminate their contract.`)) {
                              dropArtistMutation.mutate(contract.id);
                            }
                          }}
                          disabled={dropArtistMutation.isPending}
                        >
                          <UserMinus className="h-3 w-3 mr-1" />
                          Drop Artist
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ScoutOfferDialog
        open={showScoutDialog}
        onOpenChange={setShowScoutDialog}
        labelId={labelId}
        labelReputation={labelReputation}
      />
    </div>
  );
}
