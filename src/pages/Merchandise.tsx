import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useToast } from "@/hooks/use-toast";
import { useMerchManager } from "@/hooks/useMerchManager";
import { calculateMerchQuality, type MerchItemRequirement } from "@/hooks/useMerchRequirements";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { MerchCatalog } from "@/components/merchandise/MerchCatalog";
import { MerchInventoryProductionPanel } from "@/components/merchandise/MerchInventoryProductionPanel";
import { MerchManagerCard } from "@/components/merchandise/MerchManagerCard";
import { MerchStudio } from "@/components/merchandise/MerchStudio";
import { OperatingCostsCard } from "@/components/merchandise/OperatingCostsCard";
import { SalesAnalyticsTab } from "@/components/merchandise/SalesAnalyticsTab";
import { VariantManager } from "@/components/merchandise/VariantManager";
import { SavedDesigns } from "@/components/merchandise/SavedDesigns";
import { BarChart3, ClipboardList, Loader2, PackagePlus, Shirt, Sparkles, Trash2, TrendingUp, Users } from "lucide-react";

type MerchandiseRow = Database["public"]["Tables"]["player_merchandise"]["Row"] & {
  pending_quantity?: number | null;
  production_status?: string | null;
  production_ready_at?: string | null;
  production_ordered_at?: string | null;
  production_total_cost?: number | null;
  production_discount_pct?: number | null;
  is_rush_order?: boolean | null;
  lead_time_days?: number | null;
  supplier_tier?: string | null;
};

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const number = new Intl.NumberFormat("en-US");

