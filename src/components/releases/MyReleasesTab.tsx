import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Music, Calendar, DollarSign, Image, Disc, Radio, 
  TrendingUp, Package, Clock, CheckCircle2, AlertCircle,
  Play, Users, BarChart3, XCircle, Plus, Search, Filter, PartyPopper, Megaphone, RefreshCw, Share2
} from "lucide-react";
import { ReleasePredictions } from "./ReleasePredictions";
import { HypeMeter } from "./HypeMeter";
import { ReleasePartyModal } from "./ReleasePartyModal";
import { ManufacturingProgress } from "./ManufacturingProgress";
import { EditReleaseDialog } from "./EditReleaseDialog";
import { CancelReleaseDialog } from "./CancelReleaseDialog";
import { ReleaseTracklistWithAudio } from "./ReleaseTracklistWithAudio";
import { AddPhysicalFormatDialog } from "./AddPhysicalFormatDialog";
import { ReleaseAnalyticsDialog } from "./ReleaseAnalyticsDialog";
import { ReorderStockDialog } from "./ReorderStockDialog";
import { minorToMajor } from "@/lib/releaseMoney";
import { MUSIC_GENRES } from "@/data/genres";
import { format as formatDate, formatDistanceToNow } from "date-fns";
import { resolveActiveBandMembership } from "@/utils/activeBandMembership";
import { referralShareOnCooldown } from "@/lib/referralShare";
import { referralUrlWithParams } from "@/features/shareable-moments/share";
import { ShareMomentSheet } from "@/features/shareable-moments/ShareMomentSheet";
import type { ShareMoment } from "@/features/shareable-moments/types";
import { shouldOfferSharePrompt } from "@/features/shareable-moments/prompts";
import { referralAwareDestination } from "@/features/shareable-moments/referralDestination";
import { REVENUE_SHARE_THRESHOLDS, highestReachedThreshold, milestoneLabel } from "@/features/shareable-moments/milestones";

