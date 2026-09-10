import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Edit, Plus, Shirt, Sparkles, Trash2, Zap } from "lucide-react";

const CATEGORIES = ["shirt", "pants", "jacket", "shoes", "accessory", "hat"];
const SLOTS = ["top", "outerwear", "bottom", "footwear", "headwear", "accessory"];
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

interface BonusConfig {
  daily_xp: number;
  daily_ap: number;
  performance_pct: number;
  recording_pct: number;
  songwriting_pct: number;
}

interface ClothingForm {
  name: string;
  description: string;
  category: string;
  wearable_slot: string;
  price: number;
  rarity: string;
  color_variants_text: string;
  is_premium: boolean;
  is_limited_edition: boolean;
  featured: boolean;
  bonus_enabled: boolean;
  bonuses: BonusConfig;
}

const EMPTY_BONUSES: BonusConfig = {
  daily_xp: 0,
  daily_ap: 0,
  performance_pct: 0,
  recording_pct: 0,
  songwriting_pct: 0,
};

const emptyForm = (): ClothingForm => ({
  name: "",
  description: "",
  category: "shirt",
  wearable_slot: "top",
  price: 100,
  rarity: "common",
  color_variants_text: "#000000, #FFFFFF",
  is_premium: false,
  is_limited_edition: false,
  featured: false,
  bonus_enabled: false,
  bonuses: { ...EMPTY_BONUSES },
});

const compactBonuses = (bonuses: BonusConfig) => Object.fromEntries(
  Object.entries(bonuses).filter(([, value]) => Number(value) > 0),
);

const bonusSummary = (item: any) => {
  if (!item.bonus_enabled) return [];
  const b = item.bonus_config || {};
  return [
    b.daily_xp ? `+${b.daily_xp} daily XP` : null,
    b.daily_ap ? `+${b.daily_ap} daily AP` : null,
    b.performance_pct ? `+${b.performance_pct}% performance` : null,
    b.recording_pct ? `+${b.recording_pct}% recording` : null,
    b.songwriting_pct ? `+${b.songwriting_pct}% songwriting` : null,
  ].filter(Boolean) as string[];
};

