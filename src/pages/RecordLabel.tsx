import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";
import { LabelDirectory } from "@/components/labels/LabelDirectory";
import { MyContractsTab } from "@/components/labels/MyContractsTab";
import { ReleasePipelineTab } from "@/components/labels/ReleasePipelineTab";
import { RoyaltyStatementsTab } from "@/components/labels/RoyaltyStatementsTab";
import { CreateLabelDialog } from "@/components/labels/CreateLabelDialog";
import type { ArtistEntity, DealTypeRow, TerritoryRow } from "@/components/labels/types";

interface ArtistEntitiesResult {
  entities: ArtistEntity[];
  personalBalance: number;
}

const defaultTabs = ["directory", "contracts", "releases", "royalties"] as const;

type RecordLabelTab = (typeof defaultTabs)[number];

const RecordLabel = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const [activeTab, setActiveTab] = useState<RecordLabelTab>("directory");
  const [isCreateLabelOpen, setIsCreateLabelOpen] = useState(false);

  const {
    data: artistData,
    isLoading: loadingEntities,
    error: entityError,
  } = useQuery<ArtistEntitiesResult>({
    queryKey: ["artist-entities", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return {
          entities: [],
          personalBalance: 0,
        } satisfies ArtistEntitiesResult;
      }

      const [{ data: profile }, { data: memberships }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, cash")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("band_members")
          .select("band_id, role, bands(id, name, genre)")
          .eq("user_id", userId),
      ]);

      const entities: ArtistEntity[] = [];

      if (profile) {
        entities.push({
          id: profile.id,
          name: profile.display_name || "Solo career",
          type: "solo",
        });
      }

      memberships?.forEach((membership) => {
        if (!membership.band_id || !membership.bands) return;
        const band = membership.bands as any;
        entities.push({
          id: membership.band_id,
          bandId: membership.band_id,
          name: band.name,
          genre: band.genre,
          role: membership.role,
          type: "band",
        });
      });

      return {
        entities,
        personalBalance: Number(profile?.cash ?? 0),
      } satisfies ArtistEntitiesResult;
    },
  });

  const artistEntities = artistData?.entities ?? [];
  const personalBalance = artistData?.personalBalance ?? 0;
  const minimumLabelBalance = 1_000_000;
  const canCreateLabel = personalBalance >= minimumLabelBalance;
  const formattedPersonalBalance = useMemo(
    () => personalBalance.toLocaleString("en-US"),
    [personalBalance],
  );
  const formattedMinimumBalance = useMemo(
    () => minimumLabelBalance.toLocaleString("en-US"),
    [minimumLabelBalance],
  );

  const {
    data: dealTypes = [],
    isLoading: loadingDealTypes,
    error: dealTypesError,
  } = useQuery<DealTypeRow[]>({
    queryKey: ["label-deal-types"],
    queryFn: async () => {
      const { data, error } = await supabase.from("label_deal_types").select("*").order("name", {
        ascending: true,
      });
      if (error) throw error;
      return data as DealTypeRow[];
    },
  });

  const {
    data: territories = [],
    isLoading: loadingTerritories,
    error: territoriesError,
  } = useQuery<TerritoryRow[]>({
    queryKey: ["label-territories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("territories").select("*").order("name", { ascending: true });
      if (error) throw error;
      return data as TerritoryRow[];
    },
  });

  if (!userId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Please sign in to manage record labels and contracts.
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = loadingEntities || loadingDealTypes || loadingTerritories;
  const hasError = entityError || dealTypesError || territoriesError;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Record label hub</h1>
          <p className="text-muted-foreground">
            Scout label partners, manage release campaigns, and monitor royalties across all your artist projects.
          </p>
          <p className="text-sm text-muted-foreground">
            Launching a label requires at least ${formattedMinimumBalance} in personal funds. Current balance: ${formattedPersonalBalance}.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateLabelOpen(true)}
          className="self-start md:self-auto"
          disabled={!canCreateLabel}
        >
          <Plus className="mr-2 h-4 w-4" /> Launch new label
        </Button>
      </div>

      {hasError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Something went wrong while loading label data. Please refresh and try again.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 p-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing label operations...
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RecordLabelTab)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="directory">Labels</TabsTrigger>
            <TabsTrigger value="contracts">My contracts</TabsTrigger>
            <TabsTrigger value="releases">Releases</TabsTrigger>
            <TabsTrigger value="royalties">Royalties</TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="mt-6">
            <LabelDirectory artistEntities={artistEntities} dealTypes={dealTypes} territories={territories} />
          </TabsContent>

          <TabsContent value="contracts" className="mt-6">
            <MyContractsTab artistEntities={artistEntities} userId={user?.id ?? ""} />
          </TabsContent>

          <TabsContent value="releases" className="mt-6">
            <ReleasePipelineTab artistEntities={artistEntities} territories={territories} />
          </TabsContent>

          <TabsContent value="royalties" className="mt-6">
            <RoyaltyStatementsTab artistEntities={artistEntities} />
          </TabsContent>
        </Tabs>
      )}

      <CreateLabelDialog
        open={isCreateLabelOpen}
        onOpenChange={setIsCreateLabelOpen}
        territories={territories}
        personalBalance={personalBalance}
        minimumBalance={minimumLabelBalance}
      />
    </div>
  );
};

export default RecordLabel;
