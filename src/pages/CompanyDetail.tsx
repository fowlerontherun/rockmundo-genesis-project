import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { 
  Building2, ArrowLeft, DollarSign, Users, MapPin, 
  TrendingUp, Settings, Plus, Disc, AlertTriangle,
  Calendar, ChevronRight, Wallet, Briefcase, Sparkles, Swords, Trophy, BarChart3, Newspaper
} from "lucide-react";
import { CompanyNewsFeed } from "@/components/company/CompanyNewsFeed";
import { CompanyContractBoard } from "@/components/company/CompanyContractBoard";
import { CompanyEventsTimeline } from "@/components/company/CompanyEventsTimeline";
import { CompanyRivalries } from "@/components/company/CompanyRivalries";
import { MarketRankings } from "@/components/company/MarketRankings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { VipGate } from "@/components/company/VipGate";
import { SubsidiaryTree } from "@/components/company/SubsidiaryTree";
import { CreateCompanyDialog } from "@/components/company/CreateCompanyDialog";
import { CompanySettingsDialog } from "@/components/company/CompanySettingsDialog";
import { TransferLabelDialog } from "@/components/company/TransferLabelDialog";
import { CompanyFinanceDialog } from "@/components/company/CompanyFinanceDialog";
import { CompanyTaxOverview } from "@/components/company/CompanyTaxOverview";
import { PlayerStaffBonusCard } from "@/components/company/PlayerStaffBonusCard";
import { EmpireDashboard } from "@/components/company/EmpireDashboard";
import { CompanySharesPanel } from "@/components/company/CompanySharesPanel";
import { CompanyRecruitmentLifecycle } from "@/components/company/CompanyRecruitmentLifecycle";
import { CompanyWeeklyFinancePanel } from "@/components/company/CompanyWeeklyFinancePanel";
import { CompanyStorefrontManager } from "@/components/company/CompanyStorefrontManager";
import { CompanyAnalytics } from "@/components/company/CompanyAnalytics";
import { useCompany, useCompanySubsidiaries } from "@/hooks/useCompanies";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useCompanyLabels, useUnlinkedOwnedLabels } from "@/hooks/useCompanyLabels";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompanyTransactions } from "@/hooks/useCompanyFinance";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { FMPageSkeleton } from "@/components/fm/FMPageSkeleton";
import { COMPANY_TYPE_INFO } from "@/types/company";
import type { Company } from "@/types/company";
import { formatDistanceToNow, format } from "date-fns";

