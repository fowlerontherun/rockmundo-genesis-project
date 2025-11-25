import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminRoute } from "@/components/AdminRoute";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, Edit, Trash2, TrendingUp } from "lucide-react";
import type { EquipmentItemRecord } from "@/types/gear";

const EQUIPMENT_CATEGORIES = ["guitar", "drums", "bass", "keyboard", "audio", "clothing", "accessories"];
const RARITY_TIERS = ["common", "uncommon", "rare", "epic", "legendary"];

interface EquipmentFormValues {
  name: string;
  category: string;
  subcategory: string;
  price: number;
  rarity: string;
  description: string;
  stat_boosts: string;
  stock: number;
  image_url: string;
}

function GearItemsAdmin() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { register, handleSubmit, reset, setValue, watch } = useForm<EquipmentFormValues>({
    defaultValues: {
      name: "",
      category: "guitar",
      subcategory: "",
      price: 0,
      rarity: "common",
      description: "",
      stat_boosts: "{}",
      stock: 999,
      image_url: "",
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['equipment-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_items')
        .select('*')
        .order('category')
        .order('name');

      if (error) throw error;
      return data as EquipmentItemRecord[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: EquipmentFormValues) => {
      let statBoosts = null;
      try {
        statBoosts = JSON.parse(values.stat_boosts);
      } catch (e) {
        throw new Error("Invalid stat boosts JSON");
      }

      const { data, error } = await supabase
        .from('equipment_items')
        .insert([{
          name: values.name,
          category: values.category,
          subcategory: values.subcategory || null,
          price: values.price,
          rarity: values.rarity,
          description: values.description || null,
          stat_boosts: statBoosts,
          stock: values.stock,
          image_url: values.image_url || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      toast.success("Equipment item created successfully");
      reset();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create equipment item");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: EquipmentFormValues }) => {
      let statBoosts = null;
      try {
        statBoosts = JSON.parse(values.stat_boosts);
      } catch (e) {
        throw new Error("Invalid stat boosts JSON");
      }

      const { data, error } = await supabase
        .from('equipment_items')
        .update({
          name: values.name,
          category: values.category,
          subcategory: values.subcategory || null,
          price: values.price,
          rarity: values.rarity,
          description: values.description || null,
          stat_boosts: statBoosts,
          stock: values.stock,
          image_url: values.image_url || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      toast.success("Equipment item updated successfully");
      setEditingId(null);
      reset();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update equipment item");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipment_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      toast.success("Equipment item deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete equipment item");
    },
  });

  const handleEdit = (item: EquipmentItemRecord) => {
    setEditingId(item.id);
    setValue("name", item.name);
    setValue("category", item.category);
    setValue("subcategory", item.subcategory || "");
    setValue("price", item.price);
    setValue("rarity", item.rarity || "common");
    setValue("description", item.description || "");
    setValue("stat_boosts", JSON.stringify(item.stat_boosts || {}, null, 2));
    setValue("stock", item.stock || 999);
    setValue("image_url", item.image_url || "");
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const onSubmit = (values: EquipmentFormValues) => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, values });
    } else {
      createMutation.mutate(values);
    }
  };

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return items;
    return items.filter(item => item.category === selectedCategory);
  }, [items, selectedCategory]);

  const stats = useMemo(() => {
    const categoryCounts = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: items.length,
      categoryCounts,
      avgPrice: Math.round(items.reduce((sum, item) => sum + item.price, 0) / items.length || 0),
    };
  }, [items]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-center text-muted-foreground">Loading equipment items...</p>
      </div>
    );
  }

  return (
      <div className="container mx-auto max-w-7xl space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Package className="h-8 w-8" />
              Equipment Items Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage the gear shop catalog - instruments, audio equipment, and clothing
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{Object.keys(stats.categoryCounts).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Price</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${stats.avgPrice.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Equipment Item" : "Add New Equipment Item"}</CardTitle>
            <CardDescription>
              Configure item properties, pricing, and stat boosts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name</Label>
                  <Input id="name" {...register("name", { required: true })} placeholder="Gibson Les Paul" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={watch("category")} onValueChange={(value) => setValue("category", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subcategory">Subcategory</Label>
                  <Input id="subcategory" {...register("subcategory")} placeholder="electric, acoustic, etc." />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rarity">Rarity</Label>
                  <Select value={watch("rarity")} onValueChange={(value) => setValue("rarity", value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RARITY_TIERS.map((tier) => (
                        <SelectItem key={tier} value={tier}>{tier}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <Input id="price" type="number" {...register("price", { valueAsNumber: true })} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image_url">Image URL</Label>
                  <Input id="image_url" {...register("image_url")} placeholder="https://..." />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stock">Stock</Label>
                  <Input id="stock" type="number" {...register("stock", { valueAsNumber: true })} />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" {...register("description")} placeholder="Item description..." />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="stat_boosts">Stat Boosts (JSON)</Label>
                  <Textarea 
                    id="stat_boosts" 
                    {...register("stat_boosts")} 
                    placeholder='{"guitar": 15, "performance": 10}'
                    className="font-mono text-sm"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? <Edit className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {editingId ? "Update Item" : "Add Item"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={() => { setEditingId(null); reset(); }}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Items List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Equipment Catalog</CardTitle>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {EQUIPMENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat} ({stats.categoryCounts[cat] || 0})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Rarity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Stat Boosts</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className={editingId === item.id ? "bg-muted/50" : undefined}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.category}</Badge>
                        {item.subcategory && <span className="text-xs text-muted-foreground ml-2">{item.subcategory}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.rarity === 'legendary' ? 'default' : 'secondary'}>
                          {item.rarity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          ${item.price.toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>{item.stock || 0}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 text-xs">
                          {item.stat_boosts && Object.entries(item.stat_boosts).map(([key, value]) => (
                            <Badge key={key} variant="outline" className="text-xs">
                              {key}: +{value}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(item.id, item.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No equipment items found{selectedCategory !== "all" && ` in ${selectedCategory} category`}.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}

export default function GearItemsAdminPage() {
  return (
    <AdminRoute>
      <GearItemsAdmin />
    </AdminRoute>
  );
}
