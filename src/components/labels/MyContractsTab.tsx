import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Globe2, Layers, ShieldCheck } from "lucide-react";
import type { ArtistEntity, ContractWithRelations } from "./types";

interface MyContractsTabProps {
  artistEntities: ArtistEntity[];
}

const STATUS_VARIANTS: Record<string, "secondary" | "default" | "outline" | "destructive"> = {
  pending: "secondary",
  offered: "secondary",
  active: "default",
  completed: "outline",
  terminated: "destructive",
};

export function MyContractsTab({ artistEntities }: MyContractsTabProps) {
  const soloEntity = artistEntities.find((entity) => entity.type === "solo");
  const bandEntities = artistEntities.filter((entity) => entity.type === "band");

  const { data: contracts, isLoading } = useQuery<ContractWithRelations[]>({
    queryKey: ["label-contracts", soloEntity?.id, bandEntities.map((band) => band.id).join(",")],
    queryFn: async () => {
      const filters: string[] = [];
      if (soloEntity?.id) {
        filters.push(`artist_profile_id.eq.${soloEntity.id}`);
      }
      if (bandEntities.length > 0) {
        const bandFilter = bandEntities.map((band) => `"${band.id}"`).join(",");
        filters.push(`band_id.in.(${bandFilter})`);
      }

      if (filters.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from("artist_label_contracts")
        .select(`
          *,
          labels(id, name, headquarters_city, reputation_score),
          label_releases(*),
          label_royalty_statements(*),
          label_promotion_campaigns(*),
          label_roster_slots(id, slot_number, status)
        `)
        .or(filters.join(","))
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return data as ContractWithRelations[];
    },
  });

  const entityLookup = useMemo(() => {
    const map = new Map<string, ArtistEntity>();
    artistEntities.forEach((entity) => map.set(entity.id, entity));
    return map;
  }, [artistEntities]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Loading your label contracts...
        </CardContent>
      </Card>
    );
  }

  if (!contracts || contracts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No label contracts yet. Explore the directory to request your first deal.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {contracts.map((contract) => {
        const entity = contract.band_id
          ? entityLookup.get(contract.band_id)
          : entityLookup.get(contract.artist_profile_id ?? "");
        const label = contract.labels;
        const advanceAmount = contract.advance_amount ?? 0;
        const recouped = contract.recouped_amount ?? 0;
        const recoupProgress = advanceAmount > 0 ? Math.min((recouped / advanceAmount) * 100, 100) : 100;
        const releaseQuota = contract.release_quota ?? 0;
        const releasesCompleted = contract.releases_completed ?? 0;
        const territoryList = Array.isArray(contract.territories)
          ? (contract.territories as string[])
          : [];

        return (
          <Card key={contract.id}>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">
                  {entity ? `${entity.name}` : "Unassigned entity"} · {label?.name ?? "Unknown label"}
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {label?.headquarters_city ? (
                    <span>{label.headquarters_city}</span>
                  ) : null}
                  <Badge variant="outline">Reputation {label?.reputation_score ?? 0}</Badge>
                  <Badge variant={STATUS_VARIANTS[contract.status ?? "pending"] ?? "secondary"}>
                    {contract.status}
                  </Badge>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Royalty split: {contract.royalty_artist_pct}% artist / {contract.royalty_label_pct}% label
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4" /> Recoupment
                  </div>
                  <Progress value={recoupProgress} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Recouped ${recouped.toLocaleString()}</span>
                    <span>Advance ${advanceAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Layers className="h-4 w-4" /> Release obligations
                  </div>
                  <Progress value={releaseQuota > 0 ? Math.min((releasesCompleted / releaseQuota) * 100, 100) : 100} />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{releasesCompleted} delivered</span>
                    <span>{releaseQuota} required</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Globe2 className="h-4 w-4" /> Territories
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {territoryList.length ? (
                      territoryList.map((territory) => (
                        <Badge key={territory} variant="secondary">
                          {territory}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">Global rights</span>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="font-semibold">Recent activity</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Releases in pipeline</div>
                    <div className="text-sm">
                      {contract.label_releases && contract.label_releases.length > 0
                        ? `${contract.label_releases.length} active release${contract.label_releases.length === 1 ? "" : "s"}`
                        : "No releases scheduled"}
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs uppercase text-muted-foreground">Royalty statements</div>
                    <div className="text-sm">
                      {contract.label_royalty_statements && contract.label_royalty_statements.length > 0
                        ? `${contract.label_royalty_statements.length} statements received`
                        : "Awaiting first statement"}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
