import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
  Play, Users, BarChart3, XCircle, Plus, Search, Filter, PartyPopper, Megaphone, RefreshCw
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
import { MUSIC_GENRES } from "@/data/genres";
import { format as formatDate, formatDistanceToNow } from "date-fns";

interface MyReleasesTabProps {
  userId: string;
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

export function MyReleasesTab({ userId }: MyReleasesTabProps) {
  const navigate = useNavigate();
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

  const { data: releases, isLoading, error } = useQuery({
    queryKey: ["releases", userId],
    queryFn: async () => {
      // First get user's band IDs
      const { data: bandMemberships } = await supabase
        .from("band_members")
        .select("band_id")
        .or(`profile_id.eq.${userId},user_id.eq.${userId}`)
        .eq("member_status", "active");
      
      const bandIds = bandMemberships?.map(d => d.band_id) || [];
      
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
      
      // Filter by user_id OR band membership
      if (bandIds.length > 0) {
        query = query.or(`user_id.eq.${userId},band_id.in.(${bandIds.join(",")})`);
      } else {
        query = query.eq("user_id", userId);
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

  const { data: salesFinancials } = useQuery({
    queryKey: ["release-sales-financials", releaseIds.join(",")],
    queryFn: async () => {
      if (formatIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from("release_sales")
        .select("release_format_id, total_amount, sales_tax_amount, distribution_fee, net_revenue")
        .in("release_format_id", formatIds);
      
      if (error) {
        console.error("[MyReleasesTab] Sales financials error:", error);
        return {};
      }

      // Build a map: releaseId -> { grossRevenue, taxPaid, distributionFees, netRevenue }
      const formatToRelease: Record<string, string> = {};
      releases?.forEach(r => {
        r.release_formats?.forEach((f: any) => {
          formatToRelease[f.id] = r.id;
        });
      });

      const result: Record<string, { grossRevenue: number; taxPaid: number; distributionFees: number; netRevenue: number }> = {};
      data?.forEach((sale: any) => {
        const releaseId = formatToRelease[sale.release_format_id];
        if (!releaseId) return;
        if (!result[releaseId]) {
          result[releaseId] = { grossRevenue: 0, taxPaid: 0, distributionFees: 0, netRevenue: 0 };
        }
        result[releaseId].grossRevenue += (sale.total_amount || 0) / 100;
        result[releaseId].taxPaid += (sale.sales_tax_amount || 0) / 100;
        result[releaseId].distributionFees += (sale.distribution_fee || 0) / 100;
        result[releaseId].netRevenue += (sale.net_revenue || 0) / 100;
      });

      return result;
    },
    enabled: formatIds.length > 0,
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
  const totalMfgCost = releases?.reduce((sum, r) => sum + (r.total_cost || 0), 0) || 0;
  const totalGrossRevenue = releases?.reduce((sum, r) => sum + (r.total_revenue || 0), 0) || 0;
  // Label share: per-release netRevenue × that release's effective label cut %
  const totalLabelShare = (releases || []).reduce((sum: number, r: any) => {
    const fin = salesFinancials?.[r.id];
    if (!fin) return sum;
    return sum + (fin.netRevenue || 0) * getEffectiveLabelCutPct(r);
  }, 0);
  // Net to band = net revenue (after tax & dist) minus label share, then minus mfg cost
  const totalNetRevenue = Object.values(salesFinancials || {}).reduce((sum: number, s: any) => sum + (s.netRevenue || 0), 0);
  const totalBandNet = totalNetRevenue - totalLabelShare;
  const totalProfit = totalBandNet - totalMfgCost;

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
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              <span>Gross Revenue</span>
            </div>
            <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              <span>Tax + Dist Fees</span>
            </div>
            <p className="text-2xl font-bold text-orange-500">${(totalTaxPaid + totalDistFees).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Tax ${totalTaxPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })} · Dist ${totalDistFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" />
              <span>Label Share</span>
            </div>
            <p className="text-2xl font-bold text-purple-500">${totalLabelShare.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Paid to record labels</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <TrendingUp className="h-4 w-4" />
              <span>Band Net Profit</span>
            </div>
            <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              ${totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">After tax, dist, label & mfg</p>
          </CardContent>
        </Card>
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
            onEdit={() => setEditingRelease(release)}
            onCancel={() => setCancellingRelease(release)}
            onViewDetails={() => navigate(`/release/${release.id}`)}
            onPromo={() => navigate(`/release/${release.id}?tab=promotion`)}
            onAddPhysical={() => setAddPhysicalRelease(release)}
            onAnalytics={() => setAnalyticsRelease(release)}
            onReorder={(format) => {
              setReorderFormat({ format, release });
            }}
            onParty={() => setPartyRelease(release)}
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
  financials?: { grossRevenue: number; taxPaid: number; distributionFees: number; netRevenue: number };
  onEdit: () => void;
  onCancel: () => void;
  onViewDetails: () => void;
  onPromo?: () => void;
  onAddPhysical?: () => void;
  onAnalytics?: () => void;
  onReorder?: (format: any) => void;
  onParty?: () => void;
}

function ReleaseCard({ release, financials, onEdit, onCancel, onViewDetails, onPromo, onAddPhysical, onAnalytics, onReorder, onParty }: ReleaseCardProps) {
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
  
  return (
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
          <div className="flex items-center gap-3 text-[11px] flex-wrap">
            <span className="text-muted-foreground">Cost: <strong>${(release.total_cost || 0).toLocaleString()}</strong></span>
            <span className="text-green-600">Rev: <strong>${(release.total_revenue || 0).toLocaleString()}</strong></span>
            {(() => {
              const profit = (release.total_revenue || 0) - (release.total_cost || 0) - (financials?.taxPaid || 0) - (financials?.distributionFees || 0);
              return <span className={profit >= 0 ? 'text-green-600' : 'text-destructive'}>P/L: <strong>${profit.toLocaleString()}</strong></span>;
            })()}
            {release.total_streams > 0 && <span className="text-muted-foreground"><Play className="h-3 w-3 inline mr-0.5" />{release.total_streams.toLocaleString()}</span>}
            {release.units_sold > 0 && <span className="text-muted-foreground">Sold: {release.units_sold.toLocaleString()}</span>}
          </div>
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
          {release.release_status === "manufacturing" && (
            <ManufacturingProgress createdAt={release.created_at} manufacturingCompleteAt={release.manufacturing_complete_at} status={release.release_status} />
          )}
          <div className="flex flex-wrap gap-1 pt-1">
            <Button variant="default" size="sm" className="text-[10px] px-2 h-6" onClick={onViewDetails}>Details</Button>
            {release.release_status !== "cancelled" && (
              <Button variant="outline" size="sm" className="text-[10px] px-2 h-6" onClick={onPromo}><Megaphone className="h-2.5 w-2.5 mr-0.5" />Promo</Button>
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
  );
}
