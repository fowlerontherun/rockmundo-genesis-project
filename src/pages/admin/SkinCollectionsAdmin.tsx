import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Edit, Trash2, Sparkles, Calendar, Package, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { AvatarV2ClothingMigrationPanel } from "@/components/admin/avatar/AvatarV2ClothingMigrationPanel";

interface SkinCollection {
  id: string;
  name: string;
  description: string | null;
  theme: string | null;
  banner_image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const THEMES = [
  { value: "monthly", label: "Monthly Release" },
  { value: "holiday", label: "Holiday" },
  { value: "artist_collab", label: "Artist Collab" },
  { value: "vip", label: "VIP Exclusive" },
  { value: "limited", label: "Limited Edition" },
  { value: "seasonal", label: "Seasonal" },
];

const SkinCollectionsAdmin = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<SkinCollection | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    theme: "monthly",
    banner_image_url: "",
    starts_at: "",
    ends_at: "",
    is_active: true,
    sort_order: 0,
  });

  const { data: collections, isLoading } = useQuery({
    queryKey: ["admin-skin-collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("skin_collections")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as SkinCollection[];
    },
  });

  const { data: itemCounts } = useQuery({
    queryKey: ["admin-collection-item-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_clothing_items")
        .select("collection_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((item) => {
        if (item.collection_id) {
          counts[item.collection_id] = (counts[item.collection_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  const { data: curatedStats } = useQuery({
    queryKey: ["admin-curated-skin-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("avatar_clothing_items") as any)
        .select("collection_id, curated_asset_key, curated_asset_status");
      if (error) throw error;
      const stats: Record<string, { curated: number; published: number; qa: number; blocked: number; planned: number }> = {};
      for (const item of (data || []) as any[]) {
        if (!item.collection_id || !item.curated_asset_key) continue;
        const row = stats[item.collection_id] ||= { curated: 0, published: 0, qa: 0, blocked: 0, planned: 0 };
        row.curated += 1;
        if (item.curated_asset_status === "published") row.published += 1;
        else if (item.curated_asset_status === "blocked") row.blocked += 1;
        else if (item.curated_asset_status === "validated" || item.curated_asset_status === "asset_ready") row.qa += 1;
        else row.planned += 1;
      }
      return stats;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("skin_collections").insert({
        name: data.name,
        description: data.description || null,
        theme: data.theme,
        banner_image_url: data.banner_image_url || null,
        starts_at: data.starts_at,
        ends_at: data.ends_at || null,
        is_active: data.is_active,
        sort_order: data.sort_order,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-skin-collections"] });
      toast.success("Collection created successfully");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from("skin_collections")
        .update({
          name: data.name,
          description: data.description || null,
          theme: data.theme,
          banner_image_url: data.banner_image_url || null,
          starts_at: data.starts_at,
          ends_at: data.ends_at || null,
          is_active: data.is_active,
          sort_order: data.sort_order,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-skin-collections"] });
      toast.success("Collection updated successfully");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("skin_collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-skin-collections"] });
      toast.success("Collection deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      theme: "monthly",
      banner_image_url: "",
      starts_at: "",
      ends_at: "",
      is_active: true,
      sort_order: 0,
    });
    setEditingCollection(null);
  };

  const handleEdit = (collection: SkinCollection) => {
    setEditingCollection(collection);
    setFormData({
      name: collection.name,
      description: collection.description || "",
      theme: collection.theme || "monthly",
      banner_image_url: collection.banner_image_url || "",
      starts_at: collection.starts_at.split("T")[0],
      ends_at: collection.ends_at?.split("T")[0] || "",
      is_active: collection.is_active,
      sort_order: collection.sort_order,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCollection) {
      updateMutation.mutate({ id: editingCollection.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getThemeBadge = (theme: string | null) => {
    const themeConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      monthly: { variant: "default", label: "Monthly" },
      holiday: { variant: "destructive", label: "Holiday" },
      artist_collab: { variant: "secondary", label: "Collab" },
      vip: { variant: "outline", label: "VIP" },
      limited: { variant: "destructive", label: "Limited" },
      seasonal: { variant: "secondary", label: "Seasonal" },
    };
    const config = themeConfig[theme || "monthly"] || themeConfig.monthly;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Curated Skin Packs</h1>
            <p className="text-muted-foreground">Manage curated clothing packs, asset readiness, QA and store releases</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Collection
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCollection ? "Edit Collection" : "Create Collection"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select value={formData.theme} onValueChange={(v) => setFormData({ ...formData, theme: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEMES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner">Banner Image URL</Label>
                <Input
                  id="banner"
                  value={formData.banner_image_url}
                  onChange={(e) => setFormData({ ...formData, banner_image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="starts_at">Starts At</Label>
                  <Input
                    id="starts_at"
                    type="date"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ends_at">Ends At (optional)</Label>
                  <Input
                    id="ends_at"
                    type="date"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Sort Order</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Active</Label>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingCollection ? "Update" : "Create"} Collection
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" />Curated clothing workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Open a pack to see every curated asset, its stable asset key, lifecycle state, masculine/feminine support and the full performance QA checklist. Curated skins are kept out of the legacy procedural garment renderer.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(collections || []).filter(collection => ["starter wardrobe", "punk essentials"].includes(collection.name.toLowerCase())).map(collection => {
              const stats = curatedStats?.[collection.id] || { curated: 0, published: 0, qa: 0, blocked: 0, planned: 0 };
              return <button key={collection.id} type="button" onClick={() => navigate(`/admin/skin-collections/${collection.id}/items`)} className="rounded-lg border bg-background p-4 text-left transition-colors hover:border-primary/50">
                <div className="font-semibold">{collection.name}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge variant="outline">{stats.curated} curated</Badge>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">{stats.published} published</Badge>
                  {stats.qa > 0 && <Badge variant="outline" className="border-amber-500/30 text-amber-600">{stats.qa} in QA</Badge>}
                  {stats.planned > 0 && <Badge variant="secondary">{stats.planned} planned</Badge>}
                  {stats.blocked > 0 && <Badge variant="destructive">{stats.blocked} blocked</Badge>}
                </div>
                <div className="mt-3 text-xs text-primary">Open asset manager →</div>
              </button>;
            })}
          </div>
        </CardContent>
      </Card>

      {!isLoading && <AvatarV2ClothingMigrationPanel collections={collections ?? []} />}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            All Collections
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Theme</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Curated assets</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections?.map((collection) => (
                  <TableRow key={collection.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{collection.name}</p>
                        {collection.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {collection.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getThemeBadge(collection.theme)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{itemCounts?.[collection.id] || 0} items</Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const stats = curatedStats?.[collection.id];
                        return stats?.curated ? <div className="flex flex-wrap gap-1">
                          <Badge variant="outline">{stats.published}/{stats.curated} published</Badge>
                          {stats.qa > 0 && <Badge variant="outline" className="border-amber-500/30 text-amber-600">{stats.qa} QA</Badge>}
                          {stats.blocked > 0 && <Badge variant="destructive">{stats.blocked} blocked</Badge>}
                        </div> : <span className="text-xs text-muted-foreground">Legacy / none</span>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(collection.starts_at), "MMM d")}
                        {collection.ends_at && ` - ${format(new Date(collection.ends_at), "MMM d")}`}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={collection.is_active ? "default" : "secondary"}>
                        {collection.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/skin-collections/${collection.id}/items`)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Manage skins
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(collection)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this collection?")) {
                              deleteMutation.mutate(collection.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SkinCollectionsAdmin;
