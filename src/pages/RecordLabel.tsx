import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useVipStatus } from "@/hooks/useVipStatus";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Scale, Crown, Lock } from "lucide-react";
import { LabelDirectory } from "@/components/labels/LabelDirectory";
import { MyContractsTab } from "@/components/labels/MyContractsTab";
import { ReleasePipelineTab } from "@/components/labels/ReleasePipelineTab";
import { RoyaltyStatementsTab } from "@/components/labels/RoyaltyStatementsTab";
import { CreateLabelDialog } from "@/components/labels/CreateLabelDialog";
import { HireLawyerDialog } from "@/components/labels/HireLawyerDialog";
import { MyLabelsTab } from "@/components/labels/MyLabelsTab";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ArtistEntity, DealTypeRow, TerritoryRow } from "@/components/labels/types";

interface ArtistEntitiesResult {
  entities: ArtistEntity[];
  personalBalance: number;
  hasActiveLawyer: boolean;
}

const defaultTabs = ["my-labels", "directory", "contracts", "releases", "royalties"] as const;

type RecordLabelTab = (typeof defaultTabs)[number];

const RecordLabel = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const { data: vipStatus } = useVipStatus();
  const isVip = vipStatus?.isVip ?? false;
  const [activeTab, setActiveTab] = useState<RecordLabelTab>("my-labels");
  const [isCreateLabelOpen, setIsCreateLabelOpen] = useState(false);
  const [isHireLawyerOpen, setIsHireLawyerOpen] = useState(false);

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
          hasActiveLawyer: false,
        } satisfies ArtistEntitiesResult;
      }

      const [{ data: profile }, { data: memberships }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, display_name, cash, has_active_lawyer")
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
        hasActiveLawyer: profile?.has_active_lawyer ?? false,
      } satisfies ArtistEntitiesResult;
    },
  });

  const artistEntities = artistData?.entities ?? [];
  const personalBalance = artistData?.personalBalance ?? 0;
  const hasActiveLawyer = artistData?.hasActiveLawyer ?? false;
  const minimumLabelBalance = 1_000_000;
  const canCreateLabel = personalBalance >= minimumLabelBalance && isVip;
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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Record label hub</h1>
          <p className="text-muted-foreground">
            Scout label partners, manage release campaigns, and monitor royalties across all your artist projects.
          </p>
          <p className="text-sm text-muted-foreground">
            Launching a label requires at least ${formattedMinimumBalance} in personal funds. Current balance: ${formattedPersonalBalance}.
          </p>
        </div>
      </div>

      {/* Deal Types Explained */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-xl font-semibold mb-4">Understanding Record Deal Types</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-4 rounded-lg bg-muted/50 border">
              <h3 className="font-semibold text-primary mb-2">🎯 360 Deal</h3>
              <p className="text-sm text-muted-foreground mb-2">
                The label takes a cut of <strong>everything</strong> — music, merch, tours, endorsements.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Best for:</strong> New artists needing major investment<br/>
                <strong>Artist cut:</strong> 10-20% | <strong>Advance:</strong> $50K-500K+
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 border">
              <h3 className="font-semibold text-primary mb-2">📦 Distribution Deal</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Label just gets your music into stores/streaming. You keep more royalties but handle your own marketing.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Best for:</strong> Independent artists with existing fanbase<br/>
                <strong>Artist cut:</strong> 70-85% | <strong>Advance:</strong> $0-50K
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 border">
              <h3 className="font-semibold text-primary mb-2">📝 Licensing Deal</h3>
              <p className="text-sm text-muted-foreground mb-2">
                You license specific songs for a set period. You keep ownership and get the masters back later.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Best for:</strong> Testing the waters with a label<br/>
                <strong>Artist cut:</strong> 40-60% | <strong>Advance:</strong> $10K-100K
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 border">
              <h3 className="font-semibold text-primary mb-2">🎛️ Production Deal</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Label helps make your music (studio time, producers) and distributes it. Middle ground between full label and DIY.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Best for:</strong> Artists needing production support<br/>
                <strong>Artist cut:</strong> 30-50% | <strong>Advance:</strong> $20K-150K
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50 border">
              <h3 className="font-semibold text-primary mb-2">📀 Standard Deal</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Traditional record deal — they fund recording, own the masters, handle distribution. Classic artist-label relationship.
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Best for:</strong> Artists wanting label resources<br/>
                <strong>Artist cut:</strong> 15-25% | <strong>Advance:</strong> $25K-300K
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        {/* Hire Lawyer Button - VIP only */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setIsHireLawyerOpen(true)}
                disabled={!isVip}
                className={cn(
                  "relative overflow-hidden",
                  isVip 
                    ? "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-600 hover:via-yellow-500 hover:to-amber-600 text-amber-950 font-semibold shadow-lg"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isVip && (
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    style={{ animation: "shimmer 2s infinite linear" }}
                  />
                )}
                <Scale className="mr-2 h-4 w-4 relative z-10" />
                <span className="relative z-10">
                  {hasActiveLawyer ? "Lawyer Active" : "Hire Lawyer"}
                </span>
                <Crown className="ml-2 h-3 w-3 relative z-10" />
              </Button>
            </TooltipTrigger>
            {!isVip && (
              <TooltipContent className="bg-gradient-to-r from-amber-900 to-yellow-900 border-amber-500/50">
                <p className="text-amber-100">VIP feature - Upgrade to hire a lawyer</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {/* Launch Label Button - VIP only */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => setIsCreateLabelOpen(true)}
                disabled={!canCreateLabel}
                className={cn(
                  "relative overflow-hidden",
                  isVip 
                    ? "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-600 hover:via-yellow-500 hover:to-amber-600 text-amber-950 font-semibold shadow-lg"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {isVip && (
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    style={{ animation: "shimmer 2s infinite linear" }}
                  />
                )}
                <Plus className="mr-2 h-4 w-4 relative z-10" />
                <span className="relative z-10">Launch new label</span>
                <Crown className="ml-2 h-3 w-3 relative z-10" />
                {!isVip && <Lock className="ml-1 h-3 w-3 relative z-10" />}
              </Button>
            </TooltipTrigger>
            {!isVip ? (
              <TooltipContent className="bg-gradient-to-r from-amber-900 to-yellow-900 border-amber-500/50">
                <p className="text-amber-100">VIP feature - Upgrade to launch your own label</p>
              </TooltipContent>
            ) : !canCreateLabel && personalBalance < minimumLabelBalance ? (
              <TooltipContent>
                <p>Need ${formattedMinimumBalance} to launch a label</p>
              </TooltipContent>
            ) : null}
          </Tooltip>
        </TooltipProvider>
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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="my-labels">My Labels</TabsTrigger>
            <TabsTrigger value="directory">Browse</TabsTrigger>
            <TabsTrigger value="contracts">Contracts</TabsTrigger>
            <TabsTrigger value="releases">Releases</TabsTrigger>
            <TabsTrigger value="royalties">Royalties</TabsTrigger>
          </TabsList>

          <TabsContent value="my-labels" className="mt-6">
            <MyLabelsTab />
          </TabsContent>

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

      <HireLawyerDialog
        open={isHireLawyerOpen}
        onOpenChange={setIsHireLawyerOpen}
        userId={userId}
        currentBalance={personalBalance}
        hasActiveLawyer={hasActiveLawyer}
      />
    </div>
  );
};

export default RecordLabel;
