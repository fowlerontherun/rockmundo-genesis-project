import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Disc3, Album, DollarSign, TrendingUp, Music } from "lucide-react";
import { RecoupmentTracker } from "./RecoupmentTracker";
import { format } from "date-fns";

interface LabelArtistRosterProps {
  labelId: string;
}

interface RosterArtist {
  contractId: string;
  artistName: string;
  bandId: string | null;
  artistProfileId: string | null;
  status: string;
  advanceAmount: number;
  recoupedAmount: number;
  royaltyArtistPct: number;
  royaltyLabelPct: number;
  singlesCompleted: number;
  singleQuota: number;
  albumsCompleted: number;
  albumQuota: number;
  startDate: string;
  endDate: string;
  releasesCount: number;
  totalRevenue: number;
}

export function LabelArtistRoster({ labelId }: LabelArtistRosterProps) {
  const { data: rosterArtists = [], isLoading } = useQuery<RosterArtist[]>({
    queryKey: ["label-artist-roster", labelId],
    queryFn: async () => {
      // Fetch contracts for this label
      const { data: contracts, error } = await supabase
        .from("artist_label_contracts")
        .select(`
          id,
          band_id,
          artist_profile_id,
          status,
          advance_amount,
          recouped_amount,
          royalty_artist_pct,
          royalty_label_pct,
          single_quota,
          singles_completed,
          album_quota,
          albums_completed,
          start_date,
          end_date,
          releases_completed
        `)
        .eq("label_id", labelId)
        .in("status", ["active", "completed"])
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch band/artist names
      const bandIds = contracts.filter(c => c.band_id).map(c => c.band_id!);
      const profileIds = contracts.filter(c => c.artist_profile_id).map(c => c.artist_profile_id!);

      let bandNames = new Map<string, string>();
      let profileNames = new Map<string, string>();

      if (bandIds.length > 0) {
        const { data: bands } = await supabase
          .from("bands")
          .select("id, name")
          .in("id", bandIds);
        for (const b of bands || []) {
          bandNames.set(b.id, b.name);
        }
      }

      if (profileIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", profileIds);
        for (const p of profiles || []) {
          profileNames.set(p.id, p.display_name);
        }
      }

      // Fetch release counts and revenue per contract
      const contractIds = contracts.map(c => c.id);
      let releaseRevenues = new Map<string, { count: number; revenue: number }>();

      if (contractIds.length > 0) {
        const { data: releases } = await supabase
          .from("releases")
          .select("id, label_contract_id, total_revenue")
          .in("label_contract_id", contractIds);

        for (const r of releases || []) {
          const existing = releaseRevenues.get(r.label_contract_id!) || { count: 0, revenue: 0 };
          existing.count += 1;
          existing.revenue += (r.total_revenue || 0);
          releaseRevenues.set(r.label_contract_id!, existing);
        }
      }

      // Fetch label financial transactions for contract revenue
      if (contractIds.length > 0) {
        const { data: transactions } = await supabase
          .from("label_financial_transactions")
          .select("related_contract_id, amount, transaction_type")
          .in("related_contract_id", contractIds)
          .eq("transaction_type", "revenue");

        for (const t of transactions || []) {
          if (t.related_contract_id) {
            const existing = releaseRevenues.get(t.related_contract_id) || { count: 0, revenue: 0 };
            existing.revenue += (t.amount || 0);
            releaseRevenues.set(t.related_contract_id, existing);
          }
        }
      }

      return contracts.map(c => ({
        contractId: c.id,
        artistName: c.band_id 
          ? bandNames.get(c.band_id) || "Unknown Band"
          : profileNames.get(c.artist_profile_id!) || "Unknown Artist",
        bandId: c.band_id,
        artistProfileId: c.artist_profile_id,
        status: c.status || "active",
        advanceAmount: c.advance_amount || 0,
        recoupedAmount: c.recouped_amount || 0,
        royaltyArtistPct: c.royalty_artist_pct,
        royaltyLabelPct: c.royalty_label_pct ?? (100 - c.royalty_artist_pct),
        singlesCompleted: c.singles_completed || 0,
        singleQuota: c.single_quota || 0,
        albumsCompleted: c.albums_completed || 0,
        albumQuota: c.album_quota || 0,
        startDate: c.start_date,
        endDate: c.end_date,
        releasesCount: releaseRevenues.get(c.id)?.count || c.releases_completed || 0,
        totalRevenue: releaseRevenues.get(c.id)?.revenue || 0,
      }));
    },
    enabled: !!labelId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading roster...
        </CardContent>
      </Card>
    );
  }

  if (rosterArtists.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <Users className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="font-semibold">No Signed Artists</h3>
          <p className="text-sm text-muted-foreground">
            Scout talent and sign artists to build your roster.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Artist Roster ({rosterArtists.length})
        </h3>
      </div>

      <div className="grid gap-4">
        {rosterArtists.map((artist) => {
          const singleProgress = artist.singleQuota > 0 
            ? Math.min((artist.singlesCompleted / artist.singleQuota) * 100, 100) 
            : 100;
          const albumProgress = artist.albumQuota > 0
            ? Math.min((artist.albumsCompleted / artist.albumQuota) * 100, 100)
            : 100;

          return (
            <Card key={artist.contractId}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Music className="h-4 w-4 text-primary" />
                    {artist.artistName}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={artist.status === "active" ? "default" : "secondary"}>
                      {artist.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(artist.startDate), "MMM yyyy")} – {format(new Date(artist.endDate), "MMM yyyy")}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Revenue & Releases Summary */}
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-md border p-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                    </div>
                    <p className="font-bold text-emerald-600">${artist.totalRevenue.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Label Revenue</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Disc3 className="h-3.5 w-3.5" />
                    </div>
                    <p className="font-bold">{artist.releasesCount}</p>
                    <p className="text-[10px] text-muted-foreground">Releases</p>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                    </div>
                    <p className="font-bold">{artist.royaltyArtistPct}/{artist.royaltyLabelPct}%</p>
                    <p className="text-[10px] text-muted-foreground">Artist/Label Split</p>
                  </div>
                </div>

                {/* Quota Progress */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <Disc3 className="h-3 w-3" /> Singles
                      </span>
                      <span>{artist.singlesCompleted}/{artist.singleQuota}</span>
                    </div>
                    <Progress value={singleProgress} className="h-1.5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <Album className="h-3 w-3" /> Albums
                      </span>
                      <span>{artist.albumsCompleted}/{artist.albumQuota}</span>
                    </div>
                    <Progress value={albumProgress} className="h-1.5" />
                  </div>
                </div>

                {/* Recoupment */}
                {artist.advanceAmount > 0 && (
                  <RecoupmentTracker
                    advanceAmount={artist.advanceAmount}
                    recoupedAmount={artist.recoupedAmount}
                    royaltyArtistPct={artist.royaltyArtistPct}
                    royaltyLabelPct={artist.royaltyLabelPct}
                    compact
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
