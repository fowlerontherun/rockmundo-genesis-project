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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Download, Edit, Layers3, Plus, Shirt, Sparkles, Trash2, Zap } from "lucide-react";
import { ClothingDesignStudio, DEFAULT_CLOTHING_DESIGN, type ClothingDesignConfig } from "@/components/admin/ClothingDesignStudio";
import { ClothingTransferPanel } from "@/components/admin/clothing/ClothingTransferPanel";
import { ClothingPreviewManager } from "@/components/admin/clothing/ClothingPreviewManager";
import { browserDownloadJson, slugifyExternalKey, toPortableClothingItem } from "@/features/clothing-transfer/clothingTransfer";

const CATEGORIES = ["shirt", "t-shirt", "tank-top", "hoodie", "sweater", "pants", "jeans", "shorts", "skirt", "dress", "jacket", "coat", "vest", "shoes", "boots", "trainers", "accessory", "hat", "glasses"];
const SLOTS = ["top", "outerwear", "bottom", "dress", "footwear", "headwear", "eyewear", "accessory"];
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
  design: ClothingDesignConfig;
}

const EMPTY_BONUSES: BonusConfig = { daily_xp: 0, daily_ap: 0, performance_pct: 0, recording_pct: 0, songwriting_pct: 0 };
const cloneDefaultDesign = (): ClothingDesignConfig => JSON.parse(JSON.stringify(DEFAULT_CLOTHING_DESIGN));

const emptyForm = (): ClothingForm => ({
  name: "",
  description: "",
  category: "t-shirt",
  wearable_slot: "top",
  price: 100,
  rarity: "common",
  color_variants_text: "#111111, #FFFFFF",
  is_premium: false,
  is_limited_edition: false,
  featured: false,
  bonus_enabled: false,
  bonuses: { ...EMPTY_BONUSES },
  design: cloneDefaultDesign(),
});

const compactBonuses = (bonuses: BonusConfig) => Object.fromEntries(Object.entries(bonuses).filter(([, value]) => Number(value) > 0));

const bonusSummary = (item: any) => {
  if (!item.bonus_enabled) return [];
  const b = item.bonus_config || {};
  return [
    b.daily_xp ? `+${b.daily_xp} XP/day` : null,
    b.daily_ap ? `+${b.daily_ap} AP/day` : null,
    b.performance_pct ? `+${b.performance_pct}% live` : null,
    b.recording_pct ? `+${b.recording_pct}% recording` : null,
    b.songwriting_pct ? `+${b.songwriting_pct}% songwriting` : null,
  ].filter(Boolean) as string[];
};

