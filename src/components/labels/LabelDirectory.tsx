import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Globe2, Rocket, Star } from "lucide-react";
import { RequestContractDialog } from "./RequestContractDialog";
import type {
  ArtistEntity,
  DealTypeRow,
  LabelWithRelations,
  TerritoryRow,
} from "./types";

interface LabelDirectoryProps {
  artistEntities: ArtistEntity[];
  dealTypes: DealTypeRow[];
  territories: TerritoryRow[];
}

export function LabelDirectory({ artistEntities, dealTypes, territories }: LabelDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [territoryFilter, setTerritoryFilter] = useState<string>("all");
  const [reputationFilter, setReputationFilter] = useState<string>("all");
  const [selectedLabel, setSelectedLabel] = useState<LabelWithRelations | null>(null);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);

  const { data: labels, isLoading } = useQuery<LabelWithRelations[]>({
    queryKey: ["labels-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labels")
        .select(`
          *,
          label_roster_slots(*),
          label_territories(territory_code),
          artist_label_contracts(id, status)
        `)
        .order("reputation_score", { ascending: false });

      if (error) {
        throw error;
      }

      return data as LabelWithRelations[];
    },
  });

  const territoryMap = useMemo(() => {
    const map = new Map<string, TerritoryRow>();
    territories.forEach((territory) => map.set(territory.code, territory));
    return map;
  }, [territories]);

  const filteredLabels = useMemo(() => {
    if (!labels) return [];

    return labels.filter((label) => {
      const matchesSearch = label.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTerritory =
        territoryFilter === "all" ||
        label.label_territories?.some((item) => item.territory_code === territoryFilter);

      const matchesReputation =
        reputationFilter === "all" ||
        (reputationFilter === "emerging" && (label.reputation_score ?? 0) < 30) ||
        (reputationFilter === "established" && (label.reputation_score ?? 0) >= 30 && (label.reputation_score ?? 0) < 70) ||
        (reputationFilter === "elite" && (label.reputation_score ?? 0) >= 70);

      return matchesSearch && matchesTerritory && matchesReputation;
    });
  }, [labels, searchTerm, territoryFilter, reputationFilter]);

  const handleRequestContract = (label: LabelWithRelations) => {
    setSelectedLabel(label);
    setIsContractDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="directory">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="directory">Label directory</TabsTrigger>
          <TabsTrigger value="territories">Territorial reach</TabsTrigger>
          <TabsTrigger value="strategies">Strategies & notes</TabsTrigger>
        </TabsList>

        <TabsContent value="directory" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              placeholder="Search by label name"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <Select value={territoryFilter} onValueChange={setTerritoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by territory" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All territories</SelectItem>
                {territories.map((territory) => (
                  <SelectItem key={territory.code} value={territory.code}>
                    {territory.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={reputationFilter} onValueChange={setReputationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Reputation tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tiers</SelectItem>
                <SelectItem value="emerging">Emerging labels</SelectItem>
                <SelectItem value="established">Established players</SelectItem>
                <SelectItem value="elite">Elite powerhouses</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Loading labels...
              </CardContent>
            </Card>
          ) : filteredLabels.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No labels match your filters yet. Adjust your search or create your own label to get started.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredLabels.map((label) => {
                const activeContracts = label.artist_label_contracts?.filter(
                  (contract) => contract.status !== "terminated"
                ).length ?? 0;
                const openSlots = (label.roster_slot_capacity ?? 0) - activeContracts;
                const territoriesDisplay = label.label_territories?.map((item) =>
                  territoryMap.get(item.territory_code)?.name ?? item.territory_code
                );

                return (
                  <Card key={label.id} className="flex flex-col">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">{label.name}</CardTitle>
                          {label.headquarters_city ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Building2 className="h-4 w-4" />
                              <span>{label.headquarters_city}</span>
                            </div>
                          ) : null}
                        </div>
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-4 w-4" />
                          {label.reputation_score ?? 0}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="flex-1 space-y-4">
                      {label.description ? (
                        <p className="text-sm text-muted-foreground">{label.description}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          This label hasn&apos;t published a manifesto yet.
                        </p>
                      )}

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <h4 className="text-sm font-semibold">Roster capacity</h4>
                          <p className="text-sm text-muted-foreground">{label.roster_slot_capacity} total slots</p>
                          <p className="text-sm">
                            <Badge variant={openSlots > 0 ? "outline" : "destructive"}>
                              {openSlots > 0 ? `${openSlots} open` : "Roster full"}
                            </Badge>
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">Marketing budget</h4>
                          <p className="text-sm text-muted-foreground">${label.marketing_budget ?? 0} annual</p>
                          <p className="text-sm text-muted-foreground">Market share: {label.market_share ?? 0}%</p>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Territories</h4>
                        <div className="flex flex-wrap gap-2">
                          {territoriesDisplay?.length ? (
                            territoriesDisplay.map((territory) => (
                              <Badge key={territory} variant="outline" className="gap-1">
                                <Globe2 className="h-3 w-3" />
                                {territory}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">No focus territories yet</span>
                          )}
                        </div>
                      </div>

                      {label.genre_focus?.length ? (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">Genre specialties</h4>
                          <div className="flex flex-wrap gap-2">
                            {label.genre_focus.map((genre) => (
                              <Badge key={genre} variant="secondary">
                                {genre}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </CardContent>

                    <CardFooter className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Rocket className="h-4 w-4" />
                        <span>{activeContracts} artists signed</span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" asChild>
                          <Link to={`/business/labels/${label.id}/dashboard`}>
                            Revenue dashboard
                          </Link>
                        </Button>
                        <Button
                          onClick={() => handleRequestContract(label)}
                          disabled={artistEntities.length === 0}
                        >
                          Request contract
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="territories">
          <Card>
            <CardHeader>
              <CardTitle>Global rollout planning</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-4">
                  {territories.map((territory) => {
                    const labelsInTerritory = labels?.filter((label) =>
                      label.label_territories?.some((item) => item.territory_code === territory.code)
                    );
                    return (
                      <div key={territory.code} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{territory.name}</h3>
                            <p className="text-sm text-muted-foreground">{territory.region}</p>
                          </div>
                          <Badge variant="secondary">{labelsInTerritory?.length ?? 0} active labels</Badge>
                        </div>
                        {labelsInTerritory && labelsInTerritory.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {labelsInTerritory.map((label) => (
                              <Badge key={label.id} variant="outline">
                                {label.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-muted-foreground">
                            No labels have prioritised this territory yet. Opportunity awaits!
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategies">
          <Card>
            <CardHeader>
              <CardTitle>Label strategies & differentiation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                Evaluate labels not only by their royalty splits but by their development support, marketing firepower,
                and territorial strengths. A balanced roster strategy often pairs one elite partner in a core territory
                with regional specialists for niche releases.
              </p>
              <p>
                Consider negotiating advances tied to promotion milestones, and confirm how the label recoups marketing
                spend before agreeing to ambitious campaign budgets. Transparent royalty statements and clear recoupment
                triggers build trust between artist and label.
              </p>
              <p>
                Once you sign, sync your release roadmap with the label&apos;s marketing calendar to maximise pre-release
                momentum. Reserve promotion campaigns for peak windows and coordinate touring to unlock the 360 benefits
                of a top-tier partner.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RequestContractDialog
        open={isContractDialogOpen}
        onOpenChange={setIsContractDialogOpen}
        label={selectedLabel}
        artistEntities={artistEntities}
        dealTypes={dealTypes}
        territories={territories}
      />
    </div>
  );
}
