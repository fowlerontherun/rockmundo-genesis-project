import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Music, Calendar, DollarSign, Image, Disc, Radio, 
  TrendingUp, Package, Clock, CheckCircle2, AlertCircle,
  Play, Users, BarChart3, XCircle
} from "lucide-react";
import { ReleasePredictions } from "./ReleasePredictions";
import { ManufacturingProgress } from "./ManufacturingProgress";
import { EditReleaseDialog } from "./EditReleaseDialog";
import { CancelReleaseDialog } from "./CancelReleaseDialog";
import { ReleaseTracklistWithAudio } from "./ReleaseTracklistWithAudio";
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
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: releases, isLoading, error } = useQuery({
    queryKey: ["releases", userId],
    queryFn: async () => {
      // First get user's band IDs
      const { data: bandMemberships } = await supabase
        .from("band_members")
        .select("band_id")
        .eq("user_id", userId);
      
      const bandIds = bandMemberships?.map(d => d.band_id) || [];
      
      // Build the query with comprehensive data
      let query = supabase
        .from("releases")
        .select(`
          *,
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

  const filteredReleases = releases?.filter(r => {
    if (statusFilter === "all") return r.release_status !== "cancelled"; // Exclude cancelled from "all"
    if (statusFilter === "released") return r.release_status === "released";
    if (statusFilter === "upcoming") return ["manufacturing", "planned", "draft"].includes(r.release_status);
    if (statusFilter === "cancelled") return r.release_status === "cancelled";
    return true;
  }) || [];

  const stats = {
    total: releases?.filter(r => r.release_status !== "cancelled").length || 0,
    released: releases?.filter(r => r.release_status === "released").length || 0,
    upcoming: releases?.filter(r => ["manufacturing", "planned", "draft"].includes(r.release_status)).length || 0,
    cancelled: releases?.filter(r => r.release_status === "cancelled").length || 0,
    totalRevenue: releases?.reduce((sum, r) => sum + (r.total_revenue || 0), 0) || 0,
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <Clock className="h-4 w-4" />
              <span>Upcoming</span>
            </div>
            <p className="text-2xl font-bold">{stats.upcoming}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" />
              <span>Total Revenue</span>
            </div>
            <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
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
            onEdit={() => setEditingRelease(release)}
            onCancel={() => setCancellingRelease(release)}
            onViewDetails={() => navigate(`/release/${release.id}`)}
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
    </div>
  );
}

interface ReleaseCardProps {
  release: any;
  onEdit: () => void;
  onCancel: () => void;
  onViewDetails: () => void;
}

function ReleaseCard({ release, onEdit, onCancel, onViewDetails }: ReleaseCardProps) {
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
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start gap-4">
          <div className="flex gap-4">
            {release.artwork_url ? (
              <img
                src={release.artwork_url}
                alt={release.title}
                className="w-20 h-20 object-cover rounded-md shadow-md"
              />
            ) : (
              <div className="w-20 h-20 bg-gradient-to-br from-muted to-muted/50 rounded-md flex items-center justify-center shadow-inner">
                <Disc className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="truncate">{release.title}</CardTitle>
                <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{release.artist_name}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="capitalize font-medium">{typeConfig.label}</span>
                <span>•</span>
                <span>{totalTracks} track{totalTracks !== 1 ? "s" : ""}</span>
                {avgQuality > 0 && (
                  <>
                    <span>•</span>
                    <span>Avg Quality: {avgQuality}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Created {formatDistanceToNow(new Date(release.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Manufacturing Progress */}
        {release.release_status === "manufacturing" && (
          <ManufacturingProgress
            createdAt={release.created_at}
            manufacturingCompleteAt={release.manufacturing_complete_at}
            status={release.release_status}
          />
        )}

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span>Production Cost</span>
            </div>
            <p className="font-semibold">${(release.total_cost || 0).toLocaleString()}</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>Revenue</span>
            </div>
            <p className="font-semibold text-green-600">${(release.total_revenue || 0).toLocaleString()}</p>
          </div>
          {totalUnitsOrdered > 0 && (
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Package className="h-3.5 w-3.5" />
                <span>Units Ordered</span>
              </div>
              <p className="font-semibold">{totalUnitsOrdered.toLocaleString()}</p>
            </div>
          )}
          {release.total_streams && (
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Play className="h-3.5 w-3.5" />
                <span>Streams</span>
              </div>
              <p className="font-semibold">{release.total_streams.toLocaleString()}</p>
            </div>
          )}
          {release.units_sold && (
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <BarChart3 className="h-3.5 w-3.5" />
                <span>Units Sold</span>
              </div>
              <p className="font-semibold">{release.units_sold.toLocaleString()}</p>
            </div>
          )}
        </div>

        {/* Formats Section */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Disc className="h-4 w-4" />
            Formats
          </h4>
          <div className="flex flex-wrap gap-2">
            {release.release_formats?.length > 0 ? (
              release.release_formats.map((fmt: any) => (
                <div 
                  key={fmt.id} 
                  className="bg-muted/50 rounded-lg px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {fmt.format_type === "vinyl" && <Disc className="h-4 w-4" />}
                    {fmt.format_type === "cd" && <Disc className="h-4 w-4" />}
                    {fmt.format_type === "digital" && <Music className="h-4 w-4" />}
                    {fmt.format_type === "streaming" && <Radio className="h-4 w-4" />}
                    {fmt.format_type === "cassette" && <Music className="h-4 w-4" />}
                    <span className="capitalize font-medium">{fmt.format_type}</span>
                  </div>
                  {fmt.quantity && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmt.quantity} units @ ${fmt.manufacturing_cost}/unit
                    </p>
                  )}
                  {fmt.release_date && (
                    <p className="text-xs text-muted-foreground">
                      Release: {formatDate(new Date(fmt.release_date), "MMM d, yyyy")}
                    </p>
                  )}
                  {fmt.manufacturing_status && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      {fmt.manufacturing_status}
                    </Badge>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No formats selected</p>
            )}
          </div>
        </div>

        {/* Tracklist */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Music className="h-4 w-4" />
            Tracklist
          </h4>
          <ReleaseTracklistWithAudio 
            tracks={release.release_songs || []}
            showAudio={release.release_status === "released"}
          />
        </div>

        {/* Scheduled Release Date */}
        {release.scheduled_release_date && (
          <div className="flex items-center gap-2 text-sm bg-primary/10 rounded-lg p-3">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Scheduled Release:</span>
            <span className="font-medium">
              {formatDate(new Date(release.scheduled_release_date), "MMMM d, yyyy")}
            </span>
          </div>
        )}

        {/* Band/Artist Info */}
        {release.bands && (
          <div className="flex items-center gap-4 text-sm bg-muted/30 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{release.bands.name}</span>
            </div>
            <Badge variant="outline">Fame: {release.bands.fame || 0}</Badge>
            {release.bands.total_fans > 0 && (
              <Badge variant="outline">{release.bands.total_fans.toLocaleString()} fans</Badge>
            )}
          </div>
        )}

        {/* Predictions for unreleased */}
        {(release.release_status === "planned" || release.release_status === "manufacturing") && (
          <ReleasePredictions
            artistFame={release.bands?.fame || release.profiles?.fame || 0}
            artistPopularity={release.bands?.popularity || release.profiles?.popularity || 0}
            songQuality={avgQuality}
            bandChemistry={release.bands?.chemistry_level}
            releaseType={release.release_type}
            formatTypes={release.release_formats?.map((f: any) => f.format_type) || []}
            trackCount={totalTracks}
          />
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t">
          <Button 
            variant="default" 
            size="sm"
            onClick={onViewDetails}
          >
            View Details
          </Button>
          {release.release_status !== "released" && release.release_status !== "cancelled" && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={onEdit}
              >
                Edit Release
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={onCancel}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </>
          )}
          {release.release_status === "released" && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {}}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Analytics
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
