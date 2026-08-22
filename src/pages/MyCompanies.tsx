import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Building2,
  DollarSign,
  PieChart,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyCard } from "@/components/company/CompanyCard";
import { CompanySynergies } from "@/components/company/CompanySynergies";
import { CreateCompanyDialog } from "@/components/company/CreateCompanyDialog";
import { VipGate } from "@/components/company/VipGate";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import {
  FestivalCompanyCard,
  FestivalCompanyEligibilityCard,
  useOwnedFestivalCompanies,
} from "@/features/festival-company";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useAuth } from "@/hooks/use-auth-context";
import { useAllCompanyTaxRecords } from "@/hooks/useCompanyFinance";
import { useCompanies, useCompanyFinancialSummary } from "@/hooks/useCompanies";
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);

const festivalHashSelected = () =>
  typeof window !== "undefined" && window.location.hash === "#festivals";

export const CompanyDashboardContent = () => {
  const { loading: authLoading } = useAuth();
  const { isLoading: profileLoading } = useActiveProfile();
  const {
    data: companies,
    isLoading: companiesLoading,
    isError: companiesError,
    error,
    refetch,
  } = useCompanies();
  const {
    data: festivalCompanies = [],
    isLoading: festivalCompaniesLoading,
    isError: festivalCompaniesError,
    error: festivalCompaniesQueryError,
    refetch: refetchFestivalCompanies,
  } = useOwnedFestivalCompanies();
  const { data: financialSummary, isLoading: summaryLoading } =
    useCompanyFinancialSummary();
  const companyIds = companies?.map((company) => company.id) || [];
  const { data: pendingTaxes = [] } = useAllCompanyTaxRecords(companyIds);

  const holdingCompanies =
    companies?.filter((company) => company.company_type === "holding") || [];
  const subsidiaries =
    companies?.filter((company) => company.company_type !== "holding") || [];
  const hasCompanies = Boolean(companies?.length);
  const hasFestivalCompanies = festivalCompanies.length > 0;
  const totalCompanyCount = (companies?.length ?? 0) + festivalCompanies.length;
  const [activeTab, setActiveTab] = useState(() =>
    festivalHashSelected() ? "festivals" : "all",
  );

  useEffect(() => {
    if (festivalHashSelected() || (!hasCompanies && hasFestivalCompanies)) {
      setActiveTab("festivals");
    }
  }, [hasCompanies, hasFestivalCompanies]);

  const changeTab = (value: string) => {
    setActiveTab(value);
    if (typeof window === "undefined") return;

    if (value === "festivals") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#festivals`,
      );
    } else if (window.location.hash === "#festivals") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  };

  const totalPendingTax = pendingTaxes.reduce(
    (sum, tax) =>
      sum + Number(tax.tax_amount) + (Number(tax.penalty_amount) || 0),
    0,
  );
  const overdueTaxCount = pendingTaxes.filter(
    (tax) => tax.status === "overdue",
  ).length;

  if (
    authLoading ||
    profileLoading ||
    companiesLoading ||
    festivalCompaniesLoading
  ) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {companiesError ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Companies could not be loaded
            </CardTitle>
            <CardDescription>
              {error instanceof Error
                ? error.message
                : "Something went wrong while loading your companies."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {festivalCompaniesError ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Festival companies could not be loaded
            </CardTitle>
            <CardDescription>
              {festivalCompaniesQueryError instanceof Error
                ? festivalCompaniesQueryError.message
                : "Your Festival companies are temporarily unavailable."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => void refetchFestivalCompanies()}
            >
              Retry Festival companies
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {hasCompanies ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-2xl font-bold",
                    (financialSummary?.total_balance || 0) < 0 &&
                      "text-destructive",
                  )}
                >
                  {summaryLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    formatCurrency(financialSummary?.total_balance || 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across {companies?.length || 0} standard companies
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Monthly Revenue
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">
                  {summaryLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    formatCurrency(financialSummary?.monthly_income || 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 30 days income
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Monthly Expenses
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  {summaryLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    formatCurrency(financialSummary?.monthly_expenses || 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Operations + payroll + tax
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                (financialSummary?.monthly_net || 0) >= 0
                  ? "border-emerald-500/20"
                  : "border-destructive/20",
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Net Profit/Loss
                </CardTitle>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-2xl font-bold",
                    (financialSummary?.monthly_net || 0) >= 0
                      ? "text-emerald-500"
                      : "text-destructive",
                  )}
                >
                  {summaryLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    formatCurrency(financialSummary?.monthly_net || 0)
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(financialSummary?.monthly_net || 0) >= 0
                    ? "Profitable"
                    : "Losing money"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Workforce</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {financialSummary?.total_employees || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {financialSummary?.total_subsidiaries || 0} subsidiaries
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                totalPendingTax > 0 && "border-amber-500/30",
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending Taxes
                </CardTitle>
                <Receipt className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div
                  className={cn(
                    "text-2xl font-bold",
                    totalPendingTax > 0
                      ? "text-amber-500"
                      : "text-muted-foreground",
                  )}
                >
                  {formatCurrency(totalPendingTax)}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {pendingTaxes.length} pending
                  </p>
                  {overdueTaxCount > 0 ? (
                    <Badge
                      variant="destructive"
                      className="px-1 py-0 text-[10px]"
                    >
                      <AlertTriangle className="mr-0.5 h-3 w-3" />
                      {overdueTaxCount} overdue
                    </Badge>
                  ) : null}
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
                  const dailyBurn =
                    (financialSummary?.monthly_expenses || 0) / 30;
                  const daysOfRunway =
                    dailyBurn > 0
                      ? Math.floor(
                          (financialSummary?.total_balance || 0) / dailyBurn,
                        )
                      : Infinity;
                  return (
                    <>
                      <div className="text-2xl font-bold">
                        {daysOfRunway === Infinity ? "∞" : `${daysOfRunway}d`}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {dailyBurn > 0
                          ? `${formatCurrency(dailyBurn)}/day burn`
                          : "No expenses yet"}
                      </p>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      <Tabs value={activeTab} onValueChange={changeTab} className="space-y-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <TabsList className="h-auto flex-wrap justify-start">
            {hasCompanies ? (
              <>
                <TabsTrigger value="all">All ({totalCompanyCount})</TabsTrigger>
                <TabsTrigger value="holding">
                  Holding ({holdingCompanies.length})
                </TabsTrigger>
                <TabsTrigger value="subsidiaries">
                  Subsidiaries ({subsidiaries.length})
                </TabsTrigger>
                <TabsTrigger value="synergies">Synergies</TabsTrigger>
              </>
            ) : null}
            <TabsTrigger value="festivals">
              Festivals ({festivalCompanies.length})
            </TabsTrigger>
          </TabsList>
          {hasCompanies ? (
            <CreateCompanyDialog
              holdingCompanies={holdingCompanies}
              allowedTypes={
                holdingCompanies.length === 0 ? ["holding"] : undefined
              }
            />
          ) : null}
        </div>

        {hasCompanies ? (
          <TabsContent value="all" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {companies?.map((company) => (
                <CompanyCard key={company.id} company={company} />
              ))}
              {festivalCompanies.map((festival) => (
                <FestivalCompanyCard
                  key={festival.festivalCompanyId}
                  festival={festival}
                />
              ))}
            </div>
          </TabsContent>
        ) : null}

        {hasCompanies ? (
          <TabsContent value="holding" className="space-y-4">
            {holdingCompanies.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No holding companies yet.
                  </p>
                  <CreateCompanyDialog
                    trigger={
                      <Button variant="outline" className="mt-4">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Holding Company
                      </Button>
                    }
                    allowedTypes={["holding"]}
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
        ) : null}

        {hasCompanies ? (
          <TabsContent value="subsidiaries" className="space-y-4">
            {subsidiaries.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    {holdingCompanies.length === 0
                      ? "Create a holding company first, then add subsidiaries."
                      : "No subsidiaries yet. Add your first subsidiary to grow your empire."}
                  </p>
                  {holdingCompanies.length > 0 ? (
                    <CreateCompanyDialog
                      trigger={
                        <Button variant="outline" className="mt-4">
                          <Plus className="mr-2 h-4 w-4" />
                          Create Subsidiary
                        </Button>
                      }
                      parentCompanyId={holdingCompanies[0]?.id}
                    />
                  ) : null}
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
        ) : null}

        {hasCompanies ? (
          <TabsContent value="synergies" className="space-y-4">
            <CompanySynergies />
          </TabsContent>
        ) : null}

        <TabsContent value="festivals" className="space-y-4">
          <div className="rounded-lg border bg-card p-4 md:p-5">
            <h2 className="text-lg font-semibold">My Festivals</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the Festival owner dashboard to manage the company, upgrades,
              licence and current annual Festival.
            </p>
          </div>
          <FestivalCompanyEligibilityCard />
          {festivalCompanies.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {festivalCompanies.map((festival) => (
                <FestivalCompanyCard
                  key={festival.festivalCompanyId}
                  festival={festival}
                />
              ))}
            </div>
          ) : !festivalCompaniesError ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Building2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="font-medium">No Festival companies yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use the eligibility panel above to found your first Festival
                  company when you meet the requirements.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {!hasCompanies && !hasFestivalCompanies && !companiesError ? (
          <TabsContent value="all" className="space-y-4">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mx-auto mb-4 w-fit rounded-full bg-primary/10 p-4">
                  <Building2 className="h-10 w-10 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">
                  Start Your Business Empire
                </h3>
                <p className="mb-6 max-w-md text-muted-foreground">
                  Create a holding company to begin building your music industry
                  empire, or open the Festivals tab to found a Festival company.
                </p>
                <CreateCompanyDialog
                  trigger={
                    <Button size="lg">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Company
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
};

const MyCompanies = () => (
  <FMPageScaffold
    title="My Companies"
    subtitle="Manage your businesses and Festival companies in one place"
    icon={Building2}
    backTo="/business"
  >
    <VipGate
      feature="Company ownership"
      description="Run labels, factories, studios, Festival companies, and more."
    >
      <CompanyDashboardContent />
    </VipGate>
  </FMPageScaffold>
);

export default MyCompanies;
