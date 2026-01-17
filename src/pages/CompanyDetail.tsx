import { useParams, useNavigate } from "react-router-dom";
import { 
  Building2, ArrowLeft, DollarSign, Users, MapPin, 
  TrendingUp, Settings, Plus, Disc, AlertTriangle,
  Calendar, ChevronRight
} from "lucide-react";
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
import { useCompany, useCompanySubsidiaries } from "@/hooks/useCompanies";
import { useCompanyLabels } from "@/hooks/useCompanyLabels";
import { COMPANY_TYPE_INFO } from "@/types/company";
import type { Company } from "@/types/company";
import { formatDistanceToNow, format } from "date-fns";

const CompanyDetailContent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading } = useCompany(id);
  const { data: subsidiaries = [], isLoading: subsLoading } = useCompanySubsidiaries(
    company?.company_type === 'holding' ? id : undefined
  );
  const { data: labels = [] } = useCompanyLabels(id);

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
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!company) {
    return (
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
    );
  }

  const typeInfo = COMPANY_TYPE_INFO[company.company_type];
  const isHolding = company.company_type === 'holding';

  const handleCompanyClick = (c: Company) => {
    navigate(`/companies/${c.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/my-companies")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${typeInfo.color}`}>
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  {company.name}
                  {company.is_bankrupt && (
                    <Badge variant="destructive">Bankrupt</Badge>
                  )}
                </h1>
                <p className="text-muted-foreground">{typeInfo.label}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CompanySettingsDialog company={company} />
          {isHolding && (
            <CreateCompanyDialog
              parentCompanyId={company.id}
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Subsidiary
                </Button>
              }
            />
          )}
        </div>
      </div>

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
      <Tabs defaultValue={isHolding ? "structure" : "overview"} className="space-y-4">
        <TabsList>
          {isHolding && <TabsTrigger value="structure">Structure</TabsTrigger>}
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="labels">Labels ({labels.length})</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="finances">Finances</TabsTrigger>
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
                  onClick={() => navigate(`/companies/${company.parent_company!.id}`)}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employees</CardTitle>
              <CardDescription>Coming in Phase 7: Employee Management System</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Employee management will be available soon.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="finances" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Financial Overview</CardTitle>
              <CardDescription>Coming in Phase 9: Company Analytics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Detailed financial analytics coming soon.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const CompanyDetail = () => {
  return (
    <div className="container py-6">
      <VipGate feature="Company management">
        <CompanyDetailContent />
      </VipGate>
    </div>
  );
};

export default CompanyDetail;
