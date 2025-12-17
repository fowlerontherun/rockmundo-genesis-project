import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit, Trash2, ArrowLeft, Shirt, Sparkles } from "lucide-react";

const CATEGORIES = ["shirt", "pants", "jacket", "shoes", "accessory", "hat"];
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

const CollectionItemsAdmin = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "shirt",
    price: 100,
    rarity: "common",
    is_premium: false,
    is_limited_edition: false,
    featured: false,
  });

  const { data: collection } = useQuery({
    queryKey: ["admin-collection", collectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skin_collections")
        .select("*")
        .eq("id", collectionId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["admin-collection-items", collectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_clothing_items")
        .select("*")
        .eq("collection_id", collectionId)
        .order("category", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: unassignedItems } = useQuery({
    queryKey: ["admin-unassigned-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_clothing_items")
        .select("*")
        .is("collection_id", null)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("avatar_clothing_items").insert({
        ...data,
        collection_id: collectionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-collection-items"] });
      toast.success("Item created");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("avatar_clothing_items")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-collection-items"] });
      toast.success("Item updated");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("avatar_clothing_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-collection-items"] });
      toast.success("Item deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("avatar_clothing_items")
        .update({ collection_id: collectionId })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-collection-items"] });
      queryClient.invalidateQueries({ queryKey: ["admin-unassigned-items"] });
      toast.success("Item assigned to collection");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unassignMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("avatar_clothing_items")
        .update({ collection_id: null })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-collection-items"] });
      queryClient.invalidateQueries({ queryKey: ["admin-unassigned-items"] });
      toast.success("Item removed from collection");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "shirt",
      price: 100,
      rarity: "common",
      is_premium: false,
      is_limited_edition: false,
      featured: false,
    });
    setEditingItem(null);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      category: item.category,
      price: item.price || 100,
      rarity: item.rarity || "common",
      is_premium: item.is_premium || false,
      is_limited_edition: item.is_limited_edition || false,
      featured: item.featured || false,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const rarityColor: Record<string, string> = {
    common: "secondary",
    uncommon: "default",
    rare: "default",
    epic: "default",
    legendary: "destructive",
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/skin-collections")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{collection?.name || "Collection"} Items</h1>
          <p className="text-muted-foreground">Manage items in this collection</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Items List */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shirt className="h-5 w-5" />
              Collection Items ({items?.length || 0})
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingItem ? "Edit Item" : "Create Item"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Price</Label>
                      <Input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Rarity</Label>
                      <Select value={formData.rarity} onValueChange={(v) => setFormData({ ...formData, rarity: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RARITIES.map((r) => (
                            <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Switch checked={formData.is_premium} onCheckedChange={(c) => setFormData({ ...formData, is_premium: c })} />
                      <Label>Premium</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={formData.is_limited_edition} onCheckedChange={(c) => setFormData({ ...formData, is_limited_edition: c })} />
                      <Label>Limited</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={formData.featured} onCheckedChange={(c) => setFormData({ ...formData, featured: c })} />
                      <Label>Featured</Label>
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    {editingItem ? "Update" : "Create"} Item
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : items?.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Rarity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.name}
                          {item.featured && <Sparkles className="h-3 w-3 text-warning" />}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{item.category}</TableCell>
                      <TableCell>
                        <Badge variant={rarityColor[item.rarity || "common"] as any} className="capitalize">
                          {item.rarity || "common"}
                        </Badge>
                      </TableCell>
                      <TableCell>${item.price || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => unassignMutation.mutate(item.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">No items in collection</p>
            )}
          </CardContent>
        </Card>

        {/* Unassigned Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unassigned Items</CardTitle>
          </CardHeader>
          <CardContent>
            {unassignedItems?.length ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {unassignedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => assignMutation.mutate(item.id)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">All items are assigned</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CollectionItemsAdmin;