const CompanyDetailContent = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [financeDialogOpen, setFinanceDialogOpen] = useState(false);
  const { userId, profileId } = useActiveProfile();
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useCompany(companyId);
  const { data: subsidiaries = [], isLoading: subsLoading } = useCompanySubsidiaries(
    company?.company_type === 'holding' ? companyId : undefined
  );
  const { data: labels = [] } = useCompanyLabels(companyId);
  const { data: unlinkedLabels = [] } = useUnlinkedOwnedLabels(profileId);
  const { data: transactions = [] } = useCompanyTransactions(companyId);

  const linkLabelMutation = useMutation({
    mutationFn: async (labelId: string) => {
      if (!companyId) throw new Error("Missing company");
      const { error } = await (supabase as any).rpc("link_label_to_company", {
        p_label_id: labelId,
        p_company_id: companyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Label linked to company");
      queryClient.invalidateQueries({ queryKey: ["company-labels", companyId] });
      queryClient.invalidateQueries({ queryKey: ["unlinked-owned-labels", profileId] });
      queryClient.invalidateQueries({ queryKey: ["company", companyId] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to link label"),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <FMPageScaffold title="Company" icon={Building2} backTo="/my-companies">
        <FMPageSkeleton kpiCount={4} actionCount={2} bodyBlocks={1} showTabs />
      </FMPageScaffold>
    );
  }

  if (!company) {
    return (
      <FMPageScaffold title="Company Not Found" icon={Building2} backTo="/my-companies">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-semibold">Company Not Found</h3>
            <p className="text-muted-foreground mb-4">
              The company you're looking for doesn't exist or you don't have access.
            </p>
            <Button onClick={() => navigate("/my-companies")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Companies
            </Button>
          </CardContent>
        </Card>
      </FMPageScaffold>
    );
  }

  const typeInfo = COMPANY_TYPE_INFO[company.company_type];
  const isHolding = company.company_type === 'holding';

  const handleCompanyClick = (c: Company) => {
    navigate(`/company/${c.id}`);
  };

  return (
    <FMPageScaffold
      title={company.name}
      subtitle={typeInfo.label}
      icon={Building2}
      backTo="/my-companies"
      headerActions={
        <div className="flex items-center gap-2">
          {company.is_bankrupt && (
            <Badge variant="destructive">Bankrupt</Badge>
          )}
          <CompanySettingsDialog company={company} />
          {isHolding && (
            <CreateCompanyDialog
              parentCompanyId={company.id}
              trigger={
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subsidiary
                </Button>
              }
            />
          )}
        </div>
      }
    >


      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${company.balance < 0 ? 'text-destructive' : ''}`}>
              {formatCurrency(company.balance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Weekly costs: {formatCurrency(company.weekly_operating_costs)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reputation</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{company.reputation_score}</div>
            <p className="text-xs text-muted-foreground">Industry standing</p>
          </CardContent>
        </Card>

        {company.headquarters_city && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Headquarters</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">{company.headquarters_city.name}</div>
              <p className="text-xs text-muted-foreground">{company.headquarters_city.country}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Founded</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {format(new Date(company.founded_at), "MMM yyyy")}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(company.founded_at), { addSuffix: true })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue={isHolding ? "structure" : "empire"} className="space-y-4">
        <TabsList>
          {isHolding && <TabsTrigger value="structure">Structure</TabsTrigger>}
          <TabsTrigger value="empire">Empire</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="labels">Labels ({labels.length})</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="jobs">
            <Briefcase className="h-3.5 w-3.5 mr-1" />
            Recruitment
          </TabsTrigger>
          <TabsTrigger value="storefront">Storefront</TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-3.5 w-3.5 mr-1" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="finances">Finances</TabsTrigger>
          <TabsTrigger value="shares">Shares</TabsTrigger>
          <TabsTrigger value="contracts">
            <Briefcase className="h-3.5 w-3.5 mr-1" />
            Contracts
          </TabsTrigger>
          <TabsTrigger value="events">
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Events
          </TabsTrigger>
          <TabsTrigger value="news">
            <Newspaper className="h-3.5 w-3.5 mr-1" />
            News
          </TabsTrigger>
          <TabsTrigger value="rivalries">
            <Swords className="h-3.5 w-3.5 mr-1" />
            Rivalries
          </TabsTrigger>
          <TabsTrigger value="rankings">
            <Trophy className="h-3.5 w-3.5 mr-1" />
            Rankings
          </TabsTrigger>
        </TabsList>

        {isHolding && (
          <TabsContent value="structure" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-2">
              <SubsidiaryTree
                holdingCompany={company}
                subsidiaries={subsidiaries}
                onCompanyClick={handleCompanyClick}
                onAddSubsidiary={() => {}}
              />
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                  <CardDescription>Manage your corporate structure</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <CreateCompanyDialog
                    parentCompanyId={company.id}
                    trigger={
                      <Button className="w-full justify-start" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Create New Subsidiary
                        <ChevronRight className="h-4 w-4 ml-auto" />
                      </Button>
                    }
                  />
                  <TransferLabelDialog
                    holdingCompanies={[company]}
                    trigger={
                      <Button className="w-full justify-start" variant="outline">
                        <Disc className="h-4 w-4 mr-2" />
                        Transfer Existing Label
                        <ChevronRight className="h-4 w-4 ml-auto" />
                      </Button>
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        <TabsContent value="empire" className="space-y-4">
          <EmpireDashboard companyId={company.id} companyBalance={company.balance} />
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
            </CardHeader>
            <CardContent>
              {company.description ? (
                <p className="text-muted-foreground">{company.description}</p>
              ) : (
                <p className="text-muted-foreground italic">No description set.</p>
              )}
            </CardContent>
          </Card>

          {company.parent_company && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Parent Company</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => navigate(`/company/${company.parent_company!.id}`)}
                >
                  <Building2 className="h-4 w-4 mr-2 text-primary" />
                  {company.parent_company.name}
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="labels" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Record Labels</CardTitle>
                <CardDescription>Labels owned by this company</CardDescription>
              </div>
              {isHolding && (
                <TransferLabelDialog
                  holdingCompanies={[company]}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Label
                    </Button>
                  }
                />
              )}
            </CardHeader>
            <CardContent>
              {labels.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Disc className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p>No labels under this company yet.</p>
                  {isHolding && (
                    <p className="text-sm mt-2">
                      Transfer an existing label or create a new one.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {labels.map((label) => (
                    <div
                      key={label.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Disc className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium">{label.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {label.headquarters_city || "No HQ"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${label.balance < 0 ? 'text-destructive' : ''}`}>
                          {formatCurrency(label.balance)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isHolding && unlinkedLabels.length > 0 && (
                <div className="mt-6 pt-4 border-t space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Your unlinked labels ({unlinkedLabels.length})
                  </p>
                  {unlinkedLabels.map((label) => (
                    <div key={label.id} className="flex items-center justify-between p-3 rounded-lg border border-dashed">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Disc className="h-4 w-4 text-purple-500" />
                        </div>
                        <div>
                          <p className="font-medium">{label.name}</p>
                          <p className="text-xs text-muted-foreground">{label.headquarters_city || "No HQ"}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={linkLabelMutation.isPending}
                        onClick={() => linkLabelMutation.mutate(label.id)}
                      >
                        Link to company
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <PlayerStaffBonusCard companyId={company.id} />
          <Card>
            <CardHeader>
              <CardTitle>Employees</CardTitle>
              <CardDescription>Players hired via your job listings appear here. Real players boost performance; NPC-only staffing applies a small penalty.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Use the <strong>Jobs</strong> tab to post listings and start hiring.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>



        <TabsContent value="jobs" className="space-y-4">
          <CompanyRecruitmentLifecycle
            companyId={company.id}
            companyName={company.name}
            companyType={company.company_type}
            headquartersCityId={company.headquarters_city_id}
          />
        </TabsContent>


        <TabsContent value="shares" className="space-y-4">
          <CompanySharesPanel companyId={company.id} isMajorityOwner={company.owner_id === userId} />
        </TabsContent>

        <TabsContent value="storefront" className="space-y-4">
          <CompanyStorefrontManager companyId={company.id} isOwner={company.owner_id === userId} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <CompanyAnalytics companyId={company.id} />
        </TabsContent>


        <TabsContent value="finances" className="space-y-4">
          <CompanyWeeklyFinancePanel companyId={company.id} />
          {/* Finance Actions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Fund Management</CardTitle>
                <CardDescription>Deposit or withdraw company funds</CardDescription>
              </div>
              <Button onClick={() => setFinanceDialogOpen(true)}>
                <Wallet className="h-4 w-4 mr-2" />
                Manage Funds
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className={`text-2xl font-bold ${company.balance < 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                    {formatCurrency(company.balance)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Weekly Costs</p>
                  <p className="text-2xl font-bold text-amber-500">
                    -{formatCurrency(company.weekly_operating_costs)}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground">Recent Transactions</p>
                  <p className="text-2xl font-bold">{transactions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax Overview */}
          <CompanyTaxOverview companyId={company.id} companyBalance={company.balance} />
          
          {/* Finance Dialog */}
          <CompanyFinanceDialog
            open={financeDialogOpen}
            onOpenChange={setFinanceDialogOpen}
            companyId={company.id}
            companyName={company.name}
          />
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <CompanyContractBoard companyId={company.id} />
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <CompanyEventsTimeline companyId={company.id} />
        </TabsContent>

        <TabsContent value="news" className="space-y-4">
          <CompanyNewsFeed companyId={company.id} isOwner={company.owner_id === userId} />
        </TabsContent>

        <TabsContent value="rivalries" className="space-y-4">
          <CompanyRivalries companyId={company.id} />
        </TabsContent>

        <TabsContent value="rankings" className="space-y-4">
          <MarketRankings companyId={company.id} companyType={company.company_type} />
        </TabsContent>
      </Tabs>
    </FMPageScaffold>
  );
};

const CompanyDetail = () => {
  return (
    <VipGate feature="Company management">
      <CompanyDetailContent />
    </VipGate>
  );
};

export default CompanyDetail;