const CollectionItemsAdmin = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<ClothingForm>(emptyForm());

  const { data: collection } = useQuery({
    queryKey: ["admin-collection", collectionId],
    queryFn: async () => {
      const { data, error } = await supabase.from("skin_collections").select("*").eq("id", collectionId).single();
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

  const toPayload = (data: ClothingForm) => ({
    name: data.name.trim(),
    description: data.description.trim() || null,
    category: data.category,
    wearable_slot: data.wearable_slot,
    price: data.price,
    rarity: data.rarity,
    color_variants: data.color_variants_text.split(",").map((value) => value.trim()).filter(Boolean),
    is_premium: data.is_premium,
    is_limited_edition: data.is_limited_edition,
    featured: data.featured,
    bonus_enabled: data.bonus_enabled,
    bonus_config: data.bonus_enabled ? compactBonuses(data.bonuses) : {},
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-collection-items"] });
    queryClient.invalidateQueries({ queryKey: ["admin-unassigned-items"] });
    queryClient.invalidateQueries({ queryKey: ["clothing-items"] });
    queryClient.invalidateQueries({ queryKey: ["featured-items"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: ClothingForm) => {
      const { error } = await supabase.from("avatar_clothing_items").insert({
        ...toPayload(data),
        collection_id: collectionId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Clothing item created and added to skin pack");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClothingForm }) => {
      const { error } = await supabase.from("avatar_clothing_items").update(toPayload(data) as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Clothing item updated");
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("avatar_clothing_items").update({ collection_id: collectionId }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Clothing item added to skin pack");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unassignMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("avatar_clothing_items").update({ collection_id: null }).eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Clothing item removed from skin pack");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingItem(null);
  };

  const handleEdit = (item: any) => {
    const bonus = item.bonus_config || {};
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      category: item.category,
      wearable_slot: item.wearable_slot || "accessory",
      price: item.price || 0,
      rarity: item.rarity || "common",
      color_variants_text: Array.isArray(item.color_variants) ? item.color_variants.join(", ") : "#000000, #FFFFFF",
      is_premium: !!item.is_premium,
      is_limited_edition: !!item.is_limited_edition,
      featured: !!item.featured,
      bonus_enabled: !!item.bonus_enabled,
      bonuses: {
        daily_xp: Number(bonus.daily_xp || 0),
        daily_ap: Number(bonus.daily_ap || 0),
        performance_pct: Number(bonus.performance_pct || 0),
        recording_pct: Number(bonus.recording_pct || 0),
        songwriting_pct: Number(bonus.songwriting_pct || 0),
      },
    });
    setIsDialogOpen(true);
  };

  const setBonus = (key: keyof BonusConfig, value: number) => {
    setFormData((current) => ({ ...current, bonuses: { ...current.bonuses, [key]: Math.max(0, value || 0) } }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (editingItem) updateMutation.mutate({ id: editingItem.id, data: formData });
    else createMutation.mutate(formData);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/skin-collections")}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{collection?.name || "Skin Pack"} Clothing</h1>
          <p className="text-muted-foreground">Create wearable items, configure bonuses, and assign existing clothing to this skin pack.</p>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5 text-sm text-muted-foreground">
          <strong className="text-foreground">Bonus safeguards:</strong> each item is limited to +25 daily XP, +5 daily AP and +10% per specialist boost. The equipped outfit is capped at +50 XP, +10 AP and +20% for performance, recording and songwriting.
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Shirt className="h-5 w-5" />Pack Items ({items?.length || 0})</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Create Clothing</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editingItem ? "Edit Clothing Item" : "Create Clothing Item"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Name</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required /></div>
                    <div className="space-y-2"><Label>Price</Label><Input type="number" min={0} value={formData.price} onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })} /></div>
                  </div>
                  <div className="space-y-2"><Label>Description</Label><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Category</Label><Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((value) => <SelectItem key={value} value={value} className="capitalize">{value}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Wearable slot</Label><Select value={formData.wearable_slot} onValueChange={(value) => setFormData({ ...formData, wearable_slot: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SLOTS.map((value) => <SelectItem key={value} value={value} className="capitalize">{value}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Rarity</Label><Select value={formData.rarity} onValueChange={(value) => setFormData({ ...formData, rarity: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RARITIES.map((value) => <SelectItem key={value} value={value} className="capitalize">{value}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div className="space-y-2"><Label>Colour variants</Label><Input value={formData.color_variants_text} onChange={(e) => setFormData({ ...formData, color_variants_text: e.target.value })} placeholder="#000000, #FFFFFF, #D97706" /><p className="text-xs text-muted-foreground">Comma-separated colours available to the player.</p></div>

                  <div className="flex flex-wrap gap-5">
                    <div className="flex items-center gap-2"><Switch checked={formData.is_premium} onCheckedChange={(checked) => setFormData({ ...formData, is_premium: checked })} /><Label>Premium</Label></div>
                    <div className="flex items-center gap-2"><Switch checked={formData.is_limited_edition} onCheckedChange={(checked) => setFormData({ ...formData, is_limited_edition: checked })} /><Label>Limited</Label></div>
                    <div className="flex items-center gap-2"><Switch checked={formData.featured} onCheckedChange={(checked) => setFormData({ ...formData, featured: checked })} /><Label>Featured</Label></div>
                  </div>

                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base flex items-center justify-between"><span className="flex items-center gap-2"><Zap className="h-4 w-4" />Equipped bonuses</span><Switch checked={formData.bonus_enabled} onCheckedChange={(checked) => setFormData({ ...formData, bonus_enabled: checked })} /></CardTitle></CardHeader>
                    {formData.bonus_enabled && <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="space-y-1"><Label>Daily XP</Label><Input type="number" min={0} max={25} value={formData.bonuses.daily_xp} onChange={(e) => setBonus("daily_xp", Number(e.target.value))} /></div>
                      <div className="space-y-1"><Label>Daily AP</Label><Input type="number" min={0} max={5} value={formData.bonuses.daily_ap} onChange={(e) => setBonus("daily_ap", Number(e.target.value))} /></div>
                      <div className="space-y-1"><Label>Performance %</Label><Input type="number" min={0} max={10} value={formData.bonuses.performance_pct} onChange={(e) => setBonus("performance_pct", Number(e.target.value))} /></div>
                      <div className="space-y-1"><Label>Recording %</Label><Input type="number" min={0} max={10} value={formData.bonuses.recording_pct} onChange={(e) => setBonus("recording_pct", Number(e.target.value))} /></div>
                      <div className="space-y-1"><Label>Songwriting %</Label><Input type="number" min={0} max={10} value={formData.bonuses.songwriting_pct} onChange={(e) => setBonus("songwriting_pct", Number(e.target.value))} /></div>
                    </CardContent>}
                  </Card>

                  <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>{editingItem ? "Update" : "Create & Add to Pack"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground">Loading...</p> : items?.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Slot</TableHead><TableHead>Rarity</TableHead><TableHead>Bonuses</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{items.map((item: any) => {
                  const bonuses = bonusSummary(item);
                  return <TableRow key={item.id}>
                    <TableCell><div className="font-medium flex items-center gap-2">{item.name}{item.featured && <Sparkles className="h-3 w-3 text-warning" />}</div><div className="text-xs text-muted-foreground capitalize">{item.category} · ${item.price || 0}</div></TableCell>
                    <TableCell className="capitalize">{item.wearable_slot || "—"}</TableCell>
                    <TableCell><Badge variant={item.rarity === "legendary" ? "destructive" : "secondary"} className="capitalize">{item.rarity || "common"}</Badge></TableCell>
                    <TableCell>{bonuses.length ? <div className="flex flex-wrap gap-1">{bonuses.map((bonus) => <Badge key={bonus} variant="outline" className="text-[10px]">{bonus}</Badge>)}</div> : <span className="text-xs text-muted-foreground">Cosmetic only</span>}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Remove from pack" onClick={() => unassignMutation.mutate(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></TableCell>
                  </TableRow>;
                })}</TableBody>
              </Table>
            ) : <p className="text-muted-foreground text-center py-8">No clothing in this skin pack yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Unassigned Clothing</CardTitle></CardHeader>
          <CardContent>{unassignedItems?.length ? <div className="space-y-2 max-h-[520px] overflow-y-auto">{unassignedItems.map((item: any) => <div key={item.id} className="flex items-center justify-between gap-2 p-3 border rounded-lg"><div className="min-w-0"><p className="text-sm font-medium truncate">{item.name}</p><p className="text-xs text-muted-foreground capitalize">{item.wearable_slot || item.category}{item.bonus_enabled ? " · bonus item" : ""}</p></div><Button size="sm" variant="outline" onClick={() => assignMutation.mutate(item.id)}><Plus className="h-3 w-3 mr-1" />Add</Button></div>)}</div> : <p className="text-sm text-muted-foreground">All clothing is currently assigned to a skin pack.</p>}</CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CollectionItemsAdmin;
