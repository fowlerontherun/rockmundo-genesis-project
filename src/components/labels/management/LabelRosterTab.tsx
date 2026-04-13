import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users, UserMinus, Music, Disc3, DollarSign, Search,
  TrendingUp, Heart, Star, Flame, BarChart3, ChevronDown, ChevronUp, Megaphone, Trophy,
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
          bands:band_id(id, name, genre, fame, total_fans, band_balance, chemistry_level)
        `)
        .eq("label_id", labelId)
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Get actual releases from releases table for all contracts
  const contractIds = contracts.map(c => c.id);
  const { data: releases = [] } = useQuery({
    queryKey: ["label-roster-releases", labelId, contractIds],
    queryFn: async () => {
      if (contractIds.length === 0) return [];
      const { data, error } = await supabase
        .from("releases")
        .select(`
          id, title, release_type, release_status, total_units_sold, total_revenue,
          digital_sales, cd_sales, vinyl_sales, cassette_sales, hype_score,
          label_contract_id, label_revenue_share_pct, scheduled_release_date, created_at
        `)
        .in("label_contract_id", contractIds)
        .neq("release_status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: contractIds.length > 0,
  });

  // Get chart entries for releases
  const releaseIds = releases.map(r => r.id);
  const { data: chartEntries = [] } = useQuery({
    queryKey: ["label-roster-charts", releaseIds],
    queryFn: async () => {
      if (releaseIds.length === 0) return [];
      const { data } = await supabase
        .from("chart_entries")
        .select("release_id, rank, chart_type, chart_date")
        .in("release_id", releaseIds)
        .order("chart_date", { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: releaseIds.length > 0,
  });

  // Get financial data per contract
  const { data: financialsByContract = new Map() } = useQuery({
    queryKey: ["label-roster-financials", labelId, contractIds],
    queryFn: async () => {
      if (contractIds.length === 0) return new Map();
      const { data } = await supabase
        .from("label_financial_transactions")
        .select("related_contract_id, transaction_type, amount")
        .eq("label_id", labelId)
        .in("related_contract_id", contractIds);

      const map = new Map<string, { revenue: number; marketing: number }>();
      (data || []).forEach(tx => {
        const cid = tx.related_contract_id;
        if (!cid) return;
        if (!map.has(cid)) map.set(cid, { revenue: 0, marketing: 0 });
        const entry = map.get(cid)!;
        if (tx.transaction_type === "revenue") entry.revenue += tx.amount;
        else if (tx.transaction_type === "marketing") entry.marketing += Math.abs(tx.amount);
      });
      return map;
    },
    enabled: contractIds.length > 0,
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

  // Build best chart position per release
  const bestChartByRelease = new Map<string, number>();
  chartEntries.forEach(ce => {
    const current = bestChartByRelease.get(ce.release_id!) ?? Infinity;
    if (ce.rank < current) bestChartByRelease.set(ce.release_id!, ce.rank);
  });

  const formatRevenue = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;

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
            const contractReleases = releases.filter(r => r.label_contract_id === contract.id);
            const releasedReleases = contractReleases.filter(r => r.release_status === 'released');
            const inProgressReleases = contractReleases.filter(r => r.release_status !== 'released');
            const singlesCompleted = contract.singles_completed ?? 0;
            const albumsCompleted = contract.albums_completed ?? 0;

            const totalUnits = contractReleases.reduce((s, r) => s + (r.total_units_sold ?? 0), 0);
            const totalRevenueCents = contractReleases.reduce((s, r) => s + (r.total_revenue ?? 0), 0);

            const financials = (financialsByContract as Map<string, any>)?.get(contract.id);
            const labelRevenue = financials?.revenue ?? 0;
            const labelMarketing = financials?.marketing ?? 0;

            const isExpanded = expandedArtist === contract.id;

            const singleQuota = contract.single_quota ?? contract.release_quota ?? 0;
            const albumQuota = contract.album_quota ?? 0;
            const singlePct = singleQuota > 0 ? (singlesCompleted / singleQuota) * 100 : 100;
            const albumPct = albumQuota > 0 ? (albumsCompleted / albumQuota) * 100 : 100;

            const advanceAmount = contract.advance_amount ?? 0;
            const recouped = contract.recouped_amount ?? 0;
            const isRecouped = advanceAmount === 0 || recouped >= advanceAmount;
            const isProfitable = labelRevenue > advanceAmount + labelMarketing;

            // Best chart position across all releases
            let bestChartPos = Infinity;
            contractReleases.forEach(r => {
              const pos = bestChartByRelease.get(r.id);
              if (pos && pos < bestChartPos) bestChartPos = pos;
            });

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
                              {(band?.fame ?? 0).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Heart className="h-3 w-3 text-pink-400" />
                              {(band?.total_fans ?? 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {bestChartPos !== Infinity && (
                          <Badge className="bg-amber-500/15 text-amber-500 border-0 text-[10px] px-1.5 h-5">
                            <Trophy className="h-2.5 w-2.5 mr-0.5" />
                            #{bestChartPos}
                          </Badge>
                        )}
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
                        <p className="text-[10px] text-muted-foreground">Releases</p>
                        <p className="text-xs font-bold">{contractReleases.length}</p>
                      </div>
                      <div className="bg-muted/40 rounded px-2 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Units Sold</p>
                        <p className="text-xs font-bold tabular-nums">{totalUnits.toLocaleString()}</p>
                      </div>
                      <div className="bg-muted/40 rounded px-2 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Gross Rev</p>
                        <p className="text-xs font-bold tabular-nums text-emerald-500">{formatRevenue(totalRevenueCents)}</p>
                      </div>
                      <div className="bg-muted/40 rounded px-2 py-1.5 text-center">
                        <p className="text-[10px] text-muted-foreground">Label Rev</p>
                        <p className="text-xs font-bold tabular-nums text-emerald-500">${labelRevenue.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Contract progress */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                          <span>Singles</span>
                          <span>{singlesCompleted}/{singleQuota}</span>
                        </div>
                        <Progress value={singlePct} className="h-1" />
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                          <span>Albums</span>
                          <span>{albumsCompleted}/{albumQuota}</span>
                        </div>
                        <Progress value={albumPct} className="h-1" />
                      </div>
                    </div>

                    {/* Recoupment bar */}
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
                          <span className="text-muted-foreground">Label Revenue</span>
                          <p className="font-semibold text-emerald-500">${labelRevenue.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Marketing Spend</span>
                          <p className="font-semibold flex items-center gap-1">
                            <Megaphone className="h-3 w-3 text-purple-400" />
                            ${labelMarketing.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Release catalog */}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Release Catalog ({contractReleases.length})</p>
                        {contractReleases.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No releases yet — artist needs to deliver recordings</p>
                        ) : (
                          <div className="space-y-1.5">
                            {contractReleases.map((rel) => {
                              const bestPos = bestChartByRelease.get(rel.id);
                              return (
                                <div key={rel.id} className="flex items-center justify-between bg-background/60 rounded-md px-2.5 py-1.5 text-xs border">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Disc3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0">
                                      <p className="font-medium truncate">{rel.title}</p>
                                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                        <span className="capitalize">{rel.release_type || "Single"}</span>
                                        {rel.scheduled_release_date && <span>· {format(new Date(rel.scheduled_release_date), "MMM yyyy")}</span>}
                                        {bestPos && (
                                          <span className="flex items-center gap-0.5 text-amber-500">
                                            <Trophy className="h-2.5 w-2.5" />
                                            Peak #{bestPos}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 text-right shrink-0">
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Units</p>
                                      <p className="font-medium tabular-nums">{(rel.total_units_sold ?? 0).toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] text-muted-foreground">Rev</p>
                                      <p className="font-medium tabular-nums text-emerald-500">{formatRevenue(rel.total_revenue ?? 0)}</p>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={cn("text-[10px] px-1 h-4 capitalize", {
                                        "border-emerald-500/30 text-emerald-500": rel.release_status === "released",
                                        "border-blue-500/30 text-blue-500": rel.release_status === "manufacturing",
                                        "border-amber-500/30 text-amber-500": rel.release_status === "planning",
                                      })}
                                    >
                                      {rel.release_status || "planning"}
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
