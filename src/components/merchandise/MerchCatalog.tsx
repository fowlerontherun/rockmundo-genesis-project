import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Package, Search, Sparkles, Truck } from "lucide-react";
import { MerchItemCard } from "./MerchItemCard";
import {
  MAX_MERCH_PRICE,
  QUALITY_TIERS,
  calculateMerchQuality,
  checkMerchUnlocked,
  getPricingImpact,
  getRecommendedPrice,
  type MerchItemRequirement,
  useMerchRequirements,
} from "@/hooks/useMerchRequirements";
import { cn } from "@/lib/utils";

interface MerchCatalogProps {
  bandFame: number;
  bandFans: number;
  playerLevel: number;
  onAddProduct: (item: MerchItemRequirement, designName: string, price: number, stock: number) => void;
  isAdding?: boolean;
}

const CATEGORIES = ["All", "Apparel", "Accessories", "Collectibles", "Digital", "Bundles", "Experiences"];

const getBulkDiscount = (quantity: number) => {
  if (quantity >= 1000) return 0.15;
  if (quantity >= 500) return 0.1;
  if (quantity >= 100) return 0.05;
  return 0;
};

export const MerchCatalog = ({ bandFame, bandFans, playerLevel, onAddProduct, isAdding }: MerchCatalogProps) => {
  const { data: requirements, isLoading } = useMerchRequirements();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<MerchItemRequirement | null>(null);
  const [designName, setDesignName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("10");

  const filteredItems = useMemo(() => (requirements ?? []).filter((item) => {
    const categoryMatch = selectedCategory === "All" || item.category === selectedCategory;
    const query = searchQuery.trim().toLowerCase();
    const queryMatch = !query || item.item_type.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query) || item.base_material?.toLowerCase().includes(query);
    return categoryMatch && queryMatch;
  }), [requirements, searchQuery, selectedCategory]);

  const normalProducts = (requirements ?? []).filter((item) => (item.product_kind ?? "physical") !== "experience");
  const availableNormalProducts = normalProducts.filter((item) => checkMerchUnlocked(item, bandFame, bandFans, playerLevel).unlocked).length;

  const selectItem = (item: MerchItemRequirement) => {
    if (!checkMerchUnlocked(item, bandFame, bandFans, playerLevel).unlocked) return;
    setSelectedItem(item);
    setDesignName("");
    const quality = calculateMerchQuality(item.base_quality_tier, bandFame, false);
    setPrice(String(getRecommendedPrice(item.base_cost, quality)));
    setStock(String(Math.max(1, item.min_order_qty ?? 1)));
  };

  const pricing = useMemo(() => {
    if (!selectedItem || !price) return null;
    const quality = calculateMerchQuality(selectedItem.base_quality_tier, bandFame, false);
    const recommended = getRecommendedPrice(selectedItem.base_cost, quality);
    return { recommended, impact: getPricingImpact(Number(price) || 0, recommended) };
  }, [selectedItem, price, bandFame]);

  const quantity = Number(stock) || 0;
  const minQty = Math.max(1, selectedItem?.min_order_qty ?? 1);
  const unitCost = selectedItem?.base_cost ?? 0;
  const bulkDiscount = getBulkDiscount(quantity);
  const effectiveUnitCost = unitCost * (1 - bulkDiscount);
  const productionTotal = Math.round(effectiveUnitCost * quantity * 100) / 100;
  const hasLeadTime = (selectedItem?.lead_time_days ?? 0) > 0;
  const isImmediate = !hasLeadTime;

  const submit = () => {
    if (!selectedItem || !designName.trim() || quantity < minQty) return;
    onAddProduct(selectedItem, designName.trim(), Number(price) || 0, quantity);
    setSelectedItem(null);
    setDesignName("");
    setPrice("");
    setStock("10");
  };

  if (isLoading) {
    return <Card><CardContent className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Product catalogue</CardTitle>
                <CardDescription>{availableNormalProducts} everyday products available now. Prestige gates are reserved for fan experiences.</CardDescription>
              </div>
              <Badge variant="secondary">POD-style supplier data</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search tees, hoodies, mugs, materials..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
            </div>
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
                {CATEGORIES.map((category) => <TabsTrigger key={category} value={category} className="text-xs">{category === "Experiences" ? "Fan Experiences" : category}</TabsTrigger>)}
              </TabsList>
            </Tabs>
            <ScrollArea className="h-[470px] pr-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredItems.map((item) => (
                  <MerchItemCard
                    key={item.id}
                    item={item}
                    playerFame={bandFame}
                    playerFans={bandFans}
                    playerLevel={playerLevel}
                    onSelect={selectItem}
                    isSelected={selectedItem?.id === item.id}
                  />
                ))}
                {!filteredItems.length ? <div className="col-span-2 py-10 text-center text-sm text-muted-foreground">No products match this filter.</div> : null}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Order a product run</CardTitle>
            <CardDescription>{selectedItem ? selectedItem.item_type : "Choose a product blank from the catalogue"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedItem ? (
              <>
                <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{selectedItem.item_type}</span>
                    <Badge variant="outline" className={cn("text-xs", QUALITY_TIERS[selectedItem.base_quality_tier].color)}>{QUALITY_TIERS[selectedItem.base_quality_tier].label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedItem.description}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Material</span><p className="font-medium">{selectedItem.base_material ?? "Standard stock"}</p></div>
                    <div><span className="text-muted-foreground">Supplier</span><p className="font-medium capitalize">{selectedItem.supplier_tier ?? "standard"}</p></div>
                    <div><span className="text-muted-foreground">Minimum run</span><p className="font-medium">{minQty} units</p></div>
                    <div><span className="text-muted-foreground">Lead time</span><p className="font-medium">{hasLeadTime ? `${selectedItem.lead_time_days} days` : "Immediate"}</p></div>
                  </div>
                  {selectedItem.is_personalisable ? <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" /> Personalise in Merch Studio</Badge> : null}
                </div>

                <div className="space-y-2">
                  <Label>Product / drop name</Label>
                  <Input value={designName} onChange={(event) => setDesignName(event.target.value)} placeholder="e.g. Autumn Tour Heavyweight Tee" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Sale price ($)</Label>
                    <Input type="number" min={Math.max(1, effectiveUnitCost)} max={MAX_MERCH_PRICE} value={price} onChange={(event) => setPrice(event.target.value)} />
                    {pricing ? <p className="text-xs text-muted-foreground">Recommended ${pricing.recommended} · <span className={pricing.impact.color}>{pricing.impact.label}</span></p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label>Production run</Label>
                    <Input type="number" min={minQty} value={stock} onChange={(event) => setStock(event.target.value)} />
                    <p className="text-xs text-muted-foreground">Minimum {minQty} units</p>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border p-3 text-sm">
                  <div className="flex justify-between"><span>Base unit cost</span><span>${unitCost.toFixed(2)}</span></div>
                  {bulkDiscount > 0 ? <div className="flex justify-between text-primary"><span>Bulk discount</span><span>-{Math.round(bulkDiscount * 100)}%</span></div> : null}
                  <div className="flex justify-between"><span>Effective unit cost</span><span>${effectiveUnitCost.toFixed(2)}</span></div>
                  <div className="flex justify-between font-medium"><span>Production order</span><span>${productionTotal.toLocaleString()}</span></div>
                  {hasLeadTime ? (
                    <div className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
                      <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>Estimated manufacturing time: {selectedItem.lead_time_days} days. Units will stay in production and cannot be sold until the run completes.</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
                      <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>This product has no supplier lead time and becomes available immediately.</span>
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  The production cost is charged to the band when you place the order. If the band cannot afford it, the order will not be created.
                </div>

                <Button className="w-full" onClick={submit} disabled={!designName.trim() || isAdding || quantity < minQty || Number(price) < Math.max(1, effectiveUnitCost) || Number(price) > MAX_MERCH_PRICE}>
                  {isAdding ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Placing order...</> : isImmediate ? "Create product" : "Place production order"}
                </Button>
              </>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground"><Package className="mx-auto mb-3 h-12 w-12 opacity-40" />Select a product to see its supplier, material, minimum order, lead time and production cost.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
