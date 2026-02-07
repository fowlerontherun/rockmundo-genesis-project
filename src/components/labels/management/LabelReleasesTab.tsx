import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Disc, CalendarDays, DollarSign, TrendingUp, Package } from "lucide-react";
import { format } from "date-fns";

interface LabelReleasesTabProps {
  labelId: string;
}

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-amber-500/20 text-amber-500",
  manufacturing: "bg-blue-500/20 text-blue-500",
  released: "bg-emerald-500/20 text-emerald-500",
};

export function LabelReleasesTab({ labelId }: LabelReleasesTabProps) {
  const { data: releases = [], isLoading } = useQuery({
    queryKey: ["label-management-releases", labelId],
    queryFn: async () => {
      // Get all contracts for this label, then get their releases
      const { data: contracts } = await supabase
        .from("artist_label_contracts")
        .select("id")
        .eq("label_id", labelId);

      if (!contracts || contracts.length === 0) return [];

      const contractIds = contracts.map(c => c.id);

      const { data, error } = await supabase
        .from("label_releases")
        .select(`
          *,
          contract:artist_label_contracts(
            id, band_id, artist_profile_id,
            bands:band_id(name, genre)
          ),
          label_promotion_campaigns(id, campaign_type, budget, status)
        `)
        .in("contract_id", contractIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading releases...</CardContent></Card>;
  }

  if (releases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Disc className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No releases yet</p>
          <p className="text-sm text-muted-foreground">Releases will appear here once artists start working on their quotas</p>
        </CardContent>
      </Card>
    );
  }

  const totalRevenue = releases.reduce((sum, r) => sum + (r.revenue_generated ?? 0), 0);
  const totalUnits = releases.reduce((sum, r) => sum + (r.units_sold ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Package className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xl font-bold">{releases.length}</p>
            <p className="text-xs text-muted-foreground">Total Releases</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xl font-bold">{totalUnits.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Units Sold</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <DollarSign className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xl font-bold">${totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Release Cards */}
      <div className="space-y-3">
        {releases.map((release) => {
          const contract = release.contract as any;
          const band = contract?.bands;
          const campaigns = release.label_promotion_campaigns || [];
          const statusClass = STATUS_COLORS[release.status ?? "planning"] || STATUS_COLORS.planning;

          return (
            <Card key={release.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">{release.title}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{band?.name || "Unknown"}</span>
                      <span>·</span>
                      <Badge variant="outline" className="text-xs">{release.release_type || "Single"}</Badge>
                    </div>
                  </div>
                  <Badge className={`${statusClass} border-0`}>
                    {release.status || "planning"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" /> Release Date
                    </p>
                    <p className="text-sm font-medium">
                      {release.release_date ? format(new Date(release.release_date), "MMM d, yyyy") : "TBD"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Units Sold</p>
                    <p className="text-sm font-medium">{(release.units_sold ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-sm font-medium">${(release.revenue_generated ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Promo Budget</p>
                    <p className="text-sm font-medium">${(release.promotion_budget ?? 0).toLocaleString()}</p>
                  </div>
                </div>

                {campaigns.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {campaigns.map((c: any) => (
                      <Badge key={c.id} variant="secondary" className="text-xs">
                        {c.campaign_type} (${c.budget?.toLocaleString()})
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