const designFromItem = (item: any): ClothingDesignConfig => ({
  garment: { ...DEFAULT_CLOTHING_DESIGN.garment, ...(item.garment_config || {}) },
  material: { ...DEFAULT_CLOTHING_DESIGN.material, ...(item.material_config || {}) },
  pattern: { ...DEFAULT_CLOTHING_DESIGN.pattern, ...(item.pattern_config || {}) },
  fit: { ...DEFAULT_CLOTHING_DESIGN.fit, ...(item.fit_config || {}) },
  wear: { ...DEFAULT_CLOTHING_DESIGN.wear, ...(item.wear_config || {}) },
  render: { ...DEFAULT_CLOTHING_DESIGN.render, ...(item.render_config || {}) },
  zones: Array.isArray(item.customization_zones) && item.customization_zones.length ? item.customization_zones : cloneDefaultDesign().zones,
  details: Array.isArray(item.detail_layers) ? item.detail_layers : [],
  variants: Array.isArray(item.variant_matrix) ? item.variant_matrix : [],
});

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
      const { data, error } = await supabase.from("avatar_clothing_items").select("*").eq("collection_id", collectionId).order("category");
      if (error) throw error;
      return data;
    },
  });

  const { data: unassignedItems } = useQuery({
    queryKey: ["admin-unassigned-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("avatar_clothing_items").select("*").is("collection_id", null).order("name");
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
    color_variants: data.color_variants_text.split(",").map(v => v.trim()).filter(Boolean),
    is_premium: data.is_premium,
    is_limited_edition: data.is_limited_edition,
    featured: data.featured,
    bonus_enabled: data.bonus_enabled,
    bonus_config: data.bonus_enabled ? compactBonuses(data.bonuses) : {},
    garment_config: data.design.garment,
    material_config: data.design.material,
    pattern_config: data.design.pattern,
    detail_layers: data.design.details.map(d => ({ ...d, opacity: Math.max(0, Math.min(1, d.opacity / 100)) })),
    fit_config: data.design.fit,
    wear_config: data.design.wear,
    customization_zones: data.design.zones,
    render_config: data.design.render,
    variant_matrix: data.design.variants,
    preview_status: "pending",
    shape_config: {
      ...(data.design.garment || {}),
      material: data.design.material.fabric,
      fit: data.design.fit.fit,
      pattern: data.design.pattern.type,
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-collection-items"] });
    queryClient.invalidateQueries({ queryKey: ["admin-unassigned-items"] });
    queryClient.invalidateQueries({ queryKey: ["clothing-items"] });
    queryClient.invalidateQueries({ queryKey: ["featured-items"] });
  };

  const resetForm = () => { setFormData(emptyForm()); setEditingItem(null); };

  const createMutation = useMutation({
    mutationFn: async (data: ClothingForm) => {
      const { error } = await supabase.from("avatar_clothing_items").insert({ ...toPayload(data), collection_id: collectionId, external_key: slugifyExternalKey(data.name), schema_version: 1 } as any);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Detailed clothing item created; preview generation required"); resetForm(); setIsDialogOpen(false); },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ClothingForm }) => {
      const { error } = await supabase.from("avatar_clothing_items").update(toPayload(data) as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Clothing design updated; generated previews invalidated"); resetForm(); setIsDialogOpen(false); },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignMutation = useMutation({
    mutationFn: async (itemId: string) => { const { error } = await supabase.from("avatar_clothing_items").update({ collection_id: collectionId, preview_status: "pending" } as any).eq("id", itemId); if (error) throw error; },
    onSuccess: () => { invalidate(); toast.success("Item added to skin pack; preview generation required"); },
  });

  const unassignMutation = useMutation({
    mutationFn: async (itemId: string) => { const { error } = await supabase.from("avatar_clothing_items").update({ collection_id: null }).eq("id", itemId); if (error) throw error; },
    onSuccess: () => { invalidate(); toast.success("Item removed from skin pack"); },
  });

  const handleEdit = (item: any) => {
    const bonus = item.bonus_config || {};
    const design = designFromItem(item);
    design.details = design.details.map((d: any) => ({ ...d, opacity: Number(d.opacity ?? 1) <= 1 ? Number(d.opacity ?? 1) * 100 : Number(d.opacity) }));
    setEditingItem(item);
    setFormData({
      name: item.name || "",
      description: item.description || "",
      category: item.category || "t-shirt",
      wearable_slot: item.wearable_slot || "top",
      price: Number(item.price || 0),
      rarity: item.rarity || "common",
      color_variants_text: Array.isArray(item.color_variants) ? item.color_variants.join(", ") : "#111111, #FFFFFF",
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
      design,
    });
    setIsDialogOpen(true);
  };

  const exportItem = (item: any) => {
    const portable = toPortableClothingItem(item, { id: collectionId, name: collection?.name, theme: collection?.theme });
    const safeName = String(item.name || "clothing-item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    browserDownloadJson(`rockmundo-${safeName || "clothing-item"}.json`, portable);
    toast.success(`Exported ${item.name}`);
  };

  const setBonus = (key: keyof BonusConfig, value: number) => setFormData(current => ({ ...current, bonuses: { ...current.bonuses, [key]: Math.max(0, value || 0) } }));
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); editingItem ? updateMutation.mutate({ id: editingItem.id, data: formData }) : createMutation.mutate(formData); };

  return <div className="container mx-auto p-6 space-y-6">
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon" onClick={() => navigate("/admin/skin-collections")}><ArrowLeft className="h-5 w-5" /></Button>
      <div><h1 className="text-2xl font-bold">{collection?.name || "Skin Pack"} Clothing Studio</h1><p className="text-muted-foreground">Build detailed wearable items with construction, materials, prints, layered details, fit, wear, variants and gameplay bonuses.</p></div>
    </div>

    <Card className="border-primary/20 bg-primary/5"><CardContent className="pt-5 text-sm text-muted-foreground">
      <strong className="text-foreground">Rich garment system:</strong> items can now carry separate construction, fabric/material, pattern, fit/drape, wear, render, editable-zone, layered-detail and named-variant data. Existing simple items remain compatible and receive sensible defaults when edited.
    </CardContent></Card>

    {collectionId && <ClothingTransferPanel collectionId={collectionId} collection={collection as any} items={(items || []) as any[]} onChanged={invalidate} />}
    {collectionId && <ClothingPreviewManager collectionId={collectionId} items={(items || []) as any[]} onChanged={invalidate} />}

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <Card className="xl:col-span-2"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Shirt className="h-5 w-5" />Pack Items ({items?.length || 0})</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={open => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Create Clothing</Button></DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[94vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingItem ? "Edit Detailed Clothing Item" : "Create Detailed Clothing Item"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Tabs defaultValue="identity"><TabsList className="grid grid-cols-4 w-full"><TabsTrigger value="identity">Identity</TabsTrigger><TabsTrigger value="design">Design Studio</TabsTrigger><TabsTrigger value="bonuses">Bonuses</TabsTrigger><TabsTrigger value="summary">Summary</TabsTrigger></TabsList>
                <TabsContent value="identity" className="space-y-5 pt-4">
                  <div className="grid sm:grid-cols-2 gap-4"><div className="space-y-2"><Label>Name</Label><Input required value={formData.name} onChange={e=>setFormData({...formData,name:e.target.value})}/></div><div className="space-y-2"><Label>Price</Label><Input type="number" min={0} value={formData.price} onChange={e=>setFormData({...formData,price:Number(e.target.value)})}/></div></div>
                  <div className="space-y-2"><Label>Description</Label><Textarea rows={3} value={formData.description} onChange={e=>setFormData({...formData,description:e.target.value})}/></div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>Category</Label><Select value={formData.category} onValueChange={v=>setFormData({...formData,category:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{CATEGORIES.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Wearable slot</Label><Select value={formData.wearable_slot} onValueChange={v=>setFormData({...formData,wearable_slot:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{SLOTS.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Rarity</Label><Select value={formData.rarity} onValueChange={v=>setFormData({...formData,rarity:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{RARITIES.map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div className="space-y-2"><Label>Quick colour variants</Label><Input value={formData.color_variants_text} onChange={e=>setFormData({...formData,color_variants_text:e.target.value})}/><p className="text-xs text-muted-foreground">Legacy/store palette. Rich named variants are configured in the Design Studio.</p></div>
                  <div className="flex flex-wrap gap-5"><div className="flex items-center gap-2"><Switch checked={formData.is_premium} onCheckedChange={v=>setFormData({...formData,is_premium:v})}/><Label>Premium</Label></div><div className="flex items-center gap-2"><Switch checked={formData.is_limited_edition} onCheckedChange={v=>setFormData({...formData,is_limited_edition:v})}/><Label>Limited edition</Label></div><div className="flex items-center gap-2"><Switch checked={formData.featured} onCheckedChange={v=>setFormData({...formData,featured:v})}/><Label>Featured</Label></div></div>
                </TabsContent>

                <TabsContent value="design" className="pt-4"><ClothingDesignStudio value={formData.design} onChange={design=>setFormData({...formData,design})}/></TabsContent>

                <TabsContent value="bonuses" className="pt-4"><Card><CardHeader><CardTitle className="text-base flex items-center justify-between"><span className="flex items-center gap-2"><Zap className="h-4 w-4"/>Equipped gameplay bonuses</span><Switch checked={formData.bonus_enabled} onCheckedChange={v=>setFormData({...formData,bonus_enabled:v})}/></CardTitle></CardHeader>{formData.bonus_enabled && <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-3"><div className="space-y-1"><Label>Daily XP</Label><Input type="number" min={0} max={25} value={formData.bonuses.daily_xp} onChange={e=>setBonus("daily_xp",Number(e.target.value))}/></div><div className="space-y-1"><Label>Daily AP</Label><Input type="number" min={0} max={5} value={formData.bonuses.daily_ap} onChange={e=>setBonus("daily_ap",Number(e.target.value))}/></div><div className="space-y-1"><Label>Performance %</Label><Input type="number" min={0} max={10} value={formData.bonuses.performance_pct} onChange={e=>setBonus("performance_pct",Number(e.target.value))}/></div><div className="space-y-1"><Label>Recording %</Label><Input type="number" min={0} max={10} value={formData.bonuses.recording_pct} onChange={e=>setBonus("recording_pct",Number(e.target.value))}/></div><div className="space-y-1"><Label>Songwriting %</Label><Input type="number" min={0} max={10} value={formData.bonuses.songwriting_pct} onChange={e=>setBonus("songwriting_pct",Number(e.target.value))}/></div></CardContent>}</Card></TabsContent>

                <TabsContent value="summary" className="pt-4 space-y-4"><div className="grid md:grid-cols-3 gap-4"><Card><CardHeader><CardTitle className="text-sm">Construction</CardTitle></CardHeader><CardContent className="text-sm space-y-1"><p>{formData.design.garment.silhouette} / {formData.design.garment.cut}</p><p>{formData.design.material.fabric}</p><p>{formData.design.pattern.type} pattern</p><p>{formData.design.fit.fit} fit</p></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Complexity</CardTitle></CardHeader><CardContent className="text-sm space-y-1"><p>{formData.design.zones.length} editable zones</p><p>{formData.design.details.length} detail layers</p><p>{formData.design.variants.length} named variants</p><p>{formData.design.wear.condition} condition</p></CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Rendering</CardTitle></CardHeader><CardContent className="text-sm space-y-1"><p>Layer {formData.design.render.layer}</p><p>Scale {formData.design.render.scale}%</p><p>Depth {formData.design.render.depthOffset}</p><p>{formData.design.render.castShadow ? "Casts shadow" : "No shadow"}</p></CardContent></Card></div></TabsContent>
              </Tabs>
              <div className="flex justify-end gap-2 sticky bottom-0 bg-background pt-3 border-t"><Button type="button" variant="outline" onClick={()=>setIsDialogOpen(false)}>Cancel</Button><Button type="submit" disabled={createMutation.isPending||updateMutation.isPending}>{editingItem?"Save Clothing Design":"Create Clothing Item"}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader><CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading clothing…</p> : <Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Construction</TableHead><TableHead>Customisation</TableHead><TableHead>Bonuses</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{(items||[]).map((item:any)=><TableRow key={item.id}><TableCell><div className="font-medium">{item.name}</div><div className="text-xs text-muted-foreground capitalize">{item.category} · {item.rarity}</div></TableCell><TableCell><div className="text-sm capitalize">{item.material_config?.fabric || "default"}</div><div className="text-xs text-muted-foreground">{item.garment_config?.silhouette || "classic"} · {item.pattern_config?.type || "solid"}</div></TableCell><TableCell><div className="flex gap-1 flex-wrap"><Badge variant="outline"><Layers3 className="h-3 w-3 mr-1"/>{Array.isArray(item.detail_layers)?item.detail_layers.length:0} details</Badge><Badge variant="outline">{Array.isArray(item.variant_matrix)?item.variant_matrix.length:0} variants</Badge><Badge variant={item.preview_status === "failed" ? "destructive" : "outline"}>{item.preview_status || "pending"} preview</Badge></div></TableCell><TableCell><div className="flex flex-wrap gap-1">{bonusSummary(item).length?bonusSummary(item).map(v=><Badge key={v} variant="secondary">{v}</Badge>):<span className="text-xs text-muted-foreground">Cosmetic only</span>}</div></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" title="Export item" onClick={()=>exportItem(item)}><Download className="h-4 w-4"/></Button><Button variant="ghost" size="icon" onClick={()=>handleEdit(item)}><Edit className="h-4 w-4"/></Button><Button variant="ghost" size="icon" onClick={()=>unassignMutation.mutate(item.id)}><Trash2 className="h-4 w-4"/></Button></TableCell></TableRow>)}</TableBody></Table>}
      </CardContent></Card>

      <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4"/>Unassigned Clothing</CardTitle></CardHeader><CardContent className="space-y-2">{(unassignedItems||[]).length===0?<p className="text-sm text-muted-foreground">No unassigned clothing.</p>:(unassignedItems||[]).map((item:any)=><div key={item.id} className="border rounded-lg p-3 flex items-center justify-between gap-2"><div><div className="font-medium text-sm">{item.name}</div><div className="text-xs text-muted-foreground capitalize">{item.category}</div></div><Button size="sm" variant="outline" onClick={()=>assignMutation.mutate(item.id)}>Add</Button></div>)}</CardContent></Card>
    </div>
  </div>;
};

export default CollectionItemsAdmin;