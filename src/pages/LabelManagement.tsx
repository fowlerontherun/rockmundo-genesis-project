import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Disc, Users, FileText, DollarSign, Music, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VipGate } from "@/components/company/VipGate";
import { LabelRosterTab } from "@/components/labels/management/LabelRosterTab";
import { LabelDemosTab } from "@/components/labels/management/LabelDemosTab";
import { LabelContractsTab } from "@/components/labels/management/LabelContractsTab";
import { LabelReleasesTab } from "@/components/labels/management/LabelReleasesTab";
import { LabelStaffTab } from "@/components/labels/management/LabelStaffTab";
import { LabelFinanceTab } from "@/components/labels/management/LabelFinanceTab";
import { useAuth } from "@/hooks/use-auth-context";

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

export default function LabelManagement() {
  const { labelId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { data: label, isLoading } = useLabelByIdOrCompanyId(labelId);
  const { data: pendingDemoCount = 0 } = useLabelDemoCount(label?.id);
  
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
  
  // Get user profile ID for direct ownership check
  const isDirectOwner = label.owner_id && user && label.owner_id === user.id; // Rough check, real check would need profile ID
  // Check company ownership
  const isCompanyOwner = label.companies?.owner_id === user?.id;
  const isPlayerOwned = isDirectOwner || isCompanyOwner;
  
  return (
    <VipGate feature="Record Label" description="Manage your record label, sign artists, and oversee releases.">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Disc className="h-6 w-6" />
              {label.name}
              {isPlayerOwned && (
                <Crown className="h-5 w-5 text-warning" />
              )}
            </h1>
            <p className="text-muted-foreground">
              {label.genre_focus?.join(', ') || 'All Genres'}
            </p>
          </div>
        </div>

        <Tabs defaultValue="roster" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="roster" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Roster</span>
            </TabsTrigger>
            <TabsTrigger value="demos" className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              <span className="hidden sm:inline">Demos</span>
              {pendingDemoCount > 0 && (
                <span className="ml-1 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full">
                  {pendingDemoCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Contracts</span>
            </TabsTrigger>
            <TabsTrigger value="releases" className="flex items-center gap-2">
              <Disc className="h-4 w-4" />
              <span className="hidden sm:inline">Releases</span>
            </TabsTrigger>
            <TabsTrigger value="staff" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Staff</span>
            </TabsTrigger>
            <TabsTrigger value="finances" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Finances</span>
            </TabsTrigger>
          </TabsList>
          
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