interface MyReleasesTabProps {
  userId: string;
  authUserId?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof Music }> = {
  draft: { label: "Draft", variant: "outline", icon: AlertCircle },
  planned: { label: "Planned", variant: "secondary", icon: Clock },
  manufacturing: { label: "Manufacturing", variant: "secondary", icon: Package },
  released: { label: "Released", variant: "default", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", variant: "destructive", icon: XCircle },
};

const RELEASE_TYPE_CONFIG: Record<string, { label: string; trackRange: string }> = {
  single: { label: "Single", trackRange: "1-2 tracks" },
  ep: { label: "EP", trackRange: "3-6 tracks" },
  album: { label: "Album", trackRange: "7+ tracks" },
};

export function MyReleasesTab({ userId, authUserId }: MyReleasesTabProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const creatingReleasePoster = new URLSearchParams(location.search).get("shareCreate") === "release";
  const queryClient = useQueryClient();

  const releaseNow = useMutation({
    mutationFn: async (release: any) => {
      // Clear any future scheduling/manufacturing gate so the sweep can complete it
      const nowIso = new Date().toISOString();
      const updates: Record<string, string> = {};
      if (!release.manufacturing_complete_at || new Date(release.manufacturing_complete_at) > new Date()) {
        updates.manufacturing_complete_at = nowIso;
      }
      if (release.scheduled_release_date && new Date(release.scheduled_release_date) > new Date()) {
        updates.scheduled_release_date = nowIso;
      }
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.from("releases").update(updates).eq("id", release.id);
        if (updateError) throw updateError;
      }

      const { error } = await supabase.functions.invoke("complete-release-manufacturing");
      if (error) throw error;

      const { data, error: checkError } = await supabase
        .from("releases")
        .select("release_status")
        .eq("id", release.id)
        .maybeSingle();
      if (checkError) throw checkError;
      return data?.release_status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ["releases"] });
      if (status === "released") {
        toast.success("Release is now live!");
      } else {
        toast.info("Release queued — it will go live shortly.");
      }
    },
    onError: (error: Error) => {
      toast.error(`Could not release: ${error.message}`);
    },
  });

  const [editingRelease, setEditingRelease] = useState<any>(null);
  const [cancellingRelease, setCancellingRelease] = useState<any>(null);
  const [addPhysicalRelease, setAddPhysicalRelease] = useState<any>(null);
  const [analyticsRelease, setAnalyticsRelease] = useState<any>(null);
  const [reorderFormat, setReorderFormat] = useState<{ format: any; release: any } | null>(null);
  const [partyRelease, setPartyRelease] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [milestoneMoment, setMilestoneMoment] = useState<ShareMoment | null>(null);
  const [promoMoment, setPromoMoment] = useState<ShareMoment | null>(null);

  const { data: releases, isLoading, error } = useQuery({
    queryKey: ["releases", userId],
    queryFn: async () => {
      // First get user's band IDs
      const membership = await resolveActiveBandMembership(userId, authUserId);
      const bandIds = membership ? [membership.band_id] : [];
      
      // Build the query with comprehensive data
      let query = supabase
        .from("releases")
        .select(`
          *,
          label_contract_id,
          label_revenue_share_pct,
          release_songs!release_songs_release_id_fkey(
            song_id,
            is_b_side,
            track_number,
            song:songs(
              id, 
              title, 
              quality_score, 
              audio_url, 
              audio_generation_status, 
              genre,
              duration_seconds
            )
          ),
          release_formats(
            id,
            format_type,
            quantity,
            manufacturing_cost,
            release_date,
            manufacturing_status
          ),
          bands(id, name, fame, popularity, chemistry_level, total_fans)
        `)
        .order("created_at", { ascending: false });
      
      // Character isolation: once this character has an active band, that band
      // is the authoritative release scope. Do not union in account-level
      // releases because multiple characters share the same auth user.
      if (bandIds.length > 0) {
        query = query.in("band_id", bandIds);
      } else {
        query = query.eq("user_id", authUserId ?? userId);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error("[MyReleasesTab] Query error:", error);
        throw error;
      }
      
      console.log("[MyReleasesTab] Fetched releases:", data?.length);
      return data || [];
    }
  });

  // Fetch aggregated financial data from release_sales
  const releaseIds = releases?.map(r => r.id) || [];
  const formatIds = releases?.flatMap(r => r.release_formats?.map((f: any) => f.id) || []) || [];

  const { data: chartEntries = [] } = useQuery({
    queryKey: ["release-share-chart-positions", releaseIds.join(",")],
    enabled: releaseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("chart_entries").select("release_id, rank").in("release_id", releaseIds);
      if (error) throw error;
      return data || [];
    },
  });
  const bestChartByRelease = new Map<string, number>();
  chartEntries.forEach((entry: any) => {
    if (!entry.release_id || !entry.rank) return;
    bestChartByRelease.set(entry.release_id, Math.min(bestChartByRelease.get(entry.release_id) ?? Infinity, Number(entry.rank)));
  });

  // Fetch label contracts referenced by these releases (for label-cut math)
  const contractIds = Array.from(
    new Set((releases || []).map((r: any) => r.label_contract_id).filter(Boolean))
  );

  const { data: contractMap } = useQuery({
    queryKey: ["release-label-contracts", contractIds.join(",")],
    queryFn: async () => {
      const map: Record<string, { labelCutPct: number; dealTypeName: string; endDate: string }> = {};
      if (contractIds.length === 0) return map;

      const { data: contracts } = await supabase
        .from("artist_label_contracts")
        .select("id, royalty_label_pct, royalty_artist_pct, deal_type_id, end_date")
        .in("id", contractIds);

      const dealTypeIds = Array.from(
        new Set((contracts || []).map((c: any) => c.deal_type_id).filter(Boolean))
      );
      const dealNameMap: Record<string, string> = {};
      if (dealTypeIds.length > 0) {
        const { data: dts } = await supabase
          .from("label_deal_types")
          .select("id, name")
          .in("id", dealTypeIds);
        (dts || []).forEach((dt: any) => { dealNameMap[dt.id] = dt.name; });
      }

      (contracts || []).forEach((c: any) => {
        const labelPct = c.royalty_label_pct ?? (100 - (c.royalty_artist_pct ?? 15));
        map[c.id] = {
          labelCutPct: labelPct / 100,
          dealTypeName: dealNameMap[c.deal_type_id] || "Standard Deal",
          endDate: c.end_date,
        };
      });
      return map;
    },
    enabled: contractIds.length > 0,
  });

  // Helper: compute the effective label cut % for a release (matches edge function logic)
  const getEffectiveLabelCutPct = (release: any): number => {
    if (!release?.label_contract_id) return 0;
    const contract = contractMap?.[release.label_contract_id];
    if (!contract) return 0;
    const overridePct = release.label_revenue_share_pct;
    let cut = overridePct != null ? overridePct / 100 : contract.labelCutPct;
    if (contract.dealTypeName === "Distribution Deal") cut = Math.min(cut, 0.20);
    if (contract.dealTypeName === "Licensing Deal" && new Date(contract.endDate) < new Date()) cut = 0;
    return cut;
  };

  const financeHealth = useQuery({queryKey:["release-finance-health"],queryFn:async()=>{const {data,error}=await (supabase as any).rpc("get_release_finance_health");if(error)throw error;if(!data?.ready||Number(data.contract_version)<2)throw new Error("Incomplete release finance backend");return data;},retry:false});
  const { data: salesFinancials, error: financeError, isLoading: financeLoading } = useQuery({
    queryKey: ["release-sales-financials", releaseIds.join(",")],
    queryFn: async () => {
      const result: Record<string, any> = {};
      await Promise.all(releaseIds.map(async (releaseId) => {
        const { data, error } = await (supabase as any).rpc("get_release_financial_summary", { p_release_id: releaseId, p_band_id: null });
        if (error) throw error;
        const row = data?.[0]; if (!row) return;
        result[releaseId] = { grossRevenue: minorToMajor(Number(row.gross_cents)), taxPaid: minorToMajor(Number(row.tax_cents)),
          distributionFees: minorToMajor(Number(row.dist_cents)), manufacturerShare: minorToMajor(Number(row.manufacturer_cents)),
          netRevenue: minorToMajor(Number(row.net_before_label_cents)), labelShare: minorToMajor(Number(row.label_cents)),
          bandRevenue: minorToMajor(Number(row.band_revenue_cents)), economicCost: minorToMajor(Number(row.economic_cost_cents)),
          bandCost: minorToMajor(Number(row.band_cost_cents)), labelCost: minorToMajor(Number(row.label_cost_cents)), unknownCost: minorToMajor(Number(row.unknown_cost_cents)) };
      })); return result;
    }, enabled: releaseIds.length > 0 && financeHealth.isSuccess, retry:false,
  });

  const filteredReleases = releases?.filter(r => {
    // Status filter
    if (statusFilter === "all" && r.release_status === "cancelled") return false;
    if (statusFilter === "released" && r.release_status !== "released") return false;
    if (statusFilter === "upcoming" && !["manufacturing", "planned", "draft"].includes(r.release_status)) return false;
    if (statusFilter === "cancelled" && r.release_status !== "cancelled") return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const titleMatch = r.title?.toLowerCase().includes(query);
      const artistMatch = r.artist_name?.toLowerCase().includes(query);
      if (!titleMatch && !artistMatch) return false;
    }
    
    // Type filter
    if (typeFilter !== "all" && r.release_type !== typeFilter) return false;
    
    // Genre filter
    if (genreFilter !== "all") {
      const releaseGenres = r.release_songs?.map((rs: any) => rs.song?.genre).filter(Boolean) || [];
      if (!releaseGenres.includes(genreFilter)) return false;
    }
    
    return true;
  }) || [];

  const totalTaxPaid = Object.values(salesFinancials || {}).reduce((sum: number, s: any) => sum + (s.taxPaid || 0), 0);
  const totalDistFees = Object.values(salesFinancials || {}).reduce((sum: number, s: any) => sum + (s.distributionFees || 0), 0);
  const totalBandCosts = Object.values(salesFinancials || {}).reduce((sum: number, s: any) => sum + (s.bandCost || 0), 0);
  const totalGrossRevenue = Object.values(salesFinancials || {}).reduce((sum: number, s: any) => sum + (s.grossRevenue || 0), 0);
  const totalLabelShare = Object.values(salesFinancials || {}).reduce((sum: number, s: any) => sum + (s.labelShare || 0), 0);
  const totalManufacturerShare = Object.values(salesFinancials || {}).reduce((sum: number, s: any) => sum + (s.manufacturerShare || 0), 0);
  const totalBandNet = Object.values(salesFinancials || {}).reduce((sum: number, s: any) => sum + (s.bandRevenue || 0), 0);
  const totalProfit = totalBandNet - totalBandCosts;

  useEffect(() => {
    if (!releases?.length || !salesFinancials || milestoneMoment) return;
    const candidate = releases
      .filter((release: any) => release.release_status === "released")
      .map((release: any) => ({ release, revenue: Number(salesFinancials[release.id]?.grossRevenue || 0) }))
      .map(({ release, revenue }) => ({ release, revenue, threshold: highestReachedThreshold(revenue, REVENUE_SHARE_THRESHOLDS) }))
      .filter((item): item is { release: any; revenue: number; threshold: number } => item.threshold !== null)
      .sort((a, b) => b.threshold - a.threshold)[0];
    if (!candidate) return;
    const sourceId = `${candidate.release.id}:${candidate.threshold}`;
    if (!shouldOfferSharePrompt("release-revenue-milestone", sourceId)) return;
    void (async () => {
      const destinationUrl = await referralAwareDestination(userId, window.location.href, "release_share");
      setMilestoneMoment({
      version: 1,
      promptOnly: true,
      promptKind: "release-revenue-milestone",
      promptSourceId: sourceId,
      promptLabel: "Share release milestone",
      type: "release",
      id: `revenue:${sourceId}`,
      eyebrow: "RELEASE MILESTONE",
      headline: candidate.release.title,
      subheadline: `${milestoneLabel(candidate.threshold)} in gross sales`,
      metrics: [
        { label: "Gross sales", value: `${candidate.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` },
        ...(candidate.release.artist_name ? [{ label: "Artist", value: candidate.release.artist_name }] : []),
        ...(candidate.release.release_type ? [{ label: "Format", value: String(candidate.release.release_type).toUpperCase() }] : []),
      ].slice(0, 4),
      artworkUrl: candidate.release.cover_art_url || candidate.release.cover_image_url || null,
      destinationUrl,
      referralCode: null,
      createdAt: new Date().toISOString(),
    });
    })();
  }, [releases, salesFinancials, milestoneMoment, userId]);

  const createReleasePoster = (release: any) => {
    const releaseDate = release.scheduled_release_date || release.release_date || release.created_at;
    setPromoMoment({
      version: 1,
      type: "release",
      id: `promo:${release.id}`,
      eyebrow: release.release_status === "released" ? "OUT NOW" : "COMING SOON",
      headline: release.title,
      subheadline: `${release.artist_name || "RockMundo artist"} · ${String(release.release_type || "release").toUpperCase()}`,
      metrics: [
        ...(releaseDate ? [{ label: release.release_status === "released" ? "Released" : "Release date", value: formatDate(new Date(releaseDate), "MMM d, yyyy") }] : []),
        ...(release.release_songs?.length ? [{ label: "Tracks", value: String(release.release_songs.length) }] : []),
      ],
      artworkUrl: release.cover_art_url || release.cover_image_url || null,
      destinationUrl: `${window.location.origin}/release/${release.id}`,
      referralCode: null,
      visualTheme: "spotlight",
      visualLayout: "hero",
      createdAt: new Date().toISOString(),
    });
  };

  const stats = {
    total: releases?.filter(r => r.release_status !== "cancelled").length || 0,
    released: releases?.filter(r => r.release_status === "released").length || 0,
    upcoming: releases?.filter(r => ["manufacturing", "planned", "draft"].includes(r.release_status)).length || 0,
    cancelled: releases?.filter(r => r.release_status === "cancelled").length || 0,
    totalRevenue: totalGrossRevenue,
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-6 bg-muted rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="p-8">
            <div className="h-20 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Error Loading Releases</h3>
          <p className="text-muted-foreground">{(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!releases || releases.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Disc className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Releases Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first release to start distributing your music!
          </p>
          <Button onClick={() => navigate("/release-manager")}>
            Create Release
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {creatingReleasePoster && <Card className="border-primary/30 bg-primary/5"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Share2 className="h-4 w-4 text-primary" />Choose a release for your poster</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Choose <strong>Poster</strong> on any non-cancelled release. Planned releases become COMING SOON artwork; live releases become OUT NOW artwork.</p></CardContent></Card>}
      <ShareMomentSheet moment={milestoneMoment} open={!!milestoneMoment} onOpenChange={(open) => { if (!open) setMilestoneMoment(null); }} />
      <ShareMomentSheet moment={promoMoment} open={!!promoMoment} onOpenChange={(open) => { if (!open) setPromoMoment(null); }} />
      {(financeHealth.error || financeError) && <Card className="border-amber-500"><CardContent className="p-4 flex gap-2"><AlertCircle className="h-5 w-5 text-amber-500"/><div><strong>Release financial data is temporarily unavailable.</strong><p className="text-sm text-muted-foreground">Your releases are still shown below; financial values are hidden until the finance service recovers.</p></div></CardContent></Card>}
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Disc className="h-4 w-4" />
              <span>Total Releases</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Released</span>
            </div>
            <p className="text-2xl font-bold">{stats.released}</p>
          </CardContent>
        </Card>
        {!financeHealth.error && !financeError && !financeLoading && <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              <span>Gross Revenue</span>
            </div>
            <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>}
        {!financeHealth.error && !financeError && !financeLoading && <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              <span>Tax + Dist + Manufacturer</span>
            </div>
            <p className="text-2xl font-bold text-orange-500">${(totalTaxPaid + totalDistFees + totalManufacturerShare).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Tax ${totalTaxPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })} · Dist ${totalDistFees.toLocaleString(undefined, { maximumFractionDigits: 0 })} · Mfr ${totalManufacturerShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>}
        {!financeHealth.error && !financeError && !financeLoading && <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              <span>Label Share</span>
            </div>
            <p className="text-2xl font-bold text-purple-500">${totalLabelShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Paid to record labels</p>
          </CardContent>
        </Card>}
        {!financeHealth.error && !financeError && !financeLoading && <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4" />
              <span>Band Net Profit</span>
            </div>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              ${totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Band revenue minus band-paid costs</p>
          </CardContent>
        </Card>}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search releases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="single">Single</SelectItem>
            <SelectItem value="ep">EP</SelectItem>
            <SelectItem value="album">Album</SelectItem>
          </SelectContent>
        </Select>
        <Select value={genreFilter} onValueChange={setGenreFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Genre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            {MUSIC_GENRES.slice(0, 15).map((genre) => (
              <SelectItem key={genre} value={genre}>{genre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="released">
            Released ({stats.released})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming ({stats.upcoming})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({stats.cancelled})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Releases Grid */}
      <div className="grid gap-4">
        {filteredReleases.map((release: any) => (
          <ReleaseCard 
            key={release.id} 
            release={release} 
            financials={salesFinancials?.[release.id]}
            financeAvailable={financeHealth.isSuccess && !financeError && !financeLoading}
            labelCutPct={getEffectiveLabelCutPct(release)}
            onEdit={() => setEditingRelease(release)}
            onCancel={() => setCancellingRelease(release)}
            onViewDetails={() => navigate(`/release/${release.id}`)}
            onPromo={() => navigate(`/release/${release.id}?tab=promotion`)}
            onSharePoster={() => createReleasePoster(release)}
            onAddPhysical={() => setAddPhysicalRelease(release)}
            onAnalytics={() => setAnalyticsRelease(release)}
            onReorder={(format) => {
              setReorderFormat({ format, release });
            }}
            onParty={() => setPartyRelease(release)}
            onReleaseNow={() => releaseNow.mutate(release)}
            isReleasing={releaseNow.isPending && releaseNow.variables?.id === release.id}
            bestChartPosition={bestChartByRelease.get(release.id)}
            profileId={userId}
          />
        ))}
      </div>

      {filteredReleases.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No releases match this filter.</p>
          </CardContent>
        </Card>
      )}

      <EditReleaseDialog
        open={!!editingRelease}
        onOpenChange={(open) => !open && setEditingRelease(null)}
        release={editingRelease}
      />

      <CancelReleaseDialog
        open={!!cancellingRelease}
        onOpenChange={(open) => !open && setCancellingRelease(null)}
        release={cancellingRelease}
      />

      <AddPhysicalFormatDialog
        open={!!addPhysicalRelease}
        onOpenChange={(open) => !open && setAddPhysicalRelease(null)}
        release={addPhysicalRelease}
      />

      <ReleaseAnalyticsDialog
        open={!!analyticsRelease}
        onOpenChange={(open) => !open && setAnalyticsRelease(null)}
        release={analyticsRelease}
      />

      <ReorderStockDialog
        open={!!reorderFormat}
        onOpenChange={(open) => !open && setReorderFormat(null)}
        format={reorderFormat?.format}
        release={reorderFormat?.release}
      />

      {partyRelease && (
        <ReleasePartyModal
          open={!!partyRelease}
          onOpenChange={(open) => !open && setPartyRelease(null)}
          releaseId={partyRelease.id}
          releaseTitle={partyRelease.title}
          userId={userId}
          bandId={partyRelease.band_id}
        />
      )}
    </div>
  );
}

interface ReleaseCardProps {
  release: any;
  financials?: { grossRevenue: number; taxPaid: number; distributionFees: number; manufacturerShare: number; netRevenue: number; economicCost?: number; bandCost?: number; bandRevenue?: number; labelShare?: number };
  financeAvailable?: boolean;
  labelCutPct?: number;
  onEdit: () => void;
  onCancel: () => void;
  onViewDetails: () => void;
  onPromo?: () => void;
  onAddPhysical?: () => void;
  onAnalytics?: () => void;
  onReorder?: (format: any) => void;
  onParty?: () => void;
  onReleaseNow?: () => void;
  isReleasing?: boolean;
  bestChartPosition?: number;
  profileId?: string;
  onSharePoster?: () => void;
}

function ReleaseCard({ release, financials, financeAvailable = false, labelCutPct = 0, onEdit, onCancel, onViewDetails, onPromo, onAddPhysical, onAnalytics, onReorder, onParty, onReleaseNow, isReleasing, bestChartPosition, profileId, onSharePoster }: ReleaseCardProps) {
  const [shareMoment, setShareMoment] = useState<ShareMoment | null>(null);
  const statusConfig = STATUS_CONFIG[release.release_status] || STATUS_CONFIG.draft;
  const typeConfig = RELEASE_TYPE_CONFIG[release.release_type] || RELEASE_TYPE_CONFIG.single;
  const StatusIcon = statusConfig.icon;
  
  const totalTracks = release.release_songs?.length || 0;
  const avgQuality = totalTracks > 0 
    ? Math.round(release.release_songs.reduce((sum: number, rs: any) => sum + (rs.song?.quality_score || 0), 0) / totalTracks)
    : 0;
  
  const physicalFormats = release.release_formats?.filter((f: any) => 
    ["cd", "vinyl", "cassette"].includes(f.format_type)
  ) || [];
  const digitalFormats = release.release_formats?.filter((f: any) => 
    ["digital", "streaming"].includes(f.format_type)
  ) || [];
  
  const totalUnitsOrdered = physicalFormats.reduce((sum: number, f: any) => sum + (f.quantity || 0), 0);
  const shareRelease = release.release_status === "released";
  const handleShareRelease = async () => {
    if (!profileId || !shareRelease) return;
    const key = "rockmundo_release_referral_share_at";
    if (referralShareOnCooldown(key)) {
      toast.info("You shared a release milestone recently. Try again later.");
      return;
    }
    const { data, error } = await (supabase as any).rpc("get_referral_dashboard", { p_profile_id: profileId });
    if (error || !data?.code) {
      toast.error("Could not prepare your referral link");
      return;
    }
    const url = referralUrlWithParams(data.code, { source: bestChartPosition != null && bestChartPosition <= 10 ? "release_chart_share" : "release_share" });
    setShareMoment({
      version: 1,
      type: "release",
      id: release.id,
      eyebrow: bestChartPosition === 1 ? "NUMBER ONE RELEASE" : bestChartPosition != null && bestChartPosition <= 10 ? "RELEASE CHART MILESTONE" : "OUT NOW",
      headline: release.title,
      subheadline: bestChartPosition != null ? `${release.artist_name || release.bands?.name || "New release"} · Reached #${bestChartPosition} in RockMundo` : `${release.artist_name || release.bands?.name || "New release"} · Out now in RockMundo`,
      metrics: [
        ...(bestChartPosition != null ? [{ label: "Chart position", value: `#${bestChartPosition}` }] : []),
        { label: "Format", value: typeConfig.label },
        { label: "Tracks", value: String(totalTracks) },
        ...(avgQuality > 0 ? [{ label: "Quality", value: String(avgQuality) }] : []),
      ].slice(0, 4),
      artworkUrl: release.artwork_url || null,
      destinationUrl: url,
      referralCode: null,
      shareCooldownKey: key,
      createdAt: new Date().toISOString(),
    });
  };
  
  return (
    <>
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-3">
        {release.artwork_url ? (
          <img src={release.artwork_url} alt={release.title} className="w-14 h-14 object-cover rounded-md shadow-sm flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 bg-gradient-to-br from-muted to-muted/50 rounded-md flex items-center justify-center shadow-inner flex-shrink-0">
            <Disc className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{release.title}</h3>
            <Badge variant={statusConfig.variant} className="text-[10px] px-1.5 py-0 h-4 flex items-center gap-0.5">
              <StatusIcon className="h-2.5 w-2.5" />
              {statusConfig.label}
            </Badge>
            <span className="text-[10px] text-muted-foreground capitalize">{typeConfig.label}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
            <span>{release.artist_name}</span>
            <span>•</span>
            <span>{totalTracks} track{totalTracks !== 1 ? "s" : ""}</span>
            {avgQuality > 0 && (<><span>•</span><span>Q: {avgQuality}</span></>)}
            {release.bands && (<><span>•</span><span>{release.bands.name}</span></>)}
            <span>•</span>
            <span>{formatDistanceToNow(new Date(release.created_at), { addSuffix: true })}</span>
          </div>
          {financeAvailable ? <div className="flex items-center gap-3 text-[11px] flex-wrap">
            <span className="text-muted-foreground">Economic cost: <strong>${(financials?.economicCost || 0).toLocaleString()}</strong> · Band paid: <strong>${(financials?.bandCost || 0).toLocaleString()}</strong></span>
            <span className="text-green-600">Rev: <strong>${(financials?.grossRevenue || 0).toLocaleString()}</strong></span>
            {labelCutPct > 0 && (
              <span className="text-purple-500">
                Label: <strong>${Math.round(financials?.labelShare || 0).toLocaleString()}</strong>
                <span className="text-muted-foreground"> ({Math.round(labelCutPct * 100)}%)</span>
              </span>
            )}
            {(() => {
              const profit = (financials?.bandRevenue || 0) - (financials?.bandCost || 0);
              return <span className={profit >= 0 ? 'text-green-600' : 'text-destructive'}>P/L: <strong>${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>;
            })()}
            {release.total_streams > 0 && <span className="text-muted-foreground"><Play className="h-3 w-3 inline mr-0.5" />{release.total_streams.toLocaleString()}</span>}
            {release.units_sold > 0 && <span className="text-muted-foreground">Sold: {release.units_sold.toLocaleString()}</span>}
          </div> : <p className="text-[11px] text-amber-600">Financial breakdown unavailable</p>}
          {release.release_formats?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {release.release_formats.map((fmt: any) => {
                const isPhysical = ['cd', 'vinyl', 'cassette'].includes(fmt.format_type);
                const isSoldOut = isPhysical && fmt.quantity <= 0;
                const isLowStock = isPhysical && fmt.quantity > 0 && fmt.quantity < 50;
                return (
                  <span key={fmt.id} className="inline-flex items-center gap-0.5">
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 capitalize ${isSoldOut ? 'border-destructive/50 text-destructive' : ''}`}>
                      {fmt.format_type}{isPhysical && <span className="ml-1">{isSoldOut ? '∅' : fmt.quantity}</span>}
                    </Badge>
                    {release.release_status === "released" && isPhysical && (isSoldOut || isLowStock) && (
                      <Button variant="ghost" size="sm" className="text-[9px] px-1 h-4 text-primary" onClick={(e) => { e.stopPropagation(); onReorder?.(fmt); }}>
                        <RefreshCw className="h-2.5 w-2.5" />
                      </Button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
          {(release.hype_score > 0 || release.release_status === "manufacturing" || release.release_status === "released") && (
            <HypeMeter hypeScore={release.hype_score || 0} />
          )}
          {shareRelease && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); void handleShareRelease(); }}>
              <Share2 className="mr-1.5 h-3.5 w-3.5" />{bestChartPosition != null && bestChartPosition <= 10 ? `Share #${bestChartPosition} chart milestone` : "Share release"}
            </Button>
          )}
          {release.release_status === "manufacturing" && (
            <ManufacturingProgress createdAt={release.created_at} manufacturingCompleteAt={release.manufacturing_complete_at} status={release.release_status} />
          )}
          {release.release_status === "manufacturing" && onReleaseNow && (
            <Button
              size="sm"
              className="text-[10px] px-2 h-6 w-full"
              disabled={isReleasing}
              onClick={(e) => { e.stopPropagation(); onReleaseNow(); }}
            >
              <Play className="h-2.5 w-2.5 mr-0.5" />
              {isReleasing ? "Releasing..." : "Release Now"}
            </Button>
          )}
          <div className="flex flex-wrap gap-1 pt-1">
            <Button variant="default" size="sm" className="text-[10px] px-2 h-6" onClick={onViewDetails}>Details</Button>
            {release.release_status !== "cancelled" && (
              <Button variant="outline" size="sm" className="text-[10px] px-2 h-6" onClick={onPromo}><Megaphone className="h-2.5 w-2.5 mr-0.5" />Promo</Button>
            )}
            {release.release_status !== "cancelled" && onSharePoster && (
              <Button variant="outline" size="sm" className="text-[10px] px-2 h-6" onClick={onSharePoster}><Share2 className="h-2.5 w-2.5 mr-0.5" />Poster</Button>
            )}
            {release.release_status === "released" && (
              <>
                <Button variant="outline" size="sm" className="text-[10px] px-2 h-6" onClick={onAnalytics}><BarChart3 className="h-2.5 w-2.5 mr-0.5" />Analytics</Button>
                {(() => {
                  const ep = release.release_formats?.filter((f: any) => ["cd", "vinyl", "cassette"].includes(f.format_type)) || [];
                  return ep.length < 3 ? <Button variant="outline" size="sm" className="text-[10px] px-2 h-6" onClick={onAddPhysical}><Plus className="h-2.5 w-2.5 mr-0.5" />Physical</Button> : null;
                })()}
              </>
            )}
            {(release.release_status === "released" || release.release_status === "manufacturing") && !release.release_party_done && (
              <Button variant="outline" size="sm" className="text-[10px] px-2 h-6" onClick={onParty}><PartyPopper className="h-2.5 w-2.5 mr-0.5" />Party</Button>
            )}
            {release.release_status !== "released" && release.release_status !== "cancelled" && (
              <>
                <Button variant="outline" size="sm" className="text-[10px] px-2 h-6" onClick={onEdit}>Edit</Button>
                <Button variant="destructive" size="sm" className="text-[10px] px-2 h-6" onClick={onCancel}><XCircle className="h-2.5 w-2.5 mr-0.5" />Cancel</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
      <ShareMomentSheet moment={shareMoment} open={!!shareMoment} onOpenChange={(open) => { if (!open) setShareMoment(null); }} />
    </>
  );
}
