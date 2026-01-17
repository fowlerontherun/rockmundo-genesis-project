import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, DollarSign, Users, Building2, FileText, Star, Briefcase } from "lucide-react";
import { useCompanyFinancialReports, useCompanyKPIs } from "@/hooks/useCompanyAdvanced";

interface CompanyEmpireDashboardProps {
  companyId: string;
  companyName: string;
  totalBalance: number;
  subsidiaryCount: number;
  employeeCount: number;
}

export function CompanyEmpireDashboard({
  companyId,
  companyName,
  totalBalance,
  subsidiaryCount,
  employeeCount,
}: CompanyEmpireDashboardProps) {
  const { data: reports = [] } = useCompanyFinancialReports(companyId);
  const { data: kpis = [] } = useCompanyKPIs(companyId);

  const latestReport = reports[0];
  const latestKPI = kpis[0];
  const previousKPI = kpis[1];

  const growthRate = latestKPI?.growth_rate_monthly || 0;
  const isGrowing = growthRate >= 0;

  return (
    <div className="space-y-6">
      {/* Empire Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            {companyName} Empire
          </h2>
          <p className="text-muted-foreground">
            Consolidated business overview
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={isGrowing ? 'bg-success/10 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'}
        >
          {isGrowing ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
          {growthRate > 0 ? '+' : ''}{growthRate.toFixed(1)}% Monthly
        </Badge>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Balance</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-success" />
              ${totalBalance.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Across all business units
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Subsidiaries</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {subsidiaryCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Active business units
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Employees</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Users className="h-5 w-5 text-info" />
              {employeeCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Total workforce
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Contracts</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-warning" />
              {latestKPI?.total_contracts_active || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {latestKPI?.total_contracts_completed || 0} completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Business Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer Satisfaction</span>
                <span>{(latestKPI?.customer_satisfaction_avg || 0).toFixed(0)}%</span>
              </div>
              <Progress value={latestKPI?.customer_satisfaction_avg || 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Average Reputation</span>
                <span>{(latestKPI?.reputation_avg || 0).toFixed(0)}/100</span>
              </div>
              <Progress value={latestKPI?.reputation_avg || 0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Liquidity Ratio</span>
                <span>{(latestKPI?.liquidity_ratio || 0).toFixed(2)}</span>
              </div>
              <Progress value={Math.min(100, (latestKPI?.liquidity_ratio || 0) * 50)} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Financial Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestReport ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Revenue</span>
                  <span className="font-medium text-success">
                    ${latestReport.total_revenue.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Expenses</span>
                  <span className="font-medium text-destructive">
                    -${latestReport.total_expenses.toLocaleString()}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="font-medium">Net Profit</span>
                  <span className={`font-bold ${latestReport.net_profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                    ${latestReport.net_profit.toLocaleString()}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No financial reports yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
