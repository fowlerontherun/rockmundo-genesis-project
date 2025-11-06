import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, DollarSign, Rocket } from "lucide-react";
import type { ArtistEntity, ContractWithRelations, ReleaseWithRelations, TerritoryRow } from "./types";
import { CreateLabelReleaseDialog } from "./CreateLabelReleaseDialog";
import { CreatePromotionDialog } from "./CreatePromotionDialog";

interface ReleasePipelineTabProps {
  artistEntities: ArtistEntity[];
  territories: TerritoryRow[];
}

const STATUS_BADGES: Record<string, "outline" | "secondary" | "default"> = {
  planning: "outline",
  manufacturing: "secondary",
  released: "default",
};

export function ReleasePipelineTab({ artistEntities, territories }: ReleasePipelineTabProps) {
  const soloEntity = artistEntities.find((entity) => entity.type === "solo");
  const bandEntities = artistEntities.filter((entity) => entity.type === "band");
  const [createReleaseOpen, setCreateReleaseOpen] = useState(false);
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<ReleaseWithRelations | null>(null);

  const { data, isLoading } = useQuery<{ contracts: ContractWithRelations[]; releases: ReleaseWithRelations[] }>({
    queryKey: ["label-releases", soloEntity?.id, bandEntities.map((band) => band.id).join(",")],
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
        return { contracts: [], releases: [] };
      }

      const { data: contracts, error: contractsError } = await supabase
        .from("artist_label_contracts")
        .select(`
          *,
          labels(id, name, reputation_score),
          label_releases(id),
          label_royalty_statements(id)
        `)
        .or(filters.join(","));

      if (contractsError) {
        throw contractsError;
      }

      const contractIds = contracts?.map((contract) => contract.id) ?? [];
      if (contractIds.length === 0) {
        return { contracts: contracts as ContractWithRelations[], releases: [] };
      }

      const { data: releases, error: releasesError } = await supabase
        .from("label_releases")
        .select(`
          *,
          contract:artist_label_contracts(
            id,
            label_id,
            band_id,
            artist_profile_id,
            status,
            releases_completed,
            release_quota,
            labels(id, name, reputation_score)
          ),
          label_promotion_campaigns(*)
        `)
        .in("contract_id", contractIds)
        .order("scheduled_date", { ascending: true });

      if (releasesError) {
        throw releasesError;
      }

      return {
        contracts: contracts as ContractWithRelations[],
        releases: releases as ReleaseWithRelations[],
      };
    },
  });

  const contracts = useMemo(() => data?.contracts ?? [], [data]);
  const releases = useMemo(() => data?.releases ?? [], [data]);

  const contractLookup = useMemo(() => {
    const map = new Map<string, ContractWithRelations>();
    contracts.forEach((contract) => map.set(contract.id, contract));
    return map;
  }, [contracts]);

  const handleOpenPromotionDialog = (release: ReleaseWithRelations) => {
    setSelectedRelease(release);
    setPromotionDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Loading release pipeline...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Release pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Coordinate manufacturing, promotion, and territory rollout for every signed contract.
          </p>
        </div>
        <Button onClick={() => setCreateReleaseOpen(true)}>Plan new release</Button>
      </div>

      {releases.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No upcoming releases yet. Start by planning a new single or album for your active contracts.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {releases.map((release) => {
            const contract = contractLookup.get(release.contract_id) ?? release.contract ?? null;
            return (
              <Card key={release.id} className="flex flex-col">
                <CardHeader className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <CardTitle>{release.title}</CardTitle>
                    <Badge variant={STATUS_BADGES[release.status ?? "planning"] ?? "outline"}>
                      {release.status ?? "planning"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span>{release.release_type}</span>
                    {contract?.labels?.name ? <span>· {contract.labels.name}</span> : null}
                    {contract?.releases_completed !== undefined && contract?.release_quota !== undefined ? (
                      <span>
                        · {contract.releases_completed}/{contract.release_quota} releases delivered
                      </span>
                    ) : null}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <CalendarDays className="h-4 w-4" /> Schedule
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Planned {release.scheduled_date ? new Date(release.scheduled_date).toLocaleDateString() : "TBD"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Release actual: {release.release_date ? new Date(release.release_date).toLocaleDateString() : "Pending"}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <DollarSign className="h-4 w-4" /> Budget
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Promotion budget ${release.promotion_budget?.toLocaleString() ?? "0"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Masters cost ${release.masters_cost?.toLocaleString() ?? "0"}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Rocket className="h-4 w-4" /> Promotion campaigns
                    </div>
                    {release.label_promotion_campaigns && release.label_promotion_campaigns.length > 0 ? (
                      <ScrollArea className="h-24 rounded-md border">
                        <div className="space-y-2 p-3 text-sm">
                          {release.label_promotion_campaigns.map((campaign) => (
                            <div key={campaign.id} className="rounded-md bg-muted/40 p-2">
                              <div className="font-semibold">{campaign.campaign_type}</div>
                              <div className="text-xs text-muted-foreground">
                                Budget ${campaign.budget?.toLocaleString() ?? 0} · Channels: {campaign.channels?.join(", ") ?? "-"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="text-xs text-muted-foreground">No campaigns scheduled yet.</div>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleOpenPromotionDialog(release)}>
                      Add promotion campaign
                    </Button>
                  </div>

                  {release.territory_strategy && Array.isArray(release.territory_strategy) ? (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Territory rollout</div>
                      <div className="flex flex-wrap gap-2">
                        {(release.territory_strategy as string[]).map((code) => {
                          const territory = territories.find((item) => item.code === code);
                          return (
                            <Badge key={code} variant="outline">
                              {territory ? territory.name : code}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {release.notes ? (
                    <div className="rounded-md border p-3 text-sm">
                      <div className="text-xs uppercase text-muted-foreground">Notes</div>
                      <p>{release.notes}</p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateLabelReleaseDialog
        open={createReleaseOpen}
        onOpenChange={setCreateReleaseOpen}
        contracts={contracts}
        territories={territories}
      />

      <CreatePromotionDialog
        open={promotionDialogOpen}
        onOpenChange={setPromotionDialogOpen}
        release={selectedRelease}
      />
    </div>
  );
}
