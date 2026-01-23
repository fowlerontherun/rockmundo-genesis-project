import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, DollarSign, Users, TrendingUp, AlertTriangle, Search, RefreshCw, Edit, Save, Shield, Factory, Truck, Music, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { AdminRoute } from "@/components/AdminRoute";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface CompanyWithOwner {
  id: string;
  name: string;
  company_type: string;
  balance: number;
  is_bankrupt: boolean;
  status: string;
  created_at: string;
  owner_id: string;
  owner_name?: string;
  subsidiary_count: number;
}

const CompanyAdmin = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyWithOwner | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    balance: 0,
    status: "active",
    is_bankrupt: false,
  });

  // Fetch all companies with owner info
  const { data: companies, isLoading, refetch } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data: companiesData, error } = await supabase
        .from("companies")
        .select(`
          id,
          name,
          company_type,
          balance,
          is_bankrupt,
          status,
          created_at,
          owner_id,
          parent_company_id
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get owner names
      const ownerIds = [...new Set(companiesData?.map(c => c.owner_id) || [])];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ownerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p.display_name]) || []);

      // Count subsidiaries for each company
      const subsidiaryCount = new Map<string, number>();
      companiesData?.forEach(c => {
        if (c.parent_company_id) {
          subsidiaryCount.set(c.parent_company_id, (subsidiaryCount.get(c.parent_company_id) || 0) + 1);
        }
      });

      return companiesData?.map(c => ({
        ...c,
        owner_name: profileMap.get(c.owner_id) || "Unknown",
        subsidiary_count: subsidiaryCount.get(c.id) || 0,
      })) as CompanyWithOwner[];
    },
  });

  // Fetch aggregate stats
  const { data: stats } = useQuery({
    queryKey: ["admin-company-stats"],
    queryFn: async () => {
      const { data: companiesData } = await supabase
        .from("companies")
        .select("balance, is_bankrupt, company_type");

      const totalCompanies = companiesData?.length || 0;
      const totalBalance = companiesData?.reduce((sum, c) => sum + (c.balance || 0), 0) || 0;
      const bankruptCompanies = companiesData?.filter(c => c.is_bankrupt).length || 0;
      const companyTypes = companiesData?.reduce((acc, c) => {
        acc[c.company_type] = (acc[c.company_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        totalCompanies,
        totalBalance,
        bankruptCompanies,
        companyTypes,
      };
    },
  });

  // Fetch financial overview
  const { data: financials } = useQuery({
    queryKey: ["admin-company-financials"],
    queryFn: async () => {
      // Get security guards count
      const { data: guards } = await supabase
        .from("security_guards")
        .select("salary_per_event")
        .eq("status", "active");
      
      const securityPayroll = guards?.reduce((sum, g: any) => sum + ((g.salary_per_event || 0) / 7), 0) || 0; // Rough daily estimate

      // Get factory workers
      const { data: workers } = await supabase
        .from("merch_factory_workers")
        .select("salary_weekly");
      
      const factoryPayroll = workers?.reduce((sum, w: any) => sum + ((w.salary_weekly || 0) / 7), 0) || 0; // Convert weekly to daily

      // Get factory operating costs
      const { data: factories } = await supabase
        .from("merch_factories")
        .select("operating_costs_daily")
        .eq("is_operational", true);
      
      const factoryOperatingCosts = factories?.reduce((sum, f: any) => sum + (f.operating_costs_daily || 0), 0) || 0;

      // Get logistics drivers
      const { data: drivers } = await supabase
        .from("logistics_drivers")
        .select("salary_per_day")
        .eq("status", "active");
      
      const logisticsPayroll = drivers?.reduce((sum, d: any) => sum + (d.salary_per_day || 0), 0) || 0;

      return {
        dailyPayroll: securityPayroll + factoryPayroll + logisticsPayroll,
        dailyOperatingCosts: factoryOperatingCosts,
        securityGuards: guards?.length || 0,
        factoryWorkers: workers?.length || 0,
        logisticsDrivers: drivers?.length || 0,
        totalEmployees: (guards?.length || 0) + (workers?.length || 0) + (drivers?.length || 0),
      };
    },
  });

  // Update company mutation
  const updateCompany = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from("companies")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-company-stats"] });
      toast.success("Company updated successfully");
      setEditDialogOpen(false);
      setEditingCompany(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to update company", { description: error.message });
    },
  });

  // Clear bankruptcy mutation
  const clearBankruptcy = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("companies")
        .update({ 
          is_bankrupt: false,
          balance_went_negative_at: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-company-stats"] });
      toast.success("Bankruptcy cleared");
    },
    onError: (error: Error) => {
      toast.error("Failed to clear bankruptcy", { description: error.message });
    },
  });

  // Inject funds mutation
  const injectFunds = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      const company = companies?.find(c => c.id === id);
      if (!company) throw new Error("Company not found");
      
      const { error } = await supabase
        .from("companies")
        .update({ balance: company.balance + amount })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-company-stats"] });
      toast.success("Funds injected successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to inject funds", { description: error.message });
    },
  });

  const openEditDialog = (company: CompanyWithOwner) => {
    setEditingCompany(company);
    setEditForm({
      name: company.name,
      balance: company.balance,
      status: company.status || "active",
      is_bankrupt: company.is_bankrupt,
    });
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingCompany) return;
    updateCompany.mutate({
      id: editingCompany.id,
      data: {
        name: editForm.name,
        balance: editForm.balance,
        status: editForm.status,
        is_bankrupt: editForm.is_bankrupt,
        ...(editForm.is_bankrupt === false ? { balance_went_negative_at: null } : {}),
      },
    });
  };

  const filteredCompanies = companies?.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCompanyTypeColor = (type: string) => {
    switch (type) {
      case "holding": return "bg-purple-500/20 text-purple-500";
      case "record_label": return "bg-blue-500/20 text-blue-500";
      case "security_firm": return "bg-red-500/20 text-red-500";
      case "merch_factory": return "bg-green-500/20 text-green-500";
      case "venue": return "bg-orange-500/20 text-orange-500";
      case "logistics": return "bg-cyan-500/20 text-cyan-500";
      default: return "bg-gray-500/20 text-gray-500";
    }
  };

  const getSubsidiaryLink = (type: string) => {
    switch (type) {
      case "security_firm": return "/admin/security-firms";
      case "merch_factory": return "/admin/merch-factories";
      case "logistics": return "/admin/logistics-companies";
      case "record_label": return "/admin/labels";
      default: return null;
    }
  };

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              Company Administration
            </h1>
            <p className="text-muted-foreground">
              Manage VIP player companies, view financials, and handle bankruptcies
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Companies</p>
                  <p className="text-2xl font-bold">{stats?.totalCompanies || 0}</p>
                </div>
                <Building2 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Balance</p>
                  <p className="text-2xl font-bold">${(stats?.totalBalance || 0).toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Company Types</p>
                  <p className="text-2xl font-bold">{Object.keys(stats?.companyTypes || {}).length}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Bankrupt</p>
                  <p className="text-2xl font-bold">{stats?.bankruptCompanies || 0}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All Companies</TabsTrigger>
              <TabsTrigger value="financials">Financial Overview</TabsTrigger>
              <TabsTrigger value="bankrupt">Bankrupt</TabsTrigger>
              <TabsTrigger value="types">By Type</TabsTrigger>
            </TabsList>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Companies</CardTitle>
                <CardDescription>Complete list of player-owned companies</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Subsidiaries</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCompanies?.map((company) => (
                        <TableRow key={company.id}>
                          <TableCell className="font-medium">{company.name}</TableCell>
                          <TableCell>
                            <Badge className={getCompanyTypeColor(company.company_type)}>
                              {company.company_type.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{company.owner_name}</TableCell>
                          <TableCell className={company.balance < 0 ? "text-red-500" : ""}>
                            ${company.balance.toLocaleString()}
                          </TableCell>
                          <TableCell>{company.subsidiary_count}</TableCell>
                          <TableCell>
                            {company.is_bankrupt ? (
                              <Badge variant="destructive">Bankrupt</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-500">Active</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(company.created_at), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => openEditDialog(company)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              {getSubsidiaryLink(company.company_type) && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => navigate(getSubsidiaryLink(company.company_type)!)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financials">
            <div className="space-y-4">
              {/* Subsidiary Quick Links */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/admin/security-firms")}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <Shield className="h-8 w-8 text-red-500" />
                      <div>
                        <p className="font-medium">Security Firms</p>
                        <p className="text-sm text-muted-foreground">{financials?.securityGuards || 0} guards</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/admin/merch-factories")}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <Factory className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="font-medium">Merch Factories</p>
                        <p className="text-sm text-muted-foreground">{financials?.factoryWorkers || 0} workers</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/admin/logistics-companies")}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <Truck className="h-8 w-8 text-cyan-500" />
                      <div>
                        <p className="font-medium">Logistics</p>
                        <p className="text-sm text-muted-foreground">{financials?.logisticsDrivers || 0} drivers</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/admin/labels")}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <Music className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="font-medium">Record Labels</p>
                        <p className="text-sm text-muted-foreground">View labels</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Financial Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Consolidated Financial Overview
                  </CardTitle>
                  <CardDescription>Daily costs and employee counts across all subsidiaries</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <h4 className="font-medium text-muted-foreground">Daily Payroll</h4>
                      <p className="text-3xl font-bold text-red-500">
                        ${(financials?.dailyPayroll || 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Across {financials?.totalEmployees || 0} employees
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium text-muted-foreground">Daily Operating Costs</h4>
                      <p className="text-3xl font-bold text-orange-500">
                        ${(financials?.dailyOperatingCosts || 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Factory operations
                      </p>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium text-muted-foreground">Total Daily Expenses</h4>
                      <p className="text-3xl font-bold">
                        ${((financials?.dailyPayroll || 0) + (financials?.dailyOperatingCosts || 0)).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ≈ ${(((financials?.dailyPayroll || 0) + (financials?.dailyOperatingCosts || 0)) * 30).toLocaleString()}/month
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Employee Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Employee Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subsidiary Type</TableHead>
                        <TableHead>Employee Count</TableHead>
                        <TableHead>Est. Daily Payroll</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Security Firms</TableCell>
                        <TableCell>{financials?.securityGuards || 0} guards</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => navigate("/admin/security-firms")}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Merch Factories</TableCell>
                        <TableCell>{financials?.factoryWorkers || 0} workers</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => navigate("/admin/merch-factories")}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Logistics Companies</TableCell>
                        <TableCell>{financials?.logisticsDrivers || 0} drivers</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => navigate("/admin/logistics-companies")}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="bankrupt">
            <Card>
              <CardHeader>
                <CardTitle>Bankrupt Companies</CardTitle>
                <CardDescription>Companies requiring attention or cleanup</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies?.filter(c => c.is_bankrupt).map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>
                          <Badge className={getCompanyTypeColor(company.company_type)}>
                            {company.company_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{company.owner_name}</TableCell>
                        <TableCell className="text-red-500">
                          ${company.balance.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => clearBankruptcy.mutate(company.id)}
                            >
                              Clear Bankruptcy
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => injectFunds.mutate({ id: company.id, amount: 100000 })}
                            >
                              +$100k
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openEditDialog(company)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredCompanies?.filter(c => c.is_bankrupt).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No bankrupt companies
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="types">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(stats?.companyTypes || {}).map(([type, count]) => (
                <Card key={type} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => {
                  const link = getSubsidiaryLink(type);
                  if (link) navigate(link);
                }}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge className={getCompanyTypeColor(type)}>
                          {type.replace('_', ' ')}
                        </Badge>
                        <p className="text-2xl font-bold mt-2">{count as number}</p>
                        <p className="text-sm text-muted-foreground">companies</p>
                      </div>
                      {getSubsidiaryLink(type) && (
                        <ExternalLink className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Company: {editingCompany?.name}</DialogTitle>
              <DialogDescription>Update company details and financials</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Balance ($)</Label>
                <Input
                  type="number"
                  value={editForm.balance}
                  onChange={(e) => setEditForm({ ...editForm, balance: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_bankrupt"
                  checked={editForm.is_bankrupt}
                  onChange={(e) => setEditForm({ ...editForm, is_bankrupt: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_bankrupt">Is Bankrupt</Label>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>

              <div className="border-t pt-4">
                <Label className="text-muted-foreground">Quick Actions</Label>
                <div className="flex gap-2 mt-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      if (editingCompany) {
                        injectFunds.mutate({ id: editingCompany.id, amount: 50000 });
                      }
                    }}
                  >
                    +$50k
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      if (editingCompany) {
                        injectFunds.mutate({ id: editingCompany.id, amount: 100000 });
                      }
                    }}
                  >
                    +$100k
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      if (editingCompany) {
                        injectFunds.mutate({ id: editingCompany.id, amount: 500000 });
                      }
                    }}
                  >
                    +$500k
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminRoute>
  );
};

export default CompanyAdmin;
