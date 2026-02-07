import { useState } from "react";
import { Building2, Plus, DollarSign, Users, TrendingUp, TrendingDown, Receipt, AlertTriangle, Banknote, PieChart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VipGate } from "@/components/company/VipGate";
import { CompanyCard } from "@/components/company/CompanyCard";
import { CompanySynergies } from "@/components/company/CompanySynergies";
import { CompanyTaxOverview } from "@/components/company/CompanyTaxOverview";
import { CreateCompanyDialog } from "@/components/company/CreateCompanyDialog";
import { useCompanies, useCompanyFinancialSummary } from "@/hooks/useCompanies";
import { useAllCompanyTaxRecords } from "@/hooks/useCompanyFinance";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CORPORATE_TAX_RATES, type Company } from "@/types/company";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const CompanyDashboardContent = () => {
  const { data: companies, isLoading: companiesLoading } = useCompanies();
  const { data: financialSummary, isLoading: summaryLoading } = useCompanyFinancialSummary();
  const companyIds = companies?.map(c => c.id) || [];
  const { data: pendingTaxes = [] } = useAllCompanyTaxRecords(companyIds);

  const holdingCompanies = companies?.filter(c => c.company_type === 'holding') || [];
  const subsidiaries = companies?.filter(c => c.company_type !== 'holding') || [];
  const hasCompanies = companies && companies.length > 0;

  const totalPendingTax = pendingTaxes.reduce(
    (sum, t) => sum + Number(t.tax_amount) + (Number(t.penalty_amount) || 0), 0
  );
  const overdueTaxCount = pendingTaxes.filter(t => t.status === 'overdue').length;

  if (companiesLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      {hasCompanies && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", (financialSummary?.total_balance || 0) < 0 && "text-destructive")}>
                  {summaryLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(financialSummary?.total_balance || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Across {companies?.length || 0} companies</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">
                  {summaryLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(financialSummary?.monthly_income || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Last 30 days income</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {summaryLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(financialSummary?.monthly_expenses || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Operations + payroll + tax</p>
              </CardContent>
            </Card>

            <Card className={cn(
              (financialSummary?.monthly_net || 0) >= 0 
                ? "border-emerald-500/20" 
                : "border-destructive/20"
            )}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className={cn(
                  "text-2xl font-bold",
                  (financialSummary?.monthly_net || 0) >= 0 ? "text-emerald-500" : "text-destructive"
                )}>
                  {summaryLoading ? <Skeleton className="h-8 w-24" /> : formatCurrency(financialSummary?.monthly_net || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(financialSummary?.monthly_net || 0) >= 0 ? "Profitable" : "Losing money"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Second Row: Employees, Tax, Subsidiaries */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Workforce</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{financialSummary?.total_employees || 0}</div>
                <p className="text-xs text-muted-foreground">{financialSummary?.total_subsidiaries || 0} subsidiaries</p>
              </CardContent>
            </Card>

            <Card className={cn(totalPendingTax > 0 && "border-amber-500/30")}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Taxes</CardTitle>
                <Receipt className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className={cn("text-2xl font-bold", totalPendingTax > 0 ? "text-amber-500" : "text-muted-foreground")}>
                  {formatCurrency(totalPendingTax)}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{pendingTaxes.length} pending</p>
                  {overdueTaxCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1 py-0">
                      <AlertTriangle className="h-3 w-3 mr-0.5" />{overdueTaxCount} overdue
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Burn Rate</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {(() => {
                  const dailyBurn = (financialSummary?.monthly_expenses || 0) / 30;
                  const daysOfRunway = dailyBurn > 0 
                    ? Math.floor((financialSummary?.total_balance || 0) / dailyBurn) 
                    : Infinity;
                  return (
                    <>
                      <div className="text-2xl font-bold">
                        {daysOfRunway === Infinity ? "∞" : `${daysOfRunway}d`}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {dailyBurn > 0 ? `${formatCurrency(dailyBurn)}/day burn` : "No expenses yet"}
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </>
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
              <TabsTrigger value="synergies">Synergies</TabsTrigger>
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

          <TabsContent value="synergies" className="space-y-4">
            <CompanySynergies />
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
            Manage your business empire — revenue, expenses, taxes, and growth
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
