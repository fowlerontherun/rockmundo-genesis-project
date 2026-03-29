import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Disc, Users, FileText, DollarSign, Music, Crown,
  Megaphone, Star, TrendingUp, Globe2, Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VipGate } from "@/components/company/VipGate";
import { LabelRosterTab } from "@/components/labels/management/LabelRosterTab";
import { LabelDemosTab } from "@/components/labels/management/LabelDemosTab";
import { LabelContractsTab } from "@/components/labels/management/LabelContractsTab";
import { LabelReleasesTab } from "@/components/labels/management/LabelReleasesTab";
import { LabelStaffTab } from "@/components/labels/management/LabelStaffTab";
import { LabelFinanceTab } from "@/components/labels/management/LabelFinanceTab";
import { LabelMarketingBudgetCard } from "@/components/labels/management/LabelMarketingBudgetCard";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { cn } from "@/lib/utils";

function useLabelByIdOrCompanyId(idOrCompanyId: string | undefined) {
  return useQuery({
    queryKey: ['label-management', idOrCompanyId],
    queryFn: async () => {
      if (!idOrCompanyId) return null;
      
      const { data, error } = await supabase
        .from('labels')
        .select(`
          *,
          cities:headquarters_city_id(name, country),
          companies!labels_company_id_fkey(owner_id)
        `)
        .or(`id.eq.${idOrCompanyId},company_id.eq.${idOrCompanyId}`)
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!idOrCompanyId,
  });
}

function useLabelDemoCount(labelId: string | undefined) {
  return useQuery({
    queryKey: ['label-demo-count', labelId],
    queryFn: async () => {
      if (!labelId) return 0;
      const { count } = await supabase
        .from('demo_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('label_id', labelId)
        .eq('status', 'pending');
      return count || 0;
    },
    enabled: !!labelId,
  });
}

function usePendingContractCount(labelId: string | undefined) {
  return useQuery({
    queryKey: ['label-pending-contract-count', labelId],
    queryFn: async () => {
      if (!labelId) return 0;
      const { count } = await supabase
        .from('artist_label_contracts')
        .select('*', { count: 'exact', head: true })
        .eq('label_id', labelId)
        .eq('status', 'offered');
      return count || 0;
    },
    enabled: !!labelId,
  });
}

function useLabelOverviewStats(labelId: string | undefined) {
  return useQuery({
    queryKey: ['label-overview-stats', labelId],
    queryFn: async () => {
      if (!labelId) return null;

      // Active contracts count
      const { count: activeArtists } = await supabase
        .from('artist_label_contracts')
        .select('*', { count: 'exact', head: true })
        .eq('label_id', labelId)
        .eq('status', 'active');

      // Releases count
      const { data: contracts } = await supabase
        .from('artist_label_contracts')
        .select('id')
        .eq('label_id', labelId);
      const contractIds = contracts?.map(c => c.id) || [];

      let totalReleases = 0;
      let releasedCount = 0;
      let totalUnits = 0;
      let totalRevenue = 0;

      if (contractIds.length > 0) {
        const { data: releases } = await supabase
          .from('label_releases')
          .select('id, status, units_sold, revenue_generated')
          .in('contract_id', contractIds);

        totalReleases = releases?.length || 0;
        releasedCount = releases?.filter(r => r.status === 'released').length || 0;
        totalUnits = releases?.reduce((s, r) => s + (r.units_sold ?? 0), 0) || 0;
        totalRevenue = releases?.reduce((s, r) => s + (r.revenue_generated ?? 0), 0) || 0;
      }

      // Staff count
      const { count: staffCount } = await supabase
        .from('label_staff')
        .select('*', { count: 'exact', head: true })
        .eq('label_id', labelId);

      return {
        activeArtists: activeArtists || 0,
        totalReleases,
        releasedCount,
        totalUnits,
        totalRevenue,
        staffCount: staffCount || 0,
      };
    },
    enabled: !!labelId,
  });
}

export default function LabelManagement() {
  const { labelId } = useParams();
  const navigate = useNavigate();
  const { profileId } = useActiveProfile();
  
  const { data: label, isLoading } = useLabelByIdOrCompanyId(labelId);
  const { data: pendingDemoCount = 0 } = useLabelDemoCount(label?.id);
  const { data: pendingContractCount = 0 } = usePendingContractCount(label?.id);
  const { data: stats } = useLabelOverviewStats(label?.id);
  
  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }
  
  if (!label) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <Disc className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Record Label Not Found</h2>
          <p className="text-muted-foreground mb-4">The record label you're looking for doesn't exist or you don't have access.</p>
          <Button onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </div>
    );
  }
  
  const isDirectOwner = label.owner_id && profileId && label.owner_id === profileId;
  const isCompanyOwner = label.companies?.owner_id === profileId;
  const isPlayerOwned = isDirectOwner || isCompanyOwner;
  const city = label.cities as any;

  const getHealthColor = () => {
    if (label.is_bankrupt) return "text-destructive";
    if (label.balance < 0) return "text-destructive";
    if (label.balance < 100_000) return "text-amber-500";
    return "text-emerald-500";
  };

  const getReputationTier = (rep: number) => {
    if (rep >= 80) return { label: "Legendary", color: "text-amber-400" };
    if (rep >= 60) return { label: "Major", color: "text-purple-400" };
    if (rep >= 40) return { label: "Established", color: "text-blue-400" };
    if (rep >= 20) return { label: "Growing", color: "text-emerald-400" };
    return { label: "Indie", color: "text-muted-foreground" };
  };

  const repTier = getReputationTier(label.reputation_score || 0);
  
  return (
    <VipGate feature="Record Label" description="Manage your record label, sign artists, and oversee releases.">
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mt-1 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 truncate">
                <Disc className="h-5 w-5 shrink-0 text-primary" />
                {label.name}
              </h1>
              {isPlayerOwned && <Crown className="h-4 w-4 text-warning shrink-0" />}
              <Badge variant="outline" className={cn("text-[10px] shrink-0", repTier.color)}>
                <Star className="h-3 w-3 mr-0.5" />
                {repTier.label} ({label.reputation_score || 0})
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
              {label.genre_focus?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Music className="h-3 w-3" />
                  {label.genre_focus.join(', ')}
                </span>
              )}
              {city?.name && (
                <span className="flex items-center gap-1">
                  <Globe2 className="h-3 w-3" />
                  {city.name}, {city.country}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Overview Stats Bar */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          <Card className="bg-card/60">
            <CardContent className="p-2.5 text-center">
              <DollarSign className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
              <p className={cn("text-sm font-bold tabular-nums", getHealthColor())}>
                ${Math.abs(label.balance).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground">Balance</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60">
            <CardContent className="p-2.5 text-center">
              <Users className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
              <p className="text-sm font-bold">{stats?.activeArtists ?? 0} / {label.roster_slot_capacity || 5}</p>
              <p className="text-[10px] text-muted-foreground">Artists</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60">
            <CardContent className="p-2.5 text-center">
              <Disc className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
              <p className="text-sm font-bold">{stats?.releasedCount ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Released</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60">
            <CardContent className="p-2.5 text-center">
              <TrendingUp className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
              <p className="text-sm font-bold tabular-nums">{(stats?.totalUnits ?? 0).toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Units Sold</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60">
            <CardContent className="p-2.5 text-center">
              <DollarSign className="h-3.5 w-3.5 mx-auto mb-0.5 text-emerald-500" />
              <p className="text-sm font-bold tabular-nums text-emerald-500">${(stats?.totalRevenue ?? 0).toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">Revenue</p>
            </CardContent>
          </Card>
          <Card className="bg-card/60">
            <CardContent className="p-2.5 text-center">
              <Building2 className="h-3.5 w-3.5 mx-auto mb-0.5 text-muted-foreground" />
              <p className="text-sm font-bold">{stats?.staffCount ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">Staff</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="roster" className="space-y-4">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex w-auto min-w-full">
              <TabsTrigger value="roster" className="flex items-center gap-1 text-xs">
                <Users className="h-3.5 w-3.5" />
                Roster
              </TabsTrigger>
              <TabsTrigger value="demos" className="flex items-center gap-1 text-xs">
                <Music className="h-3.5 w-3.5" />
                Demos
                {pendingDemoCount > 0 && (
                  <span className="ml-0.5 bg-destructive text-destructive-foreground text-[9px] px-1 py-0 rounded-full leading-tight">
                    {pendingDemoCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="contracts" className="flex items-center gap-1 text-xs">
                <FileText className="h-3.5 w-3.5" />
                Contracts
                {pendingContractCount > 0 && (
                  <span className="ml-0.5 bg-amber-500 text-amber-950 text-[9px] px-1 py-0 rounded-full leading-tight">
                    {pendingContractCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="releases" className="flex items-center gap-1 text-xs">
                <Disc className="h-3.5 w-3.5" />
                Releases
              </TabsTrigger>
              <TabsTrigger value="marketing" className="flex items-center gap-1 text-xs">
                <Megaphone className="h-3.5 w-3.5" />
                Marketing
              </TabsTrigger>
              <TabsTrigger value="staff" className="flex items-center gap-1 text-xs">
                <Building2 className="h-3.5 w-3.5" />
                Staff
              </TabsTrigger>
              <TabsTrigger value="finances" className="flex items-center gap-1 text-xs">
                <DollarSign className="h-3.5 w-3.5" />
                Finances
              </TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          
          <TabsContent value="roster">
            <LabelRosterTab labelId={label.id} rosterCapacity={label.roster_slot_capacity || 5} labelReputation={label.reputation_score || 0} />
          </TabsContent>
          
          <TabsContent value="demos">
            <LabelDemosTab 
              labelId={label.id} 
              labelReputation={label.reputation_score || 0}
              genreFocus={label.genre_focus}
              isPlayerOwned={!!isPlayerOwned}
            />
          </TabsContent>
          
          <TabsContent value="contracts">
            <LabelContractsTab labelId={label.id} />
          </TabsContent>

          <TabsContent value="releases">
            <LabelReleasesTab labelId={label.id} />
          </TabsContent>

          <TabsContent value="marketing">
            <LabelMarketingBudgetCard labelId={label.id} labelBalance={label.balance} />
          </TabsContent>

          <TabsContent value="staff">
            <LabelStaffTab labelId={label.id} labelBalance={label.balance} />
          </TabsContent>
          
          <TabsContent value="finances">
            <LabelFinanceTab 
              labelId={label.id} 
              labelBalance={label.balance}
              isBankrupt={label.is_bankrupt}
              balanceWentNegativeAt={label.balance_went_negative_at}
            />
          </TabsContent>
        </Tabs>
      </div>
    </VipGate>
  );
}
