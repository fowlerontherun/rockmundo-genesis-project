import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, FileText, Building2, Edit, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const SecurityFirmsAdmin = () => {
  const queryClient = useQueryClient();
  const [editingFirm, setEditingFirm] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    license_level: 1,
    equipment_quality: "standard",
    reputation: 50,
  });

  // Fetch all security firms
  const { data: firms = [], isLoading: firmsLoading } = useQuery({
    queryKey: ["admin-security-firms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_firms")
        .select(`
          *,
          company:companies(name, owner_id)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all guards
  const { data: guards = [] } = useQuery({
    queryKey: ["admin-security-guards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_guards")
        .select(`
          *,
          firm:security_firms(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all contracts
  const { data: contracts = [] } = useQuery({
    queryKey: ["admin-security-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_contracts")
        .select(`
          *,
          firm:security_firms(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Update firm mutation
  const updateFirm = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from("security_firms")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-security-firms"] });
      toast.success("Firm updated successfully");
      setEditDialogOpen(false);
      setEditingFirm(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to update firm", { description: error.message });
    },
  });

  const openEditDialog = (firm: any) => {
    setEditingFirm(firm);
    setEditForm({
      license_level: firm.license_level || 1,
      equipment_quality: firm.equipment_quality || "standard",
      reputation: firm.reputation || 50,
    });
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingFirm) return;
    updateFirm.mutate({
      id: editingFirm.id,
      data: editForm,
    });
  };

  const activeContracts = contracts.filter((c: any) => c.status === "active");
  const totalGuards = guards.length;
  const avgReputation = firms.length > 0 
    ? Math.round(firms.reduce((sum: number, f: any) => sum + (f.reputation || 0), 0) / firms.length)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Security Firms Administration
          </h1>
          <p className="text-muted-foreground">Manage all security firms across companies</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Firms</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{firms.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Guards</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalGuards}</p>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Reputation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{avgReputation}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="firms">
        <TabsList>
          <TabsTrigger value="firms">Firms</TabsTrigger>
          <TabsTrigger value="guards">Guards</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
        </TabsList>

        <TabsContent value="firms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                All Security Firms
              </CardTitle>
              <CardDescription>View and edit security firm details</CardDescription>
            </CardHeader>
            <CardContent>
              {firmsLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Parent Company</TableHead>
                      <TableHead>License Level</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Reputation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {firms.map((firm: any) => (
                      <TableRow key={firm.id}>
                        <TableCell className="font-medium">{firm.name}</TableCell>
                        <TableCell>{firm.company?.name || "Unknown"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Level {firm.license_level}</Badge>
                        </TableCell>
                        <TableCell className="capitalize">{firm.equipment_quality || "standard"}</TableCell>
                        <TableCell>{firm.reputation || 0}</TableCell>
                        <TableCell>
                          <Badge variant={firm.status === "active" ? "default" : "secondary"}>
                            {firm.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(firm)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {firms.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No security firms found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Security Guards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Firm</TableHead>
                    <TableHead>Skill Level</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guards.map((guard: any) => (
                    <TableRow key={guard.id}>
                      <TableCell className="font-medium">{guard.name}</TableCell>
                      <TableCell>{guard.firm?.name || "Unknown"}</TableCell>
                      <TableCell>{guard.skill_level}</TableCell>
                      <TableCell>{guard.experience_years} years</TableCell>
                      <TableCell>${(guard as any).salary_per_event?.toLocaleString() || 0}/event</TableCell>
                      <TableCell>
                        <Badge variant={guard.status === "active" ? "default" : "secondary"}>
                          {guard.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {guards.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No guards found
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
                All Security Contracts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firm</TableHead>
                    <TableHead>Client Type</TableHead>
                    <TableHead>Service Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract: any) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.firm?.name || "Unknown"}</TableCell>
                      <TableCell className="capitalize">{contract.client_type}</TableCell>
                      <TableCell className="capitalize">{contract.service_type}</TableCell>
                      <TableCell>${contract.contract_value?.toLocaleString()}</TableCell>
                      <TableCell>{new Date(contract.start_date).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(contract.end_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={contract.status === "active" ? "default" : "secondary"}>
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
            <DialogTitle>Edit Security Firm: {editingFirm?.name}</DialogTitle>
            <DialogDescription>Update firm details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>License Level (1-5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={editForm.license_level}
                onChange={(e) => setEditForm({ ...editForm, license_level: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label>Equipment Quality</Label>
              <Input
                value={editForm.equipment_quality}
                onChange={(e) => setEditForm({ ...editForm, equipment_quality: e.target.value })}
                placeholder="standard, premium, elite"
              />
            </div>
            <div>
              <Label>Reputation (0-100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={editForm.reputation}
                onChange={(e) => setEditForm({ ...editForm, reputation: parseInt(e.target.value) || 0 })}
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

export default SecurityFirmsAdmin;
