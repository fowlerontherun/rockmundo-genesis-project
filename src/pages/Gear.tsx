import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useGameData } from "@/hooks/useGameData";
import { useEquipmentStore } from "@/hooks/useEquipmentStore";
import { useEquipPlayerEquipment } from "@/hooks/usePlayerEquipmentMutations";
import { 
  Guitar, 
  ShoppingCart, 
  Package, 
  Wrench, 
  TrendingUp, 
  Search,
  Sparkles,
  DollarSign,
  Activity,
  Zap,
  Heart,
  Brain,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";

const rarityColors: Record<string, string> = {
  common: "bg-slate-500",
  uncommon: "bg-emerald-500",
  rare: "bg-blue-500",
  epic: "bg-purple-500",
  legendary: "bg-amber-500",
};

const rarityTextColors: Record<string, string> = {
  common: "text-slate-500",
  uncommon: "text-emerald-500",
  rare: "text-blue-500",
  epic: "text-purple-500",
  legendary: "text-amber-500",
};

const statIcons: Record<string, any> = {
  performance: Activity,
  creativity: Sparkles,
  energy: Zap,
  health: Heart,
  focus: Brain,
  charisma: Star,
};

export default function Gear() {
  const { profile } = useGameData();
  const userId = profile?.user_id;
  
  const { catalog, inventory, isLoading, purchaseEquipment, maintainEquipment, isPurchasing, isMaintaining } = 
    useEquipmentStore(userId);
  const { equipGear, isUpdating } = useEquipPlayerEquipment();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [rarityFilter, setRarityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [compareItems, setCompareItems] = useState<string[]>([]);

  // Get categories from catalog
  const categories = useMemo(() => {
    const cats = new Set(catalog.map(item => item.category));
    return ["all", ...Array.from(cats)];
  }, [catalog]);

  // Filter and sort catalog
  const filteredCatalog = useMemo(() => {
    let filtered = catalog.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesRarity = rarityFilter === "all" || item.rarity?.toLowerCase() === rarityFilter;
      return matchesSearch && matchesCategory && matchesRarity;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price-low": return a.base_price - b.base_price;
        case "price-high": return b.base_price - a.base_price;
        case "quality": return (b.quality_rating || 0) - (a.quality_rating || 0);
        case "rarity": return (b.rarity || "").localeCompare(a.rarity || "");
        default: return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [catalog, searchQuery, categoryFilter, rarityFilter, sortBy]);

  // Equipped items
  const equippedItems = useMemo(() => 
    inventory.filter(item => item.is_equipped),
    [inventory]
  );

  // Items needing maintenance
  const needsMaintenance = useMemo(() => 
    inventory.filter(item => (item.condition || 100) < 70),
    [inventory]
  );

  const handlePurchase = (equipmentId: string) => {
    purchaseEquipment(equipmentId);
  };

  const handleMaintain = (inventoryId: string) => {
    maintainEquipment(inventoryId);
  };

  const handleEquip = (inventoryId: string, shouldEquip: boolean) => {
    equipGear({ 
      playerEquipmentId: inventoryId, 
      equip: shouldEquip,
      activityMessage: shouldEquip ? "Equipped new gear" : "Unequipped gear"
    });
  };

  const toggleCompare = (itemId: string) => {
    setCompareItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : prev.length < 3 ? [...prev, itemId] : prev
    );
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const renderStatBoosts = (statBoosts: any) => {
    if (!statBoosts || typeof statBoosts !== 'object') return null;

    return (
      <div className="grid grid-cols-2 gap-2 mt-3">
        {Object.entries(statBoosts).map(([stat, value]) => {
          const Icon = statIcons[stat.toLowerCase()] || TrendingUp;
          return (
            <div key={stat} className="flex items-center gap-2 text-sm">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize text-muted-foreground">{stat}:</span>
              <span className="font-semibold text-success">+{String(value)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Guitar className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-4xl font-bold">Gear</h1>
            <p className="text-muted-foreground">
              Manage your equipment and boost your performance
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Available Balance</div>
          <div className="text-2xl font-bold">{formatCurrency(profile?.cash || 0)}</div>
        </div>
      </div>

      <Tabs defaultValue="shop" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="shop">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Shop
          </TabsTrigger>
          <TabsTrigger value="inventory">
            <Package className="h-4 w-4 mr-2" />
            My Gear ({inventory.length})
          </TabsTrigger>
          <TabsTrigger value="equipped">
            <Guitar className="h-4 w-4 mr-2" />
            Equipped ({equippedItems.length})
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            <Wrench className="h-4 w-4 mr-2" />
            Maintenance ({needsMaintenance.length})
          </TabsTrigger>
        </TabsList>

        {/* Shop Tab */}
        <TabsContent value="shop" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search equipment..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat} className="capitalize">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Rarity</Label>
                  <Select value={rarityFilter} onValueChange={setRarityFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="common">Common</SelectItem>
                      <SelectItem value="uncommon">Uncommon</SelectItem>
                      <SelectItem value="rare">Rare</SelectItem>
                      <SelectItem value="epic">Epic</SelectItem>
                      <SelectItem value="legendary">Legendary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sort By</Label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="price-low">Price: Low to High</SelectItem>
                      <SelectItem value="price-high">Price: High to Low</SelectItem>
                      <SelectItem value="quality">Quality</SelectItem>
                      <SelectItem value="rarity">Rarity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Equipment Grid - Grouped by Category then Subcategory */}
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading equipment...</div>
          ) : filteredCatalog.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                No equipment found matching your filters.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-10">
              {/* Group items by category, then subcategory */}
              {Object.entries(
                filteredCatalog.reduce((acc, item) => {
                  const cat = item.category || 'other';
                  if (!acc[cat]) acc[cat] = {};
                  const subcat = item.subcategory || 'general';
                  if (!acc[cat][subcat]) acc[cat][subcat] = [];
                  acc[cat][subcat].push(item);
                  return acc;
                }, {} as Record<string, Record<string, typeof filteredCatalog>>)
              ).sort(([a], [b]) => a.localeCompare(b)).map(([category, subcategories]) => {
                const categoryLabels: Record<string, string> = {
                  instrument: "🎸 Instruments",
                  amplifier: "🔊 Amplifiers",
                  effects: "🎛️ Effects & Pedals",
                  recording: "🎙️ Recording & Microphones",
                  stage: "🎪 Stage & Live Equipment",
                  transport: "🚐 Transport"
                };
                const totalItems = Object.values(subcategories).flat().length;
                
                return (
                  <div key={category} className="space-y-6">
                    {/* Category Header */}
                    <div className="flex items-center gap-3 sticky top-0 bg-background/95 backdrop-blur py-3 z-20 border-b border-border">
                      <h2 className="text-2xl font-bold">
                        {categoryLabels[category] || category.charAt(0).toUpperCase() + category.slice(1)}
                      </h2>
                      <Badge variant="secondary">{totalItems} items</Badge>
                    </div>
                    
                    {/* Subcategories */}
                    <div className="space-y-6 pl-4 border-l-2 border-primary/20">
                      {Object.entries(subcategories).sort(([a], [b]) => a.localeCompare(b)).map(([subcategory, items]) => {
                        const formatSubcategory = (sub: string) => 
                          sub.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                        
                        return (
                          <div key={subcategory} className="space-y-3">
                            {/* Subcategory Header */}
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-muted-foreground">
                                {formatSubcategory(subcategory)}
                              </h3>
                              <Badge variant="outline" className="text-xs">{items.length}</Badge>
                            </div>
                            
                            {/* Items Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                              {items.map((item) => {
                                const isOwned = inventory.some(inv => inv.equipment_id === item.id);
                                const canAfford = (profile?.cash || 0) >= item.base_price;
                                
                                return (
                                  <Card key={item.id} className="relative overflow-hidden">
                                    <div className={cn(
                                      "absolute top-0 right-0 w-20 h-20 opacity-10",
                                      rarityColors[item.rarity?.toLowerCase() || "common"]
                                    )} style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }} />
                                    
                                    <CardHeader className="pb-2 pt-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                          <CardTitle className="text-sm truncate">{item.name}</CardTitle>
                                          {item.brand && (
                                            <CardDescription className="text-xs font-medium">
                                              {item.brand}
                                            </CardDescription>
                                          )}
                                        </div>
                                        <Badge className={cn("text-[10px] px-1.5", rarityColors[item.rarity?.toLowerCase() || "common"])}>
                                          {item.rarity}
                                        </Badge>
                                      </div>
                                    </CardHeader>
                                    
                                    <CardContent className="space-y-2 pt-0 pb-3">
                                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                                        {item.description}
                                      </p>

                                      <div className="flex gap-3 text-[11px]">
                                        <span>
                                          <span className="text-muted-foreground">Q:</span>
                                          <span className="font-semibold ml-0.5">{item.quality_rating}/10</span>
                                        </span>
                                        <span>
                                          <span className="text-muted-foreground">D:</span>
                                          <span className="font-semibold ml-0.5">{item.durability}</span>
                                        </span>
                                      </div>

                                      {item.stat_boosts && Object.keys(item.stat_boosts).length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {Object.entries(item.stat_boosts).slice(0, 3).map(([stat, value]) => (
                                            <Badge key={stat} variant="outline" className="text-[10px] py-0 px-1">
                                              {stat.slice(0, 3)}: +{String(value)}
                                            </Badge>
                                          ))}
                                        </div>
                                      )}

                                      <Separator />

                                      <div className="flex items-center justify-between">
                                        <div className="text-base font-bold">
                                          {formatCurrency(item.base_price)}
                                        </div>
                                        <Button
                                          size="sm"
                                          className="h-6 text-xs"
                                          onClick={() => handlePurchase(item.id)}
                                          disabled={!canAfford || isOwned || isPurchasing}
                                        >
                                          {isOwned ? "Owned" : canAfford ? "Buy" : "$$$"}
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comparison Panel */}
          {compareItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Compare Equipment ({compareItems.length}/3)</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCompareItems([])}
                >
                  Clear All
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {compareItems.map(itemId => {
                    const item = catalog.find(i => i.id === itemId);
                    if (!item) return null;
                    
                    return (
                      <div key={itemId} className="space-y-2 p-4 border rounded-lg">
                        <div className="font-bold">{item.name}</div>
                        <div className="text-sm text-muted-foreground">{formatCurrency(item.base_price)}</div>
                        <Badge className={cn(rarityColors[item.rarity?.toLowerCase() || "common"])}>
                          {item.rarity}
                        </Badge>
                        <Separator className="my-2" />
                        <div className="space-y-1 text-sm">
                          <div>Quality: {item.quality_rating}/10</div>
                          <div>Durability: {item.durability}</div>
                        </div>
                        {renderStatBoosts(item.stat_boosts)}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* My Gear Tab */}
        <TabsContent value="inventory" className="space-y-4">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading your gear...</div>
          ) : inventory.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">You don't own any equipment yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Visit the shop to purchase your first gear!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inventory.map((item) => (
                <Card key={item.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{item.equipment.name}</CardTitle>
                        <CardDescription className="text-xs capitalize">
                          {item.equipment.category}
                        </CardDescription>
                      </div>
                      {item.is_equipped && (
                        <Badge className="bg-success">Equipped</Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Condition</span>
                        <span className="font-semibold">{item.condition || 100}%</span>
                      </div>
                      <Progress value={item.condition || 100} />
                    </div>

                    {renderStatBoosts(item.equipment.stat_boosts)}

                    <div className="text-xs text-muted-foreground">
                      Purchased: {new Date(item.purchased_at).toLocaleDateString()}
                    </div>

                    <Separator />

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={item.is_equipped ? "destructive" : "default"}
                        onClick={() => handleEquip(item.id, !item.is_equipped)}
                        disabled={isUpdating}
                        className="flex-1"
                      >
                        {item.is_equipped ? "Unequip" : "Equip"}
                      </Button>
                      {(item.condition || 100) < 100 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMaintain(item.id)}
                          disabled={isMaintaining}
                        >
                          <Wrench className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Equipped Tab */}
        <TabsContent value="equipped" className="space-y-4">
          {equippedItems.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Guitar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No equipment currently equipped.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Total Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Total Equipment Bonuses</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {Object.entries(
                      equippedItems.reduce((acc, item) => {
                        const boosts = item.equipment.stat_boosts || {};
                        Object.entries(boosts).forEach(([stat, value]) => {
                          acc[stat] = (acc[stat] || 0) + (Number(value) || 0);
                        });
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([stat, total]) => {
                      const Icon = statIcons[stat.toLowerCase()] || TrendingUp;
                      return (
                        <div key={stat} className="text-center p-4 border rounded-lg">
                          <Icon className="h-8 w-8 mx-auto mb-2 text-primary" />
                          <div className="text-2xl font-bold text-success">+{total}</div>
                          <div className="text-sm text-muted-foreground capitalize">{stat}</div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Equipped Items */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {equippedItems.map((item) => (
                  <Card key={item.id} className="border-primary/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{item.equipment.name}</CardTitle>
                      <CardDescription className="text-xs capitalize">
                        {item.equipment.category}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Condition</span>
                          <span className="font-semibold">{item.condition || 100}%</span>
                        </div>
                        <Progress value={item.condition || 100} />
                      </div>

                      {renderStatBoosts(item.equipment.stat_boosts)}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEquip(item.id, false)}
                        disabled={isUpdating}
                        className="w-full"
                      >
                        Unequip
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Equipment Maintenance</CardTitle>
              <CardDescription>
                Keep your gear in top condition for optimal performance. Maintenance costs 10% of the item's base price.
              </CardDescription>
            </CardHeader>
          </Card>

          {needsMaintenance.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Wrench className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">All your equipment is in good condition!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {needsMaintenance.map((item) => {
                const maintenanceCost = Math.floor(item.equipment.base_price * 0.1);
                const canAfford = (profile?.cash || 0) >= maintenanceCost;
                const condition = item.condition || 100;
                
                return (
                  <Card key={item.id} className={cn(
                    condition < 30 && "border-destructive"
                  )}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{item.equipment.name}</CardTitle>
                          <CardDescription className="text-xs capitalize">
                            {item.equipment.category}
                          </CardDescription>
                        </div>
                        {condition < 30 && (
                          <Badge variant="destructive">Critical</Badge>
                        )}
                      </div>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Condition</span>
                          <span className={cn(
                            "font-semibold",
                            condition < 30 && "text-destructive",
                            condition < 50 && condition >= 30 && "text-warning"
                          )}>
                            {condition}%
                          </span>
                        </div>
                        <Progress 
                          value={condition} 
                          className={cn(
                            condition < 30 && "[&>div]:bg-destructive",
                            condition < 50 && condition >= 30 && "[&>div]:bg-warning"
                          )}
                        />
                      </div>

                      <div className="p-3 bg-muted rounded-lg">
                        <div className="text-sm text-muted-foreground mb-1">Maintenance Cost</div>
                        <div className="text-xl font-bold">
                          {formatCurrency(maintenanceCost)}
                        </div>
                      </div>

                      {item.last_maintained && (
                        <div className="text-xs text-muted-foreground">
                          Last maintained: {new Date(item.last_maintained).toLocaleDateString()}
                        </div>
                      )}

                      <Button
                        onClick={() => handleMaintain(item.id)}
                        disabled={!canAfford || isMaintaining}
                        className="w-full"
                      >
                        {canAfford ? "Maintain" : "Can't Afford"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
