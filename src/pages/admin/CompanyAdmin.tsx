import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, DollarSign, Users, TrendingUp, AlertTriangle, Search, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { AdminRoute } from "@/components/AdminRoute";

interface CompanyWithOwner {
  id: string;
  name: string;
  company_type: string;
  balance: number;
  is_bankrupt: boolean;
  created_at: string;
  owner_id: string;
  owner_name?: string;
  subsidiary_count: number;
}

const CompanyAdmin = () => {
  const [searchQuery, setSearchQuery] = useState("");

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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
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
                          <Button size="sm" variant="outline">
                            Clear Bankruptcy
                          </Button>
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
                <Card key={type}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge className={getCompanyTypeColor(type)}>
                          {type.replace('_', ' ')}
                        </Badge>
                        <p className="text-2xl font-bold mt-2">{count as number}</p>
                        <p className="text-sm text-muted-foreground">companies</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminRoute>
  );
};

export default CompanyAdmin;