const Merchandise = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: primaryBand, isLoading: bandLoading } = usePrimaryBand();
  const bandId = primaryBand?.band_id ?? null;
  const bandName = primaryBand?.bands?.name ?? "Band";
  const bandFame = primaryBand?.bands?.fame ?? 0;
  const bandFans = primaryBand?.bands?.weekly_fans ?? 0;
  const { logisticsRate } = useMerchManager(bandId);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [editingDesignId, setEditingDesignId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const { data: playerProfile } = useQuery({
    queryKey: ["player-profile-level"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("level").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });
  const playerLevel = playerProfile?.level ?? 1;

  const { data: merchandise = [], isLoading: merchLoading } = useQuery<MerchandiseRow[]>({
    queryKey: ["player-merchandise", bandId],
    queryFn: async () => {
      if (!bandId) return [];
      const { data, error } = await supabase.from("player_merchandise").select("*").eq("band_id", bandId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MerchandiseRow[];
    },
    enabled: Boolean(bandId),
    refetchInterval: 60_000,
  });

  useEffect(() => { if (!selectedProductId && merchandise.length) setSelectedProductId(merchandise[0].id); }, [merchandise, selectedProductId]);
  const selectedProduct = useMemo(() => merchandise.find((item) => item.id === selectedProductId) ?? null, [merchandise, selectedProductId]);
  useEffect(() => { setEditName(selectedProduct?.design_name ?? ""); setEditPrice(String(selectedProduct?.selling_price ?? "")); }, [selectedProduct]);

  const summary = useMemo(() => merchandise.reduce((acc, item) => {
    const stock = Number(item.stock_quantity ?? 0);
    const pending = Number(item.pending_quantity ?? 0);
    const price = Number(item.selling_price ?? 0);
    const cost = Number(item.cost_to_produce ?? 0);
    acc.sellable += stock;
    acc.pending += pending;
    acc.revenue += stock * price;
    acc.cost += stock * cost;
    if (stock < 10) acc.low += 1;
    if (pending > 0) acc.inProduction += 1;
    return acc;
  }, { sellable: 0, pending: 0, revenue: 0, cost: 0, low: 0, inProduction: 0 }), [merchandise]);

  const catalogAddProduct = useMutation({
    mutationFn: async ({ item, designName, price, stock }: { item: MerchItemRequirement; designName: string; price: number; stock: number }) => {
      if (!bandId) throw new Error("Join a band to manage merchandise");
      const quality = calculateMerchQuality(item.base_quality_tier, bandFame, false);
      const { error } = await (supabase as any).from("player_merchandise").insert({ band_id: bandId, design_name: designName, item_type: item.item_type, cost_to_produce: item.base_cost, selling_price: price, stock_quantity: stock, quality_tier: quality });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Production order created", description: "Your merchandise run has been submitted." }); queryClient.invalidateQueries({ queryKey: ["player-merchandise", bandId] }); },
    onError: (error: Error) => toast({ title: "Unable to create merchandise", description: error.message, variant: "destructive" }),
  });

  const saveProduct = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error("Select a product first");
      const price = Math.max(0, Number(editPrice) || 0);
      const { error } = await supabase.from("player_merchandise").update({ design_name: editName.trim(), selling_price: price }).eq("id", selectedProduct.id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: "Product updated", description: "Name and selling price saved." }); queryClient.invalidateQueries({ queryKey: ["player-merchandise", bandId] }); },
    onError: (error: Error) => toast({ title: "Unable to update product", description: error.message, variant: "destructive" }),
  });

  const archiveProduct = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error("Select a product first");
      if (Number(selectedProduct.pending_quantity ?? 0) > 0) throw new Error("Wait for the active production run to complete before archiving this product");
      const { error } = await supabase.from("player_merchandise").delete().eq("id", selectedProduct.id);
      if (error) throw error;
    },
    onSuccess: () => { setSelectedProductId(null); toast({ title: "Product archived" }); queryClient.invalidateQueries({ queryKey: ["player-merchandise", bandId] }); },
    onError: (error: Error) => toast({ title: "Unable to archive product", description: error.message, variant: "destructive" }),
  });

  if (bandLoading || merchLoading) return <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading merchandise operations...</div>;
  if (!bandId) return <div className="container mx-auto px-4 py-12"><Card className="mx-auto max-w-2xl"><CardHeader><CardTitle>Join a band to manage merchandise</CardTitle><CardDescription>Merchandise creation, stock, production and sales are managed from your band workspace.</CardDescription></CardHeader></Card></div>;

  const tabs = [["overview", "Overview", BarChart3], ["sales", "Sales", TrendingUp], ["add-product", "Add Product", PackagePlus], ["manage-product", "Manage Inventory", ClipboardList], ["variants", "Variants", Shirt], ["designer", "Merch Studio", Sparkles], ["manager", "Manager", Users], ["costs", "Costs", BarChart3]] as const;

  return <FMPageScaffold title="Merchandise Operations" subtitle={`Run ${bandName}'s merchandise business: design products, order manufacturing, manage sellable stock and track sales.`} backTo="/hub/career-business" backLabel="Back to Career & Business" icon={Shirt}>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/40 p-1">{tabs.map(([value, label, Icon]) => <TabsTrigger key={value} value={value} className="gap-2"><Icon className="h-4 w-4" />{label}</TabsTrigger>)}</TabsList>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Card><CardHeader className="pb-2"><CardDescription>Products</CardDescription><CardTitle>{number.format(merchandise.length)}</CardTitle></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>Sellable units</CardDescription><CardTitle>{number.format(summary.sellable)}</CardTitle></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>In production</CardDescription><CardTitle>{number.format(summary.pending)}</CardTitle></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>Low stock</CardDescription><CardTitle>{number.format(summary.low)}</CardTitle></CardHeader></Card><Card><CardHeader className="pb-2"><CardDescription>Potential revenue</CardDescription><CardTitle>{currency.format(summary.revenue)}</CardTitle></CardHeader></Card></div>
        <Card><CardHeader><CardTitle>Current merchandise</CardTitle><CardDescription>Sellable inventory is separate from stock still being manufactured.</CardDescription></CardHeader><CardContent className="space-y-3">{merchandise.length === 0 ? <p className="text-sm text-muted-foreground">No merchandise yet. Use Add Product or Merch Studio to create your first run.</p> : merchandise.map((item) => { const stock = Number(item.stock_quantity ?? 0); const pending = Number(item.pending_quantity ?? 0); return <button key={item.id} onClick={() => { setSelectedProductId(item.id); setActiveTab("manage-product"); }} className="flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{item.design_name}</p><p className="text-xs text-muted-foreground">{item.item_type} · {currency.format(Number(item.selling_price ?? 0))}</p></div><div className="flex flex-wrap gap-2"><Badge variant="outline">{stock} sellable</Badge>{pending > 0 ? <Badge>{pending} in production</Badge> : null}{stock < 10 ? <Badge variant="destructive">Low stock</Badge> : null}</div></button>; })}</CardContent></Card>
      </TabsContent>

      <TabsContent value="sales"><SalesAnalyticsTab bandId={bandId} /></TabsContent>
      <TabsContent value="add-product"><MerchCatalog bandFame={bandFame} bandFans={bandFans} playerLevel={playerLevel} onAddProduct={(item, designName, price, stock) => catalogAddProduct.mutate({ item, designName, price, stock })} isAdding={catalogAddProduct.isPending} /></TabsContent>

      <TabsContent value="manage-product" className="space-y-6"><Card><CardHeader><CardTitle>Manage Inventory</CardTitle><CardDescription>Product details can be edited here, but physical stock is controlled only through supplier production orders.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label>Select product</Label><Select value={selectedProductId ?? ""} onValueChange={setSelectedProductId}><SelectTrigger><SelectValue placeholder="Choose a product" /></SelectTrigger><SelectContent>{merchandise.map((item) => <SelectItem key={item.id} value={item.id}>{item.design_name}</SelectItem>)}</SelectContent></Select></div>{selectedProduct ? <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Product name</Label><Input value={editName} onChange={(event) => setEditName(event.target.value)} /></div><div className="space-y-2"><Label>Selling price ($)</Label><Input type="number" min={0} value={editPrice} onChange={(event) => setEditPrice(event.target.value)} /></div><div className="space-y-2"><Label>Product type</Label><Input value={selectedProduct.item_type ?? ""} readOnly /></div><div className="space-y-2"><Label>Base production cost</Label><Input value={currency.format(Number(selectedProduct.cost_to_produce ?? 0))} readOnly /></div><MerchInventoryProductionPanel product={selectedProduct} bandId={bandId} /><div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:justify-between"><Button onClick={() => saveProduct.mutate()} disabled={saveProduct.isPending || !editName.trim()}>{saveProduct.isPending ? "Saving..." : "Save product details"}</Button><Button variant="destructive" onClick={() => archiveProduct.mutate()} disabled={archiveProduct.isPending || Number(selectedProduct.pending_quantity ?? 0) > 0}><Trash2 className="mr-2 h-4 w-4" />Archive product</Button></div></div> : <p className="text-sm text-muted-foreground">Select a product to manage it.</p>}</CardContent></Card></TabsContent>

      <TabsContent value="variants" className="space-y-6"><VariantManager merchandiseId={selectedProductId} productName={selectedProduct?.design_name ?? "Selected product"} basePrice={Number(selectedProduct?.selling_price ?? 0)} baseCost={Number(selectedProduct?.cost_to_produce ?? 0)} parentStock={Number(selectedProduct?.stock_quantity ?? 0)} /></TabsContent>

      <TabsContent value="designer" className="space-y-6"><div className="space-y-6"><MerchStudio bandId={bandId} existingDesignId={editingDesignId} onClearEditing={() => setEditingDesignId(null)} onSave={() => queryClient.invalidateQueries({ queryKey: ["tshirt-designs", bandId] })} /><SavedDesigns bandId={bandId} onLoadDesign={(designId) => { setEditingDesignId(designId); setActiveTab("designer"); }} /></div></TabsContent>
      <TabsContent value="manager"><MerchManagerCard bandId={bandId} /></TabsContent>
      <TabsContent value="costs"><OperatingCostsCard totalStock={summary.sellable} storageCostDaily={0.1} logisticsRate={logisticsRate} taxRate={0.08} totalRevenue={summary.revenue} /></TabsContent>
    </Tabs>
  </FMPageScaffold>;
};

export default Merchandise;
