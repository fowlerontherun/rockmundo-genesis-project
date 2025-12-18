import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Package, Loader2 } from "lucide-react";
import { MerchItemCard } from "./MerchItemCard";
import { useMerchRequirements, MerchItemRequirement, QUALITY_TIERS, checkMerchUnlocked, calculateMerchQuality } from "@/hooks/useMerchRequirements";
import { cn } from "@/lib/utils";

interface MerchCatalogProps {
  bandFame: number;
  bandFans: number;
  playerLevel: number;
  onAddProduct: (item: MerchItemRequirement, designName: string, price: number, stock: number) => void;
  isAdding?: boolean;
}

const CATEGORIES = ["All", "Apparel", "Accessories", "Collectibles", "Experiences", "Digital", "Bundles"];

export const MerchCatalog = ({
  bandFame,
  bandFans,
  playerLevel,
  onAddProduct,
  isAdding,
}: MerchCatalogProps) => {
  const { data: requirements, isLoading } = useMerchRequirements();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<MerchItemRequirement | null>(null);
  const [designName, setDesignName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("50");

  const filteredItems = useMemo(() => {
    if (!requirements) return [];
    
    return requirements.filter((item) => {
      const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
      const matchesSearch = searchQuery === "" || 
        item.item_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [requirements, selectedCategory, searchQuery]);

  const unlockedCount = useMemo(() => {
    if (!requirements) return 0;
    return requirements.filter((item) => 
      checkMerchUnlocked(item, bandFame, bandFans, playerLevel).unlocked
    ).length;
  }, [requirements, bandFame, bandFans, playerLevel]);

  const handleSelectItem = (item: MerchItemRequirement) => {
    setSelectedItem(item);
    setDesignName("");
    // Calculate suggested price based on quality and cost
    const quality = calculateMerchQuality(item.base_quality_tier, bandFame, false);
    const qualityMultiplier = QUALITY_TIERS[quality].priceMultiplier;
    const suggestedPrice = Math.round(item.base_cost * 2.5 * qualityMultiplier);
    setPrice(suggestedPrice.toString());
  };

  const handleAddProduct = () => {
    if (!selectedItem || !designName.trim()) return;
    onAddProduct(selectedItem, designName.trim(), parseInt(price) || 0, parseInt(stock) || 0);
    setSelectedItem(null);
    setDesignName("");
    setPrice("");
    setStock("50");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Catalog Browser */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Merchandise Catalog
                </CardTitle>
                <CardDescription>
                  {unlockedCount} of {requirements?.length || 0} items unlocked
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                Fame: {bandFame.toLocaleString()} | Fans: {bandFans.toLocaleString()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search & Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search merchandise..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Category Tabs */}
            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
              <TabsList className="w-full flex-wrap h-auto gap-1 bg-transparent p-0">
                {CATEGORIES.map((cat) => (
                  <TabsTrigger
                    key={cat}
                    value={cat}
                    className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    {cat}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Items Grid */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredItems.map((item) => (
                  <MerchItemCard
                    key={item.id}
                    item={item}
                    playerFame={bandFame}
                    playerFans={bandFans}
                    playerLevel={playerLevel}
                    onSelect={handleSelectItem}
                    isSelected={selectedItem?.id === item.id}
                  />
                ))}
                {filteredItems.length === 0 && (
                  <div className="col-span-2 text-center py-8 text-muted-foreground">
                    No merchandise found matching your criteria.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Product Configuration */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configure Product</CardTitle>
            <CardDescription>
              {selectedItem 
                ? `Setting up: ${selectedItem.item_type}`
                : "Select an item from the catalog"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedItem ? (
              <>
                {/* Selected Item Info */}
                <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{selectedItem.item_type}</span>
                    <Badge variant="outline" className={cn("text-xs", QUALITY_TIERS[selectedItem.base_quality_tier].color)}>
                      {QUALITY_TIERS[selectedItem.base_quality_tier].label} Quality
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedItem.description}</p>
                  <div className="flex justify-between text-xs">
                    <span>Production Cost: ${selectedItem.base_cost}</span>
                    <span>Sales Boost: {QUALITY_TIERS[selectedItem.base_quality_tier].salesMultiplier}x</span>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="product-name">Product Name *</Label>
                    <Input
                      id="product-name"
                      placeholder="e.g. Summer Tour 2024 Tee"
                      value={designName}
                      onChange={(e) => setDesignName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="sale-price">Sale Price ($)</Label>
                      <Input
                        id="sale-price"
                        type="number"
                        min={selectedItem.base_cost}
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Min: ${selectedItem.base_cost}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="initial-stock">Initial Stock</Label>
                      <Input
                        id="initial-stock"
                        type="number"
                        min={1}
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Profit Preview */}
                  {price && parseInt(price) > selectedItem.base_cost && (
                    <div className="p-2 bg-primary/5 rounded text-xs">
                      <div className="flex justify-between">
                        <span>Profit per item:</span>
                        <span className="font-medium text-green-600">
                          ${parseInt(price) - selectedItem.base_cost}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total potential profit:</span>
                        <span className="font-medium text-green-600">
                          ${(parseInt(price) - selectedItem.base_cost) * (parseInt(stock) || 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleAddProduct}
                  disabled={!designName.trim() || isAdding || parseInt(price) < selectedItem.base_cost}
                  className="w-full"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add to Inventory"
                  )}
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a merchandise item from the catalog to configure and add to your inventory.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quality Legend */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Quality Tiers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(QUALITY_TIERS).map(([tier, info]) => (
              <div key={tier} className="flex items-center justify-between text-xs">
                <span className={cn("font-medium", info.color)}>{info.label}</span>
                <span className="text-muted-foreground">
                  {info.salesMultiplier}x sales · {info.priceMultiplier}x price
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
