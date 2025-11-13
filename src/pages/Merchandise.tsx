import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PackagePlus, RefreshCcw, Trash2, UploadCloud } from "lucide-react";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("en-US");

type MerchandiseRecord = Database["public"]["Tables"]["player_merchandise"]["Row"];

type FormState = {
  designName: string;
  itemType: string;
  cost: string;
  price: string;
  stock: string;
};

type DesignerForm = {
  theme: string;
  palette: string;
  slogan: string;
  story: string;
  finish: "standard" | "premium" | "limited-edition";
};

type MerchandiseStatus = "in_stock" | "low_stock" | "sold_out";

const INITIAL_FORM: FormState = {
  designName: "",
  itemType: "",
  cost: "",
  price: "",
  stock: "",
};

const INITIAL_DESIGNER_FORM: DesignerForm = {
  theme: "",
  palette: "",
  slogan: "",
  story: "",
  finish: "standard",
};

const productCategories = ["Apparel", "Accessories", "Collectibles", "Experiences", "Digital", "Bundles"];

const finishLabels: Record<DesignerForm["finish"], string> = {
  standard: "Standard tee",
  premium: "Premium heavyweight",
  "limited-edition": "Limited edition drop",
};

const statusLabels: Record<MerchandiseStatus, string> = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  sold_out: "Sold Out",
};

const statusVariants: Record<MerchandiseStatus, "default" | "secondary" | "destructive" | "outline"> = {
  in_stock: "outline",
  low_stock: "secondary",
  sold_out: "destructive",
};

const safeNumber = (value: number | null) => (typeof value === "number" && !Number.isNaN(value) ? value : 0);

const getStatus = (stock: number | null): MerchandiseStatus => {
  const quantity = safeNumber(stock);
  if (quantity <= 0) return "sold_out";
  if (quantity < 10) return "low_stock";
  return "in_stock";
};

const calculateMargin = (product: MerchandiseRecord) => {
  const sale = safeNumber(product.selling_price);
  if (sale <= 0) return 0;
  return (sale - safeNumber(product.cost_to_produce)) / sale;
};

