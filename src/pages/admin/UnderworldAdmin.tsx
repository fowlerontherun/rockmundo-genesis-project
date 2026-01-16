import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Coins, Plus, TrendingUp, TrendingDown, Package, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface UnderworldProduct {
  id: string;
  name: string;
  description: string | null;
  lore: string | null;
  category: string;
  rarity: string;
  price_cash: number | null;
  effects: Record<string, number | string>;
  duration_hours: number | null;
  is_available: boolean;
  icon_name: string | null;
}

const UnderworldAdmin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<UnderworldProduct | null>(null);
  
  const [newToken, setNewToken] = useState({
    symbol: "",
    name: "",
    current_price: 100,
    volume_24h: 100000,
    market_cap: 1000000,
    description: "",
  });

  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    lore: "",
    category: "consumable",
    rarity: "common",
    price_cash: 500,
    duration_hours: null as number | null,
    is_available: true,
    icon_name: "Package",
    effects: {
      health: 0,
      energy: 0,
      xp: 0,
      fame: 0,
      xp_multiplier: 0,
      fame_multiplier: 0,
      skill_slug: "",
      skill_xp: 0,
    },
  });

  // Fetch tokens
  const { data: tokens = [] } = useQuery({
    queryKey: ["admin-crypto-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crypto_tokens")
        .select("*")
        .order("market_cap", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ["admin-underworld-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("underworld_products")
        .select("*")
        .order("category", { ascending: true });
      if (error) throw error;
      return (data || []) as UnderworldProduct[];
    },
  });

  // Token mutations
  const createToken = useMutation({
    mutationFn: async (tokenData: typeof newToken) => {
      const { data, error } = await supabase
        .from("crypto_tokens")
        .insert([{ ...tokenData, price_history: [] }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-crypto-tokens"] });
      toast({ title: "Crypto Token Created" });
      setTokenDialogOpen(false);
      setNewToken({
        symbol: "",
        name: "",
        current_price: 100,
        volume_24h: 100000,
        market_cap: 1000000,
        description: "",
      });
    },
  });

  const updatePrice = useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number }) => {
      const { data, error } = await supabase
        .from("crypto_tokens")
        .update({ current_price: price })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-crypto-tokens"] });
      toast({ title: "Price Updated" });
    },
  });

  // Product mutations
  const saveProduct = useMutation({
    mutationFn: async (productData: typeof newProduct & { id?: string }) => {
      // Build effects object, filtering out zero/empty values
      const effects: Record<string, number | string> = {};
      if (productData.effects.health) effects.health = productData.effects.health;
      if (productData.effects.energy) effects.energy = productData.effects.energy;
      if (productData.effects.xp) effects.xp = productData.effects.xp;
      if (productData.effects.fame) effects.fame = productData.effects.fame;
      if (productData.effects.xp_multiplier) effects.xp_multiplier = productData.effects.xp_multiplier;
      if (productData.effects.fame_multiplier) effects.fame_multiplier = productData.effects.fame_multiplier;
      if (productData.effects.skill_slug && productData.effects.skill_xp) {
        effects.skill_slug = productData.effects.skill_slug;
        effects.skill_xp = productData.effects.skill_xp;
      }

      const payload = {
        name: productData.name,
        description: productData.description || null,
        lore: productData.lore || null,
        category: productData.category,
        rarity: productData.rarity,
        price_cash: productData.price_cash,
        duration_hours: productData.duration_hours,
        is_available: productData.is_available,
        icon_name: productData.icon_name,
        effects,
      };

      if (productData.id) {
        const { error } = await supabase
          .from("underworld_products")
          .update(payload)
          .eq("id", productData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("underworld_products")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-underworld-products"] });
      toast({ title: editingProduct ? "Product Updated" : "Product Created" });
      setProductDialogOpen(false);
      setEditingProduct(null);
      resetProductForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("underworld_products")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-underworld-products"] });
      toast({ title: "Product Deleted" });
    },
  });

  const toggleProductAvailability = useMutation({
    mutationFn: async ({ id, is_available }: { id: string; is_available: boolean }) => {
      const { error } = await supabase
        .from("underworld_products")
        .update({ is_available })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-underworld-products"] });
    },
  });

  const resetProductForm = () => {
    setNewProduct({
      name: "",
      description: "",
      lore: "",
      category: "consumable",
      rarity: "common",
      price_cash: 500,
      duration_hours: null,
      is_available: true,
      icon_name: "Package",
      effects: {
        health: 0,
        energy: 0,
        xp: 0,
        fame: 0,
        xp_multiplier: 0,
        fame_multiplier: 0,
        skill_slug: "",
        skill_xp: 0,
      },
    });
  };

  const openEditProduct = (product: UnderworldProduct) => {
    setEditingProduct(product);
    const effects = product.effects || {};
    setNewProduct({
      name: product.name,
      description: product.description || "",
      lore: product.lore || "",
      category: product.category,
      rarity: product.rarity,
      price_cash: product.price_cash || 500,
      duration_hours: product.duration_hours,
      is_available: product.is_available,
      icon_name: product.icon_name || "Package",
      effects: {
        health: (effects.health as number) || 0,
        energy: (effects.energy as number) || 0,
        xp: (effects.xp as number) || 0,
        fame: (effects.fame as number) || 0,
        xp_multiplier: (effects.xp_multiplier as number) || 0,
        fame_multiplier: (effects.fame_multiplier as number) || 0,
        skill_slug: (effects.skill_slug as string) || "",
        skill_xp: (effects.skill_xp as number) || 0,
      },
    });
    setProductDialogOpen(true);
  };

  const rarityColors: Record<string, string> = {
    common: "bg-muted text-muted-foreground",
    uncommon: "bg-emerald-500/20 text-emerald-400",
    rare: "bg-blue-500/20 text-blue-400",
    epic: "bg-purple-500/20 text-purple-400",
    legendary: "bg-amber-500/20 text-amber-400",
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Coins className="h-8 w-8" />
            Underworld Administration
          </h1>
          <p className="text-muted-foreground">Manage crypto tokens and shadow store products</p>
        </div>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Store Products</TabsTrigger>
          <TabsTrigger value="tokens">Crypto Tokens</TabsTrigger>
          <TabsTrigger value="stats">Statistics</TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={productDialogOpen} onOpenChange={(open) => {
              setProductDialogOpen(open);
              if (!open) {
                setEditingProduct(null);
                resetProductForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingProduct ? "Edit Product" : "Create New Product"}</DialogTitle>
                  <DialogDescription>
                    {editingProduct ? "Update the product details" : "Add a new item to the Shadow Store"}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        placeholder="Shadow Elixir"
                      />
                    </div>
                    <div>
                      <Label>Icon Name</Label>
                      <Input
                        value={newProduct.icon_name}
                        onChange={(e) => setNewProduct({ ...newProduct, icon_name: e.target.value })}
                        placeholder="Zap, Heart, Star, etc."
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      placeholder="What this item does..."
                    />
                  </div>
                  
                  <div>
                    <Label>Lore (Flavor Text)</Label>
                    <Textarea
                      value={newProduct.lore}
                      onChange={(e) => setNewProduct({ ...newProduct, lore: e.target.value })}
                      placeholder="The mysterious origins of this item..."
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Category</Label>
                      <Select
                        value={newProduct.category}
                        onValueChange={(v) => setNewProduct({ ...newProduct, category: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consumable">Consumable</SelectItem>
                          <SelectItem value="booster">Booster</SelectItem>
                          <SelectItem value="skill_book">Skill Book</SelectItem>
                          <SelectItem value="collectible">Collectible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Rarity</Label>
                      <Select
                        value={newProduct.rarity}
                        onValueChange={(v) => setNewProduct({ ...newProduct, rarity: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="common">Common</SelectItem>
                          <SelectItem value="uncommon">Uncommon</SelectItem>
                          <SelectItem value="rare">Rare</SelectItem>
                          <SelectItem value="epic">Epic</SelectItem>
                          <SelectItem value="legendary">Legendary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Price (Cash)</Label>
                      <Input
                        type="number"
                        value={newProduct.price_cash}
                        onChange={(e) => setNewProduct({ ...newProduct, price_cash: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Duration (hours, for boosters)</Label>
                      <Input
                        type="number"
                        value={newProduct.duration_hours || ""}
                        onChange={(e) => setNewProduct({ 
                          ...newProduct, 
                          duration_hours: e.target.value ? parseInt(e.target.value) : null 
                        })}
                        placeholder="Leave empty for instant effects"
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <Switch
                        checked={newProduct.is_available}
                        onCheckedChange={(checked) => setNewProduct({ ...newProduct, is_available: checked })}
                      />
                      <Label>Available for purchase</Label>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Instant Effects</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label>Health</Label>
                        <Input
                          type="number"
                          value={newProduct.effects.health || ""}
                          onChange={(e) => setNewProduct({
                            ...newProduct,
                            effects: { ...newProduct.effects, health: parseInt(e.target.value) || 0 }
                          })}
                        />
                      </div>
                      <div>
                        <Label>Energy</Label>
                        <Input
                          type="number"
                          value={newProduct.effects.energy || ""}
                          onChange={(e) => setNewProduct({
                            ...newProduct,
                            effects: { ...newProduct.effects, energy: parseInt(e.target.value) || 0 }
                          })}
                        />
                      </div>
                      <div>
                        <Label>XP</Label>
                        <Input
                          type="number"
                          value={newProduct.effects.xp || ""}
                          onChange={(e) => setNewProduct({
                            ...newProduct,
                            effects: { ...newProduct.effects, xp: parseInt(e.target.value) || 0 }
                          })}
                        />
                      </div>
                      <div>
                        <Label>Fame</Label>
                        <Input
                          type="number"
                          value={newProduct.effects.fame || ""}
                          onChange={(e) => setNewProduct({
                            ...newProduct,
                            effects: { ...newProduct.effects, fame: parseInt(e.target.value) || 0 }
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Multiplier Effects (for Boosters)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>XP Multiplier (e.g., 1.25 for +25%)</Label>
                        <Input
                          type="number"
                          step="0.05"
                          value={newProduct.effects.xp_multiplier || ""}
                          onChange={(e) => setNewProduct({
                            ...newProduct,
                            effects: { ...newProduct.effects, xp_multiplier: parseFloat(e.target.value) || 0 }
                          })}
                        />
                      </div>
                      <div>
                        <Label>Fame Multiplier (e.g., 1.20 for +20%)</Label>
                        <Input
                          type="number"
                          step="0.05"
                          value={newProduct.effects.fame_multiplier || ""}
                          onChange={(e) => setNewProduct({
                            ...newProduct,
                            effects: { ...newProduct.effects, fame_multiplier: parseFloat(e.target.value) || 0 }
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Skill XP (for Skill Books)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Skill Slug</Label>
                        <Select
                          value={newProduct.effects.skill_slug}
                          onValueChange={(v) => setNewProduct({
                            ...newProduct,
                            effects: { ...newProduct.effects, skill_slug: v }
                          })}
                        >
                          <SelectTrigger><SelectValue placeholder="Select skill" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vocals">Vocals</SelectItem>
                            <SelectItem value="guitar">Guitar</SelectItem>
                            <SelectItem value="bass">Bass</SelectItem>
                            <SelectItem value="drums">Drums</SelectItem>
                            <SelectItem value="songwriting">Songwriting</SelectItem>
                            <SelectItem value="performance">Performance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Skill XP Amount</Label>
                        <Input
                          type="number"
                          value={newProduct.effects.skill_xp || ""}
                          onChange={(e) => setNewProduct({
                            ...newProduct,
                            effects: { ...newProduct.effects, skill_xp: parseInt(e.target.value) || 0 }
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={() => saveProduct.mutate(editingProduct ? { ...newProduct, id: editingProduct.id } : newProduct)}
                    className="w-full"
                  >
                    {editingProduct ? "Update Product" : "Create Product"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Shadow Store Products
              </CardTitle>
              <CardDescription>Manage items available in the Underworld store</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Rarity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Effects</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const effects = product.effects || {};
                    const effectsList: string[] = [];
                    if (effects.health) effectsList.push(`+${effects.health} HP`);
                    if (effects.energy) effectsList.push(`+${effects.energy} EN`);
                    if (effects.xp) effectsList.push(`+${effects.xp} XP`);
                    if (effects.fame) effectsList.push(`+${effects.fame} Fame`);
                    if (effects.xp_multiplier) effectsList.push(`${((effects.xp_multiplier as number) - 1) * 100}% XP`);
                    if (effects.fame_multiplier) effectsList.push(`${((effects.fame_multiplier as number) - 1) * 100}% Fame`);
                    if (effects.skill_xp) effectsList.push(`+${effects.skill_xp} Skill XP`);

                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="capitalize">{product.category.replace("_", " ")}</TableCell>
                        <TableCell>
                          <Badge className={rarityColors[product.rarity] || ""}>
                            {product.rarity}
                          </Badge>
                        </TableCell>
                        <TableCell>${product.price_cash?.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {effectsList.slice(0, 3).map((e, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{e}</Badge>
                            ))}
                            {effectsList.length > 3 && (
                              <Badge variant="outline" className="text-xs">+{effectsList.length - 3}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={product.is_available}
                            onCheckedChange={(checked) => 
                              toggleProductAvailability.mutate({ id: product.id, is_available: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => openEditProduct(product)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="text-destructive"
                              onClick={() => deleteProduct.mutate(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tokens Tab */}
        <TabsContent value="tokens" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Token
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Crypto Token</DialogTitle>
                  <DialogDescription>Add a new token to the Underworld marketplace</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Symbol</Label>
                    <Input
                      value={newToken.symbol}
                      onChange={(e) => setNewToken({ ...newToken, symbol: e.target.value.toUpperCase() })}
                      placeholder="e.g., VEIL"
                      maxLength={5}
                    />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newToken.name}
                      onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                      placeholder="e.g., Veil Shard"
                    />
                  </div>
                  <div>
                    <Label>Initial Price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={newToken.current_price}
                      onChange={(e) => setNewToken({ ...newToken, current_price: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>24h Volume ($)</Label>
                    <Input
                      type="number"
                      value={newToken.volume_24h}
                      onChange={(e) => setNewToken({ ...newToken, volume_24h: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Market Cap ($)</Label>
                    <Input
                      type="number"
                      value={newToken.market_cap}
                      onChange={(e) => setNewToken({ ...newToken, market_cap: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={newToken.description}
                      onChange={(e) => setNewToken({ ...newToken, description: e.target.value })}
                      placeholder="Token description..."
                    />
                  </div>
                  <Button onClick={() => createToken.mutate(newToken)} className="w-full">
                    Create Token
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Crypto Tokens</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>24h Volume</TableHead>
                    <TableHead>Market Cap</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((token: any) => (
                    <TableRow key={token.id}>
                      <TableCell className="font-mono font-bold">{token.symbol}</TableCell>
                      <TableCell>{token.name}</TableCell>
                      <TableCell>${token.current_price.toFixed(2)}</TableCell>
                      <TableCell>${token.volume_24h?.toLocaleString()}</TableCell>
                      <TableCell>${token.market_cap?.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updatePrice.mutate({ 
                              id: token.id, 
                              price: token.current_price * 1.05 
                            })}
                          >
                            <TrendingUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updatePrice.mutate({ 
                              id: token.id, 
                              price: token.current_price * 0.95 
                            })}
                          >
                            <TrendingDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Tokens</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{tokens.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Products</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{products.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Available Products</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{products.filter(p => p.is_available).length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Market Cap</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  ${tokens.reduce((sum: number, t: any) => sum + (t.market_cap || 0), 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">24h Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  ${tokens.reduce((sum: number, t: any) => sum + (t.volume_24h || 0), 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UnderworldAdmin;
