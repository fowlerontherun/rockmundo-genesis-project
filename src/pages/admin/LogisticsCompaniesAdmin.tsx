import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Truck, Users, FileText, Building2, Edit, Save, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const LogisticsCompaniesAdmin = () => {
  const queryClient = useQueryClient();
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    license_tier: 1,
    fleet_capacity: 10,
    operating_radius_km: 100,
  });

  // Fetch all logistics companies
  const { data: companies = [], isLoading: companiesLoading } = useQuery({
    queryKey: ["admin-logistics-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics_companies")
        .select(`
          *,
          parent_company:companies(name, owner_id)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all fleet vehicles
  const { data: vehicles = [] } = useQuery({
    queryKey: ["admin-logistics-fleet"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics_fleet_vehicles")
        .select(`
          *,
          company:logistics_companies(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all drivers
  const { data: drivers = [] } = useQuery({
    queryKey: ["admin-logistics-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics_drivers")
        .select(`
          *,
          company:logistics_companies(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all contracts
  const { data: contracts = [] } = useQuery({
    queryKey: ["admin-logistics-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logistics_contracts")
        .select(`
          *,
          company:logistics_companies(name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Update company mutation
  const updateCompany = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from("logistics_companies")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-logistics-companies"] });
      toast.success("Company updated successfully");
      setEditDialogOpen(false);
      setEditingCompany(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to update company", { description: error.message });
    },
  });

  const openEditDialog = (company: any) => {
    setEditingCompany(company);
    setEditForm({
      license_tier: company.license_tier || 1,
      fleet_capacity: company.fleet_capacity || 10,
      operating_radius_km: company.operating_radius_km || 100,
    });
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingCompany) return;
    updateCompany.mutate({
      id: editingCompany.id,
      data: editForm,
    });
  };

  const activeContracts = contracts.filter((c: any) => c.status === "active" || c.status === "in_progress");
  const totalFleetSize = vehicles.length;
  const totalDrivers = drivers.length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="h-8 w-8" />
            Logistics Companies Administration
          </h1>
          <p className="text-muted-foreground">Manage all logistics companies across companies</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Companies</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{companies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalFleetSize}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalDrivers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Contracts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeContracts.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="fleet">Fleet</TabsTrigger>
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                All Logistics Companies
              </CardTitle>
              <CardDescription>View and edit logistics company details</CardDescription>
            </CardHeader>
            <CardContent>
              {companiesLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Parent Company</TableHead>
                      <TableHead>License Tier</TableHead>
                      <TableHead>Fleet Capacity</TableHead>
                      <TableHead>Operating Radius</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company: any) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>{company.parent_company?.name || "Unknown"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Tier {company.license_tier}</Badge>
                        </TableCell>
                        <TableCell>{company.fleet_capacity}</TableCell>
                        <TableCell>{company.operating_radius_km} km</TableCell>
                        <TableCell className="capitalize">{company.specialization || "general"}</TableCell>
                        <TableCell>
                          <Badge variant={company.status === "active" ? "default" : "secondary"}>
                            {company.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(company)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {companies.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No logistics companies found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fleet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                All Fleet Vehicles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Daily Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((vehicle: any) => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-medium">{vehicle.name || vehicle.vehicle_type}</TableCell>
                      <TableCell>{vehicle.company?.name || "Unknown"}</TableCell>
                      <TableCell className="capitalize">{vehicle.vehicle_type}</TableCell>
                      <TableCell>{vehicle.cargo_capacity}</TableCell>
                      <TableCell>{vehicle.condition_pct}%</TableCell>
                      <TableCell>${vehicle.daily_cost?.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={vehicle.status === "available" ? "default" : "secondary"}>
                          {vehicle.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {vehicles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No vehicles found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drivers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Drivers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>License Type</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((driver: any) => (
                    <TableRow key={driver.id}>
                      <TableCell className="font-medium">{driver.name}</TableCell>
                      <TableCell>{driver.company?.name || "Unknown"}</TableCell>
                      <TableCell>{driver.license_type}</TableCell>
                      <TableCell>{driver.experience_years} years</TableCell>
                      <TableCell>${driver.salary?.toLocaleString()}/mo</TableCell>
                      <TableCell>{driver.performance_rating || 0}%</TableCell>
                      <TableCell>
                        <Badge variant={driver.status === "available" ? "default" : "secondary"}>
                          {driver.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {drivers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No drivers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                All Logistics Contracts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract: any) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.company?.name || "Unknown"}</TableCell>
                      <TableCell className="capitalize">{contract.contract_type}</TableCell>
                      <TableCell>{contract.origin_city || "-"}</TableCell>
                      <TableCell>{contract.destination_city || "-"}</TableCell>
                      <TableCell>${contract.total_value?.toLocaleString()}</TableCell>
                      <TableCell>
                        {contract.deadline ? new Date(contract.deadline).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={contract.status === "active" || contract.status === "in_progress" ? "default" : "secondary"}>
                          {contract.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {contracts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No contracts found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Company: {editingCompany?.name}</DialogTitle>
            <DialogDescription>Update logistics company details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>License Tier (1-5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={editForm.license_tier}
                onChange={(e) => setEditForm({ ...editForm, license_tier: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label>Fleet Capacity</Label>
              <Input
                type="number"
                min={1}
                value={editForm.fleet_capacity}
                onChange={(e) => setEditForm({ ...editForm, fleet_capacity: parseInt(e.target.value) || 10 })}
              />
            </div>
            <div>
              <Label>Operating Radius (km)</Label>
              <Input
                type="number"
                min={1}
                value={editForm.operating_radius_km}
                onChange={(e) => setEditForm({ ...editForm, operating_radius_km: parseInt(e.target.value) || 100 })}
              />
            </div>
            <Button onClick={handleSave} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LogisticsCompaniesAdmin;
