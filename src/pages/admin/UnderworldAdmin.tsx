import React, { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Coins, Plus, TrendingUp, TrendingDown, Package, Edit, Trash2, Shuffle, History, ShoppingCart, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { 
  UnderworldEffectsEditor, 
  type ProductEffects, 
  DEFAULT_EFFECTS, 
  parseEffects, 
  serializeEffects, 
  getEffectLabels 
} from "@/components/admin/UnderworldEffectsEditor";

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
  is_legal: boolean;
  icon_name: string | null;
}

interface CryptoToken {
  id: string;
  symbol: string;
  name: string;
  description: string | null;
  current_price: number;
  volume_24h: number | null;
  market_cap: number | null;
  price_history: any;
}

const UnderworldAdmin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [editTokenDialogOpen, setEditTokenDialogOpen] = useState(false);
  const [editingToken, setEditingToken] = useState<CryptoToken | null>(null);
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

  const [editToken, setEditToken] = useState({
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
    is_legal: false,
    icon_name: "Package",
    effects: { ...DEFAULT_EFFECTS },
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
      return (data || []) as CryptoToken[];
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

  // Fetch purchase history
  const { data: purchases = [] } = useQuery({
    queryKey: ["admin-underworld-purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("underworld_purchases")
        .select(`
          *,
          product:underworld_products(name, category, rarity),
          profile:profiles(stage_name)
        `)
        .order("purchased_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch token transactions
  const { data: tokenTransactions = [] } = useQuery({
    queryKey: ["admin-token-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_transactions")
        .select(`
          *,
          token:crypto_tokens(symbol, name),
          profile:profiles(stage_name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch active boosts
  const { data: activeBoosts = [] } = useQuery({
    queryKey: ["admin-active-boosts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_active_boosts")
        .select(`
          *,
          product:underworld_products(name, category),
          profile:profiles(stage_name)
        `)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true });
      if (error) throw error;
      return data || [];
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

  const updateToken = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CryptoToken> }) => {
      const { error } = await supabase
        .from("crypto_tokens")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-crypto-tokens"] });
      toast({ title: "Token Updated" });
      setEditTokenDialogOpen(false);
      setEditingToken(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteToken = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crypto_tokens")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-crypto-tokens"] });
      toast({ title: "Token Deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
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

  const simulatePrices = useMutation({
    mutationFn: async () => {
      const updates = tokens.map(async (token) => {
        const volatility = 0.1; // 10% max change
        const change = (Math.random() - 0.5) * 2 * volatility;
        const newPrice = Math.max(0.01, token.current_price * (1 + change));
        
        return supabase
          .from("crypto_tokens")
          .update({ current_price: newPrice })
          .eq("id", token.id);
      });
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-crypto-tokens"] });
      toast({ title: "Prices Simulated", description: "All token prices randomly adjusted ±10%" });
    },
  });

  // Product mutations
  const saveProduct = useMutation({
    mutationFn: async (productData: typeof newProduct & { id?: string }) => {
      const effects = serializeEffects(productData.effects);

      const payload = {
        name: productData.name,
        description: productData.description || null,
        lore: productData.lore || null,
        category: productData.category,
        rarity: productData.rarity,
        price_cash: productData.price_cash,
        duration_hours: productData.duration_hours,
        is_available: productData.is_available,
        is_legal: productData.is_legal,
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
      is_legal: false,
      icon_name: "Package",
      effects: { ...DEFAULT_EFFECTS },
    });
  };

  const openEditProduct = (product: UnderworldProduct) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      description: product.description || "",
      lore: product.lore || "",
      category: product.category,
      rarity: product.rarity,
      price_cash: product.price_cash || 500,
      duration_hours: product.duration_hours,
      is_available: product.is_available,
      is_legal: product.is_legal ?? false,
      icon_name: product.icon_name || "Package",
      effects: parseEffects(product.effects),
    });
    setProductDialogOpen(true);
  };

  const openEditToken = (token: CryptoToken) => {
    setEditingToken(token);
    setEditToken({
      symbol: token.symbol,
      name: token.name,
      current_price: token.current_price,
      volume_24h: token.volume_24h || 0,
      market_cap: token.market_cap || 0,
      description: token.description || "",
    });
    setEditTokenDialogOpen(true);
  };

  const rarityColors: Record<string, string> = {
    common: "bg-muted text-muted-foreground",
    uncommon: "bg-emerald-500/20 text-emerald-400",
    rare: "bg-blue-500/20 text-blue-400",
    epic: "bg-purple-500/20 text-purple-400",
    legendary: "bg-amber-500/20 text-amber-400",
  };

  // Calculate analytics
  const totalRevenue = purchases.reduce((sum: number, p: any) => sum + (p.total_price || 0), 0);
  const productRevenue = purchases.reduce((acc: Record<string, number>, p: any) => {
    const name = p.product?.name || "Unknown";
    acc[name] = (acc[name] || 0) + (p.total_price || 0);
    return acc;
  }, {});
  const topProducts = Object.entries(productRevenue)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5);

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
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
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

                  {/* Legal checkbox */}
                  <div className="flex items-center gap-3 rounded-md border border-border p-3">
                    <Checkbox
                      id="is_legal"
                      checked={newProduct.is_legal}
                      onCheckedChange={(checked) => setNewProduct({ ...newProduct, is_legal: !!checked })}
                    />
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <Label htmlFor="is_legal" className="cursor-pointer">
                        Legal Item
                      </Label>
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {newProduct.is_legal ? "Visible in legal stores" : "Underworld only"}
                    </span>
                  </div>

                  {/* Effects Editor */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Effects</h4>
                    <UnderworldEffectsEditor
                      effects={newProduct.effects}
                      onChange={(effects) => setNewProduct({ ...newProduct, effects })}
                    />
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
                    <TableHead>Legal</TableHead>
                    <TableHead>Available</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const effectsList = getEffectLabels(product.effects || {});

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
                          {product.is_legal ? (
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => simulatePrices.mutate()}>
              <Shuffle className="h-4 w-4 mr-2" />
              Simulate Prices
            </Button>
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

          {/* Edit Token Dialog */}
          <Dialog open={editTokenDialogOpen} onOpenChange={setEditTokenDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Token: {editingToken?.symbol}</DialogTitle>
                <DialogDescription>Update token details</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Symbol</Label>
                  <Input
                    value={editToken.symbol}
                    onChange={(e) => setEditToken({ ...editToken, symbol: e.target.value.toUpperCase() })}
                    maxLength={5}
                  />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input
                    value={editToken.name}
                    onChange={(e) => setEditToken({ ...editToken, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Current Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editToken.current_price}
                    onChange={(e) => setEditToken({ ...editToken, current_price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>24h Volume ($)</Label>
                  <Input
                    type="number"
                    value={editToken.volume_24h}
                    onChange={(e) => setEditToken({ ...editToken, volume_24h: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Market Cap ($)</Label>
                  <Input
                    type="number"
                    value={editToken.market_cap}
                    onChange={(e) => setEditToken({ ...editToken, market_cap: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={editToken.description}
                    onChange={(e) => setEditToken({ ...editToken, description: e.target.value })}
                  />
                </div>
                <Button 
                  onClick={() => editingToken && updateToken.mutate({ 
                    id: editingToken.id, 
                    data: {
                      symbol: editToken.symbol,
                      name: editToken.name,
                      current_price: editToken.current_price,
                      volume_24h: editToken.volume_24h,
                      market_cap: editToken.market_cap,
                      description: editToken.description,
                    }
                  })} 
                  className="w-full"
                >
                  Update Token
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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
                  {tokens.map((token) => (
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditToken(token)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Token?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete {token.symbol}. This action cannot be undone.
                                  Player holdings and transactions may be affected.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteToken.mutate(token.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">${totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{purchases.length} purchases</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Active Boosts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{activeBoosts.length}</p>
                <p className="text-xs text-muted-foreground">Currently running</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Token Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{tokenTransactions.length}</p>
                <p className="text-xs text-muted-foreground">Recent trades</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Top Products by Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topProducts.map(([name, revenue]) => (
                      <TableRow key={name}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell className="text-right">${(revenue as number).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {topProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          No purchases yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Recent Purchases
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.slice(0, 10).map((purchase: any) => (
                      <TableRow key={purchase.id}>
                        <TableCell>{purchase.profile?.stage_name || "Unknown"}</TableCell>
                        <TableCell>{purchase.product?.name || "Unknown"}</TableCell>
                        <TableCell className="text-right">${purchase.total_price?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {purchases.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No purchases yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Recent Token Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokenTransactions.slice(0, 20).map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell>{tx.profile?.stage_name || "Unknown"}</TableCell>
                      <TableCell className="font-mono">{tx.token?.symbol || "?"}</TableCell>
                      <TableCell>
                        <Badge variant={tx.transaction_type === "buy" ? "default" : "secondary"}>
                          {tx.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{tx.quantity?.toLocaleString()}</TableCell>
                      <TableCell>${tx.price_per_token?.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${tx.total_amount?.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {tokenTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No token transactions yet
                      </TableCell>
                    </TableRow>
                  )}
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
                  ${tokens.reduce((sum, t) => sum + (t.market_cap || 0), 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">24h Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  ${tokens.reduce((sum, t) => sum + (t.volume_24h || 0), 0).toLocaleString()}
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