const Merchandise = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: primaryBand, isLoading: loadingBand } = usePrimaryBand();
  const bandId = primaryBand?.band_id ?? null;
  const bandName = primaryBand?.bands?.name ?? "Band";

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [newProductForm, setNewProductForm] = useState<FormState>(INITIAL_FORM);
  const [editForm, setEditForm] = useState<FormState>(INITIAL_FORM);
  const [designerForm, setDesignerForm] = useState<DesignerForm>(INITIAL_DESIGNER_FORM);
  const [designerPreview, setDesignerPreview] = useState<string[]>([]);

  const {
    data: merchandise = [],
    isLoading: loadingMerch,
  } = useQuery<MerchandiseRecord[]>({
    queryKey: ["player-merchandise", bandId],
    queryFn: async () => {
      if (!bandId) return [];

      const { data, error } = await supabase
        .from("player_merchandise")
        .select("*")
        .eq("band_id", bandId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to load merchandise", error);
        throw error;
      }

      return data ?? [];
    },
    enabled: Boolean(bandId),
    staleTime: 30 * 1000,
    onError: (error: Error) => {
      toast({
        title: "Unable to load merchandise",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (!selectedProductId && merchandise.length > 0) {
      setSelectedProductId(merchandise[0].id);
    }
  }, [merchandise, selectedProductId]);

  const selectedProduct = useMemo(
    () => merchandise.find((item) => item.id === selectedProductId) ?? null,
    [merchandise, selectedProductId],
  );

  useEffect(() => {
    if (selectedProduct) {
      setEditForm({
        designName: selectedProduct.design_name ?? "",
        itemType: selectedProduct.item_type ?? "",
        cost: safeNumber(selectedProduct.cost_to_produce).toString(),
        price: safeNumber(selectedProduct.selling_price).toString(),
        stock: safeNumber(selectedProduct.stock_quantity).toString(),
      });
    } else {
      setEditForm(INITIAL_FORM);
    }
  }, [selectedProduct]);

  const summary = useMemo(() => {
    if (!merchandise.length) {
      return {
        totalSkus: 0,
        totalUnits: 0,
        potentialRevenue: 0,
        totalCost: 0,
        avgMargin: 0,
        avgPrice: 0,
        lowStock: 0,
      };
    }

    const totals = merchandise.reduce(
      (acc, product) => {
        const cost = safeNumber(product.cost_to_produce);
        const price = safeNumber(product.selling_price);
        const stock = safeNumber(product.stock_quantity);
        acc.units += stock;
        acc.revenue += price * stock;
        acc.cost += cost * stock;
        if (getStatus(product.stock_quantity) !== "in_stock") {
          acc.lowStock += 1;
        }
        return acc;
      },
      { units: 0, revenue: 0, cost: 0, lowStock: 0 },
    );

    const avgMargin = totals.revenue > 0 ? (totals.revenue - totals.cost) / totals.revenue : 0;
    const avgPrice = totals.units > 0 ? totals.revenue / totals.units : 0;

    return {
      totalSkus: merchandise.length,
      totalUnits: totals.units,
      potentialRevenue: totals.revenue,
      totalCost: totals.cost,
      avgMargin,
      avgPrice,
      lowStock: totals.lowStock,
    };
  }, [merchandise]);

  const categoryMetrics = useMemo(() => {
    const categoryMap = new Map<string, { units: number; revenue: number; skus: number }>();

    merchandise.forEach((product) => {
      const key = product.item_type || "Uncategorized";
      const entry = categoryMap.get(key) ?? { units: 0, revenue: 0, skus: 0 };
      entry.units += safeNumber(product.stock_quantity);
      entry.revenue += safeNumber(product.selling_price) * safeNumber(product.stock_quantity);
      entry.skus += 1;
      categoryMap.set(key, entry);
    });

    return Array.from(categoryMap.entries())
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [merchandise]);

  const restockAlerts = useMemo(
    () =>
      merchandise
        .filter((product) => getStatus(product.stock_quantity) !== "in_stock")
        .sort((a, b) => safeNumber(a.stock_quantity) - safeNumber(b.stock_quantity))
        .slice(0, 5),
    [merchandise],
  );

  const addProductMutation = useMutation({
    mutationFn: async ({ designName, itemType, cost, price, stock }: FormState) => {
      if (!bandId) {
        throw new Error("Join a band to manage merchandise");
      }

      const parsedCost = Math.max(0, Math.round(Number(cost)));
      const parsedPrice = Math.max(0, Math.round(Number(price)));
      const parsedStock = Math.max(0, Math.round(Number(stock)));

      if (!designName.trim()) {
        throw new Error("Product name is required");
      }

      if (!itemType.trim()) {
        throw new Error("Select a product category");
      }

      const { error } = await supabase.from("player_merchandise").insert({
        band_id: bandId,
        design_name: designName.trim(),
        item_type: itemType.trim(),
        cost_to_produce: parsedCost,
        selling_price: parsedPrice,
        stock_quantity: parsedStock,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Merch added",
        description: "The new product is now in your inventory.",
      });
      setNewProductForm(INITIAL_FORM);
      queryClient.invalidateQueries({ queryKey: ["player-merchandise", bandId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to add product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ designName, itemType, cost, price, stock }: FormState) => {
      if (!selectedProduct) {
        throw new Error("Select a product to update");
      }

      const parsedCost = Math.max(0, Math.round(Number(cost)));
      const parsedPrice = Math.max(0, Math.round(Number(price)));
      const parsedStock = Math.max(0, Math.round(Number(stock)));

      const { error } = await supabase
        .from("player_merchandise")
        .update({
          design_name: designName.trim(),
          item_type: itemType.trim(),
          cost_to_produce: parsedCost,
          selling_price: parsedPrice,
          stock_quantity: parsedStock,
        })
        .eq("id", selectedProduct.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Inventory updated",
        description: "Changes saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["player-merchandise", bandId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to update product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) {
        throw new Error("Select a product to remove");
      }

      const { error } = await supabase
        .from("player_merchandise")
        .delete()
        .eq("id", selectedProduct.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Product archived",
        description: "The item has been removed from your catalogue.",
      });
      setSelectedProductId(null);
      queryClient.invalidateQueries({ queryKey: ["player-merchandise", bandId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Unable to remove product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddProduct = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addProductMutation.mutate(newProductForm);
  };

  const handleUpdateProduct = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateProductMutation.mutate(editForm);
  };

  const handleGenerateDesign = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const { theme, palette, slogan, story, finish } = designerForm;

    const outline: string[] = [
      theme
        ? `Front graphic: Bold typography or iconography celebrating "${theme}".`
        : "Front graphic: Define a headline theme to anchor the design.",
      palette
        ? `Color palette: ${palette}. Ensure contrast against the base tee.`
        : "Color palette: Choose two accent colors and a neutral base.",
      slogan
        ? `Back print: ${slogan} layered with tour dates or QR code to merch store.`
        : "Back print: Add a rallying cry or lyric with a QR code to unlock perks.",
      finish === "limited-edition"
        ? "Use numbered heat-press tags and metallic ink for limited drop feel."
        : finish === "premium"
          ? "Opt for heavyweight blanks and puff ink for tactile depth."
          : "Use soft-wash blanks with eco inks for fast turnaround.",
      story
        ? `Story hook: Highlight ${story} in product description and social launch.`
        : "Story hook: Document how this design ties back to the current tour or release.",
    ];

    setDesignerPreview(outline);
  };

  const handleArtworkUploadClick = () => {
    toast({
      title: "Mock uploader coming soon",
      description: "Use the outline generator below to brief your designer in the meantime.",
    });
  };

  if (loadingBand || loadingMerch) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading merchandise operations...
        </div>
      </div>
    );
  }

  if (!bandId) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>Join a band to unlock merchandise tools</CardTitle>
            <CardDescription>
              Merchandise inventory, pricing, and drop scheduling live inside your band workspace. Create or join a band to start
              tracking products.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Once you are part of an active band you can load in-stock items, log restocks, and plan limited drops from this hub.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Merchandise Operations</h1>
        <p className="text-muted-foreground">
          Manage {bandName}&apos;s merch catalogue, monitor sell-through, and prep your next drop without leaving the control
          room.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="add-product">Add Product</TabsTrigger>
          <TabsTrigger value="manage-product">Manage Inventory</TabsTrigger>
          <TabsTrigger value="designer">Custom T-Shirt Designer</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <span>Inventory Performance Snapshot</span>
                <span className="text-sm text-muted-foreground">
                  Real-time totals pulled from your Supabase merchandise table.
                </span>
              </CardTitle>
              <CardDescription>
                Track on-hand value, average margin, and low stock alerts for the entire catalogue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Total SKUs</CardTitle>
                    <CardDescription>Unique merch items in circulation.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{summary.totalSkus}</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">On-hand Units</CardTitle>
                    <CardDescription>Current sellable inventory across all drops.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{numberFormatter.format(summary.totalUnits)}</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Potential Revenue</CardTitle>
                    <CardDescription>Revenue if every unit sells at full price.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{currencyFormatter.format(summary.potentialRevenue)}</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Average Margin</CardTitle>
                    <CardDescription>Weighted by current stock levels.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{percentFormatter.format(summary.avgMargin)}</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Active Merchandise Catalogue</CardTitle>
                <CardDescription>Cost structure, pricing, and stock levels synced from Supabase.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-dashed bg-muted/30 p-4">
                    <p className="text-xs uppercase text-muted-foreground">Average Price</p>
                    <p className="text-2xl font-semibold">{currencyFormatter.format(summary.avgPrice)}</p>
                  </div>
                  <div className="rounded-lg border border-dashed bg-muted/30 p-4">
                    <p className="text-xs uppercase text-muted-foreground">Low Stock Alerts</p>
                    <p className="text-2xl font-semibold">{summary.lowStock}</p>
                  </div>
                  <div className="rounded-lg border border-dashed bg-muted/30 p-4">
                    <p className="text-xs uppercase text-muted-foreground">Inventory Cost Basis</p>
                    <p className="text-2xl font-semibold">{currencyFormatter.format(summary.totalCost)}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden xl:table-cell">Category</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Sale</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="hidden lg:table-cell">Potential</TableHead>
                      <TableHead className="hidden lg:table-cell">Margin</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {merchandise.map((product) => {
                      const margin = calculateMargin(product);
                      const unitProfit = safeNumber(product.selling_price) - safeNumber(product.cost_to_produce);
                      const potential = safeNumber(product.selling_price) * safeNumber(product.stock_quantity);
                      const status = getStatus(product.stock_quantity);

                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold">{product.design_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {percentFormatter.format(margin)} margin · {currencyFormatter.format(unitProfit)} / unit
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">{product.item_type || "Uncategorized"}</TableCell>
                          <TableCell>{currencyFormatter.format(safeNumber(product.cost_to_produce))}</TableCell>
                          <TableCell>{currencyFormatter.format(safeNumber(product.selling_price))}</TableCell>
                          <TableCell>{numberFormatter.format(safeNumber(product.stock_quantity))}</TableCell>
                          <TableCell className="hidden lg:table-cell">{currencyFormatter.format(potential)}</TableCell>
                          <TableCell className="hidden lg:table-cell">{percentFormatter.format(margin)}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {merchandise.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                          No merchandise found yet. Add your first product to start tracking performance.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Category Breakdown</CardTitle>
                  <CardDescription>Where current stock and revenue potential sit.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {categoryMetrics.length === 0 && (
                    <p className="text-sm text-muted-foreground">Add merchandise to see category insights.</p>
                  )}
                  {categoryMetrics.map((category) => (
                    <div key={category.category} className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between text-sm font-semibold">
                        <span>{category.category}</span>
                        <span>{numberFormatter.format(category.skus)} SKU(s)</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {numberFormatter.format(category.units)} units · {currencyFormatter.format(category.revenue)} potential
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Restock Watchlist</CardTitle>
                  <CardDescription>Low inventory or sold out items prioritized by urgency.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {restockAlerts.length === 0 && (
                    <p className="text-sm text-muted-foreground">All set — no low stock products at the moment.</p>
                  )}
                  {restockAlerts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-sm">
                      <div className="flex flex-col">
                        <span className="font-semibold">{product.design_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {statusLabels[getStatus(product.stock_quantity)]} · {numberFormatter.format(safeNumber(product.stock_quantity))} units
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedProductId(product.id)}
                      >
                        Review
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="add-product">
          <Card>
            <CardHeader>
              <CardTitle>Launch a New Merch Drop</CardTitle>
              <CardDescription>
                Insert a new SKU into your live catalogue — pricing and stock sync directly to future gig simulations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleAddProduct}>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="new-design-name">
                    Product Name
                  </label>
                  <Input
                    id="new-design-name"
                    placeholder="e.g. Tour Finale Bomber Jacket"
                    value={newProductForm.designName}
                    onChange={(event) =>
                      setNewProductForm((prev) => ({ ...prev, designName: event.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="new-item-type">
                    Category
                  </label>
                  <Select
                    value={newProductForm.itemType}
                    onValueChange={(value) => setNewProductForm((prev) => ({ ...prev, itemType: value }))}
                  >
                    <SelectTrigger id="new-item-type">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {productCategories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="new-cost">
                    Cost to Produce (USD)
                  </label>
                  <Input
                    id="new-cost"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="12"
                    value={newProductForm.cost}
                    onChange={(event) => setNewProductForm((prev) => ({ ...prev, cost: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="new-price">
                    Sale Price (USD)
                  </label>
                  <Input
                    id="new-price"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="45"
                    value={newProductForm.price}
                    onChange={(event) => setNewProductForm((prev) => ({ ...prev, price: event.target.value }))}
                    required
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium" htmlFor="new-stock">
                    Initial Stock Quantity
                  </label>
                  <Input
                    id="new-stock"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="250"
                    value={newProductForm.stock}
                    onChange={(event) => setNewProductForm((prev) => ({ ...prev, stock: event.target.value }))}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full" disabled={addProductMutation.isPending}>
                    <PackagePlus className="mr-2 h-4 w-4" />
                    {addProductMutation.isPending ? "Adding..." : "Submit for Approval"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage-product">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Maintenance</CardTitle>
              <CardDescription>Restock, re-price, or retire items based on current performance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                Updating merchandise here syncs with gig outcome calculations and future sales simulations.
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="manage-product-select">
                  Select Product
                </label>
                <Select
                  value={selectedProductId ?? ""}
                  onValueChange={(value) => setSelectedProductId(value)}
                  disabled={!merchandise.length}
                >
                  <SelectTrigger id="manage-product-select">
                    <SelectValue placeholder="Choose a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchandise.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.design_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProduct ? (
                <form className="grid gap-4 md:grid-cols-2" onSubmit={handleUpdateProduct}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="edit-design-name">
                      Product Name
                    </label>
                    <Input
                      id="edit-design-name"
                      value={editForm.designName}
                      onChange={(event) =>
                        setEditForm((prev) => ({ ...prev, designName: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="edit-item-type">
                      Category
                    </label>
                    <Select
                      value={editForm.itemType}
                      onValueChange={(value) => setEditForm((prev) => ({ ...prev, itemType: value }))}
                    >
                      <SelectTrigger id="edit-item-type">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {productCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="edit-cost">
                      Cost to Produce (USD)
                    </label>
                    <Input
                      id="edit-cost"
                      type="number"
                      min={0}
                      step={1}
                      value={editForm.cost}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, cost: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="edit-price">
                      Sale Price (USD)
                    </label>
                    <Input
                      id="edit-price"
                      type="number"
                      min={0}
                      step={1}
                      value={editForm.price}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, price: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium" htmlFor="edit-stock">
                      Stock Quantity
                    </label>
                    <Input
                      id="edit-stock"
                      type="number"
                      min={0}
                      step={1}
                      value={editForm.stock}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, stock: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button type="submit" disabled={updateProductMutation.isPending} className="w-full sm:w-auto">
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      {updateProductMutation.isPending ? "Saving..." : "Update Product"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full sm:w-auto"
                      onClick={() => deleteProductMutation.mutate()}
                      disabled={deleteProductMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleteProductMutation.isPending ? "Removing..." : "Archive Product"}
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a product from the list above to update pricing, stock, or retire the item.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="designer">
          <Card>
            <CardHeader>
              <CardTitle>Custom T-Shirt Designer</CardTitle>
              <CardDescription>
                Build a creative brief for your next tee drop. Upload hooks are in-progress — use the planner below to align your
                design team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/40 bg-muted/30 p-10 text-center">
                <UploadCloud className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold">Artwork Upload Coming Soon</p>
                  <p className="text-sm text-muted-foreground">
                    Tap the button below to note concepts for your designer while we finish the interactive mockup tool.
                  </p>
                </div>
                <Button type="button" onClick={handleArtworkUploadClick}>
                  Notify Me When Ready
                </Button>
              </div>

              <form className="grid gap-4 md:grid-cols-2" onSubmit={handleGenerateDesign}>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="designer-theme">
                    Theme or Tour Moment
                  </label>
                  <Input
                    id="designer-theme"
                    placeholder="Neon Skyline Tour"
                    value={designerForm.theme}
                    onChange={(event) =>
                      setDesignerForm((prev) => ({ ...prev, theme: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="designer-palette">
                    Color Palette
                  </label>
                  <Input
                    id="designer-palette"
                    placeholder="Electric blue, ultraviolet, silver foil"
                    value={designerForm.palette}
                    onChange={(event) =>
                      setDesignerForm((prev) => ({ ...prev, palette: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="designer-slogan">
                    Headline / Slogan
                  </label>
                  <Input
                    id="designer-slogan"
                    placeholder="Feel the Afterglow"
                    value={designerForm.slogan}
                    onChange={(event) =>
                      setDesignerForm((prev) => ({ ...prev, slogan: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="designer-finish">
                    Garment Finish
                  </label>
                  <Select
                    value={designerForm.finish}
                    onValueChange={(value: DesignerForm["finish"]) =>
                      setDesignerForm((prev) => ({ ...prev, finish: value }))
                    }
                  >
                    <SelectTrigger id="designer-finish">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(finishLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="designer-story">
                    Story Hook / Launch Notes
                  </label>
                  <Textarea
                    id="designer-story"
                    rows={4}
                    placeholder="Capture why this drop matters to fans, collaborators involved, or perks unlocked."
                    value={designerForm.story}
                    onChange={(event) =>
                      setDesignerForm((prev) => ({ ...prev, story: event.target.value }))
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full">
                    Generate Creative Outline
                  </Button>
                </div>
              </form>

              {designerPreview.length > 0 && (
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">Creative Brief Preview</CardTitle>
                    <CardDescription>Share these notes with your merch vendor or designer.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    {designerPreview.map((line, index) => (
                      <p key={index}>• {line}</p>
                    ))}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Merchandise;
