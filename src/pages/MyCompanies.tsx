import { Building2, Plus, DollarSign, Users, TrendingUp, Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VipGate } from "@/components/company/VipGate";
import { CompanyCard } from "@/components/company/CompanyCard";
import { CreateCompanyDialog } from "@/components/company/CreateCompanyDialog";
import { useCompanies, useCompanyFinancialSummary } from "@/hooks/useCompanies";
import { Skeleton } from "@/components/ui/skeleton";
import type { Company } from "@/types/company";

const CompanyDashboardContent = () => {
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const { data: financialSummary, isLoading: summaryLoading } = useCompanyFinancialSummary();

  const holdingCompanies = companies?.filter(c => c.company_type === 'holding') || [];
  const subsidiaries = companies?.filter(c => c.company_type !== 'holding') || [];
  const hasCompanies = companies && companies.length > 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (companiesLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      {hasCompanies && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(financialSummary?.total_balance || 0) < 0 ? 'text-destructive' : ''}`}>
                {summaryLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(financialSummary?.total_balance || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all companies
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {summaryLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(financialSummary?.monthly_expenses || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Operating costs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summaryLoading ? <Skeleton className="h-8 w-12" /> : financialSummary?.total_employees || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all companies
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{companies?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                {holdingCompanies.length} holding, {subsidiaries.length} subsidiaries
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!hasCompanies && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-4">
              <Building2 className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Start Your Business Empire</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Create a holding company to begin building your music industry empire. 
              You can then add subsidiaries like record labels, security firms, and more.
            </p>
            <CreateCompanyDialog
              trigger={
                <Button size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Company
                </Button>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Companies List */}
      {hasCompanies && (
        <Tabs defaultValue="all" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All ({companies?.length})</TabsTrigger>
              <TabsTrigger value="holding">Holding ({holdingCompanies.length})</TabsTrigger>
              <TabsTrigger value="subsidiaries">Subsidiaries ({subsidiaries.length})</TabsTrigger>
            </TabsList>
            <CreateCompanyDialog
              holdingCompanies={holdingCompanies}
              allowedTypes={holdingCompanies.length === 0 ? ['holding'] : undefined}
            />
          </div>

          <TabsContent value="all" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {companies?.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="holding" className="space-y-4">
            {holdingCompanies.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No holding companies yet.</p>
                  <CreateCompanyDialog
                    trigger={
                      <Button variant="outline" className="mt-4">
                        <Plus className="h-4 w-4 mr-2" />
                        Create Holding Company
                      </Button>
                    }
                    allowedTypes={['holding']}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {holdingCompanies.map((company) => (
                  <CompanyCard key={company.id} company={company} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="subsidiaries" className="space-y-4">
            {subsidiaries.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    {holdingCompanies.length === 0 
                      ? "Create a holding company first, then add subsidiaries."
                      : "No subsidiaries yet. Add your first subsidiary to grow your empire."
                    }
                  </p>
                  {holdingCompanies.length > 0 && (
                    <CreateCompanyDialog
                      trigger={
                        <Button variant="outline" className="mt-4">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Subsidiary
                        </Button>
                      }
                      parentCompanyId={holdingCompanies[0]?.id}
                    />
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {subsidiaries.map((company) => (
                  <CompanyCard key={company.id} company={company} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

const MyCompanies = () => {
  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            My Companies
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your business empire
          </p>
        </div>
      </div>

      <VipGate
        feature="Company ownership"
        description="Create and manage business empires including record labels, security firms, merchandise factories, and more. Build your fortune beyond just performing!"
      >
        <CompanyDashboardContent />
      </VipGate>
    </div>
  );
};

export default MyCompanies;
