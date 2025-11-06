import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ArtistEntity, RoyaltyStatementWithRelations } from "./types";

interface RoyaltyStatementsTabProps {
  artistEntities: ArtistEntity[];
}

export function RoyaltyStatementsTab({ artistEntities }: RoyaltyStatementsTabProps) {
  const soloEntity = artistEntities.find((entity) => entity.type === "solo");
  const bandEntities = artistEntities.filter((entity) => entity.type === "band");

  const { data: statements, isLoading } = useQuery<RoyaltyStatementWithRelations[]>({
    queryKey: ["label-royalty-statements", soloEntity?.id, bandEntities.map((band) => band.id).join(",")],
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

      const { data: contracts, error: contractsError } = await supabase
        .from("artist_label_contracts")
        .select(`id`)
        .or(filters.join(","));

      if (contractsError) {
        throw contractsError;
      }

      const contractIds = contracts?.map((contract) => contract.id) ?? [];
      if (contractIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from("label_royalty_statements")
        .select(`
          *,
          contract:artist_label_contracts(
            id,
            label_id,
            band_id,
            artist_profile_id,
            advance_amount,
            recouped_amount,
            royalty_artist_pct,
            labels(id, name)
          ),
          release:label_releases(id, title, release_type, release_date)
        `)
        .in("contract_id", contractIds)
        .order("period_end", { ascending: false });

      if (error) {
        throw error;
      }

      return data as RoyaltyStatementWithRelations[];
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
          Loading royalty statements...
        </CardContent>
      </Card>
    );
  }

  if (!statements || statements.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No royalty statements available yet. Releases must go live before statements are generated.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Statement summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Royalty statements detail the revenue split for each accounting period. Advances are recouped against artist
            share until the balance reaches zero, after which full payouts resume.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Contract</TableHead>
                <TableHead>Release</TableHead>
                <TableHead className="text-right">Artist share</TableHead>
                <TableHead className="text-right">Label share</TableHead>
                <TableHead className="text-right">Recoup balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statements.map((statement) => {
                const contract = statement.contract;
                const release = statement.release;
                const entityId = contract?.band_id ?? contract?.artist_profile_id ?? "";
                const entity = entityLookup.get(entityId);
                const advanceAmount = contract?.advance_amount ?? 0;
                const recouped = contract?.recouped_amount ?? 0;
                const remaining = Math.max(advanceAmount - recouped, 0);

                return (
                  <TableRow key={statement.id}>
                    <TableCell>
                      <div className="text-sm font-medium">
                        {new Date(statement.period_start).toLocaleDateString()} – {new Date(statement.period_end).toLocaleDateString()}
                      </div>
                      {entity ? (
                        <div className="text-xs text-muted-foreground">{entity.name}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{contract?.labels?.name ?? "Label"}</div>
                      <div className="text-xs text-muted-foreground">
                        Split {contract?.royalty_artist_pct ?? 0}% / {100 - (contract?.royalty_artist_pct ?? 0)}%
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{release?.title ?? "Unassigned"}</div>
                      <div className="text-xs text-muted-foreground">{release?.release_type ?? "-"}</div>
                    </TableCell>
                    <TableCell className="text-right">${statement.artist_share?.toLocaleString() ?? "0"}</TableCell>
                    <TableCell className="text-right">${statement.label_share?.toLocaleString() ?? "0"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        ${remaining.toLocaleString()}
                        <Badge variant={remaining === 0 ? "default" : "secondary"}>
                          {remaining === 0 ? "Recouped" : "Outstanding"}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-3 text-sm text-muted-foreground">
        <p>
          Keep an eye on recoupment balances, especially when accepting large promotion budgets or tour support from your
          label partner. Request an audit if statements look off—transparency is key to long-term trust.
        </p>
      </div>
    </div>
  );
}
