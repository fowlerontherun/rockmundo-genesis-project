import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Factory, Users, Package, Building2, Edit, Save, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const MerchFactoriesAdmin = () => {
  const queryClient = useQueryClient();
  const [editingFactory, setEditingFactory] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    production_capacity: 100,
    quality_level: 1,
    daily_operating_cost: 500,
  });

  // Fetch all factories
  const { data: factories = [], isLoading: factoriesLoading } = useQuery({
    queryKey: ["admin-merch-factories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merch_factories")
        .select(`
          *,
          company:companies(name, owner_id)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all workers
  const { data: workers = [] } = useQuery({
    queryKey: ["admin-factory-workers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merch_factory_workers")
        .select(`
          *,
          factory:merch_factories(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch production queues
  const { data: productionQueues = [] } = useQuery({
    queryKey: ["admin-production-queues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merch_production_queue")
        .select(`
          *,
          factory:merch_factories(name),
          product:merch_product_catalog(name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch product catalogs
  const { data: products = [] } = useQuery({
    queryKey: ["admin-merch-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merch_product_catalog")
        .select(`
          *,
          factory:merch_factories(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Update factory mutation
  const updateFactory = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from("merch_factories")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-merch-factories"] });
      toast.success("Factory updated successfully");
      setEditDialogOpen(false);
      setEditingFactory(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to update factory", { description: error.message });
    },
  });

  const openEditDialog = (factory: any) => {
    setEditingFactory(factory);
    setEditForm({
      production_capacity: factory.production_capacity || 100,
      quality_level: factory.quality_level || 1,
      daily_operating_cost: factory.daily_operating_cost || 500,
    });
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingFactory) return;
    updateFactory.mutate({
      id: editingFactory.id,
      data: editForm,
    });
  };

  const activeQueues = productionQueues.filter((q: any) => q.status === "in_progress" || q.status === "queued");
  const totalCapacity = factories.reduce((sum: number, f: any) => sum + (f.production_capacity || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Factory className="h-8 w-8" />
            Merch Factories Administration
          </h1>
          <p className="text-muted-foreground">Manage all merchandise factories across companies</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Factories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{factories.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Workers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{workers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Production</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeQueues.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalCapacity.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="factories">
        <TabsList>
          <TabsTrigger value="factories">Factories</TabsTrigger>
          <TabsTrigger value="workers">Workers</TabsTrigger>
          <TabsTrigger value="production">Production Queue</TabsTrigger>
          <TabsTrigger value="products">Product Catalog</TabsTrigger>
        </TabsList>

        <TabsContent value="factories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                All Merch Factories
              </CardTitle>
              <CardDescription>View and edit factory details</CardDescription>
            </CardHeader>
            <CardContent>
              {factoriesLoading ? (
                <p className="text-muted-foreground">Loading...</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Parent Company</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Capacity</TableHead>
                      <TableHead>Quality Level</TableHead>
                      <TableHead>Daily Cost</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {factories.map((factory: any) => (
                      <TableRow key={factory.id}>
                        <TableCell className="font-medium">{factory.name}</TableCell>
                        <TableCell>{factory.company?.name || "Unknown"}</TableCell>
                        <TableCell className="capitalize">{factory.factory_type || "general"}</TableCell>
                        <TableCell>{factory.production_capacity?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Level {factory.quality_level}</Badge>
                        </TableCell>
                        <TableCell>${factory.daily_operating_cost?.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={factory.status === "active" ? "default" : "secondary"}>
                            {factory.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(factory)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {factories.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No factories found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                All Factory Workers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Factory</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Skill Level</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Salary</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.map((worker: any) => (
                    <TableRow key={worker.id}>
                      <TableCell className="font-medium">{worker.name}</TableCell>
                      <TableCell>{worker.factory?.name || "Unknown"}</TableCell>
                      <TableCell className="capitalize">{worker.role}</TableCell>
                      <TableCell>{worker.skill_level}</TableCell>
                      <TableCell>{worker.experience_months} months</TableCell>
                      <TableCell>${worker.salary?.toLocaleString()}/mo</TableCell>
                      <TableCell>
                        <Badge variant={worker.status === "active" ? "default" : "secondary"}>
                          {worker.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {workers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No workers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="production" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Production Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factory</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Est. Completion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productionQueues.map((queue: any) => (
                    <TableRow key={queue.id}>
                      <TableCell className="font-medium">{queue.factory?.name || "Unknown"}</TableCell>
                      <TableCell>{queue.product?.name || "Unknown"}</TableCell>
                      <TableCell>{queue.quantity?.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={queue.status === "in_progress" ? "default" : "secondary"}>
                          {queue.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{queue.priority || 0}</TableCell>
                      <TableCell>
                        {queue.started_at ? new Date(queue.started_at).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        {queue.estimated_completion ? new Date(queue.estimated_completion).toLocaleDateString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {productionQueues.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No production orders found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Catalog
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Factory</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Production Cost</TableHead>
                    <TableHead>Retail Price</TableHead>
                    <TableHead>Min Order</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product: any) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.factory?.name || "Unknown"}</TableCell>
                      <TableCell className="capitalize">{product.product_type}</TableCell>
                      <TableCell>${product.production_cost?.toFixed(2)}</TableCell>
                      <TableCell>${product.retail_price?.toFixed(2)}</TableCell>
                      <TableCell>{product.min_order_quantity}</TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? "default" : "secondary"}>
                          {product.is_active ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No products found
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
            <DialogTitle>Edit Factory: {editingFactory?.name}</DialogTitle>
            <DialogDescription>Update factory details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Production Capacity</Label>
              <Input
                type="number"
                min={1}
                value={editForm.production_capacity}
                onChange={(e) => setEditForm({ ...editForm, production_capacity: parseInt(e.target.value) || 100 })}
              />
            </div>
            <div>
              <Label>Quality Level (1-5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                value={editForm.quality_level}
                onChange={(e) => setEditForm({ ...editForm, quality_level: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label>Daily Operating Cost ($)</Label>
              <Input
                type="number"
                min={0}
                value={editForm.daily_operating_cost}
                onChange={(e) => setEditForm({ ...editForm, daily_operating_cost: parseInt(e.target.value) || 0 })}
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

export default MerchFactoriesAdmin;
