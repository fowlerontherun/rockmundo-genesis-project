import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/hooks/useTranslation";
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
import { TShirtDesignerNew } from "@/components/merchandise/TShirtDesignerNew";
import { SavedDesigns } from "@/components/merchandise/SavedDesigns";
import { MerchItemCard } from "@/components/merchandise/MerchItemCard";
import { MerchCatalog } from "@/components/merchandise/MerchCatalog";
import { useMerchRequirements, QUALITY_TIERS, MerchItemRequirement, calculateMerchQuality } from "@/hooks/useMerchRequirements";
import {
  Loader2,
  PackagePlus,
  RefreshCcw,
  Trash2,
  UploadCloud,
  BarChart3,
  ClipboardList,
  Sparkles,
  Shirt,
  TrendingUp,
} from "lucide-react";
import { SalesAnalyticsTab } from "@/components/merchandise/SalesAnalyticsTab";
import { CollaborationOffersCard } from "@/components/merchandise/CollaborationOffersCard";
import { ActiveCollaborationsCard } from "@/components/merchandise/ActiveCollaborationsCard";
import type { LucideIcon } from "lucide-react";

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
  category: string;
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
  category: "",
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

const productBlueprints = [
  {
    category: "Apparel",
    items: [
      { label: "Graphic Tee", cost: 7 },
      { label: "Premium Hoodie", cost: 24 },
      { label: "Tour Crewneck", cost: 18 },
      { label: "Embroidered Cap", cost: 10 },
    ],
  },
  {
    category: "Accessories",
    items: [
      { label: "Holographic Sticker Pack", cost: 2 },
      { label: "Lanyard + Laminate", cost: 5 },
      { label: "Enamel Pin", cost: 4 },
      { label: "Tour Tote Bag", cost: 6 },
    ],
  },
  {
    category: "Collectibles",
    items: [
      { label: "Signed Poster", cost: 3 },
      { label: "Limited Art Print", cost: 8 },
      { label: "Numbered Vinyl Variant", cost: 12 },
      { label: "Tour Photo Zine", cost: 6 },
    ],
  },
  {
    category: "Experiences",
    items: [
      { label: "Soundcheck Hang", cost: 0 },
      { label: "Backstage Meet & Greet", cost: 5 },
      { label: "VIP Lounge Access", cost: 9 },
      { label: "Private Listening Session", cost: 7 },
    ],
  },
  {
    category: "Digital",
    items: [
      { label: "Exclusive Remix Pack", cost: 1 },
      { label: "Behind-the-Scenes Mini Doc", cost: 3 },
      { label: "Lyric Book PDF", cost: 1 },
      { label: "Virtual Listening Party Pass", cost: 2 },
    ],
  },
  {
    category: "Bundles",
    items: [
      { label: "Tour Essentials Bundle", cost: 20 },
      { label: "Deluxe Fan Bundle", cost: 28 },
      { label: "Digital Drop Bundle", cost: 5 },
      { label: "Release Week Mystery Pack", cost: 16 },
    ],
  },
] as const;

const findBlueprintCategory = (category: string | null) =>
  productBlueprints.find((entry) => entry.category === category) ?? null;

const findBlueprintItem = (itemType: string | null) => {
  if (!itemType) return null;
  for (const entry of productBlueprints) {
    const match = entry.items.find((item) => item.label === itemType);
    if (match) {
      return { category: entry.category, ...match };
    }
  }
  return null;
};

const formatProductType = (itemType: string | null) => {
  const blueprint = findBlueprintItem(itemType);
  if (blueprint) {
    return `${blueprint.category} · ${blueprint.label}`;
  }
  return itemType || "Uncategorized";
};

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

type TabConfig = {
  value: "overview" | "sales" | "add-product" | "manage-product" | "designer";
  label: string;
  description: string;
  icon: LucideIcon;
};

const TAB_CONFIG: TabConfig[] = [
  {
    value: "overview",
    label: "Overview",
    description: "Performance & alerts",
    icon: BarChart3,
  },
  {
    value: "sales",
    label: "Sales",
    description: "Revenue & analytics",
    icon: TrendingUp,
  },
  {
    value: "add-product",
    label: "Add Product",
    description: "Launch something new",
    icon: PackagePlus,
  },
  {
    value: "manage-product",
    label: "Manage Inventory",
    description: "Restock & adjust",
    icon: ClipboardList,
  },
  {
    value: "designer",
    label: "T-Shirt Designer",
    description: "Plan the visuals",
    icon: Sparkles,
  },
];

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
  const bandFame = primaryBand?.bands?.fame ?? 0;
  const bandFans = primaryBand?.bands?.weekly_fans ?? 0;
  const playerLevel = 10; // TODO: Get from profile

  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabConfig["value"]>("overview");
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
  });

  useEffect(() => {
    if (!selectedProductId && merchandise && Array.isArray(merchandise) && merchandise.length > 0) {
      setSelectedProductId(merchandise[0].id);
    }
  }, [merchandise, selectedProductId]);

  const selectedProduct = useMemo(
    () => (Array.isArray(merchandise) ? merchandise.find((item) => item.id === selectedProductId) : null) ?? null,
    [merchandise, selectedProductId],
  );

  useEffect(() => {
    if (selectedProduct) {
      const blueprint = findBlueprintItem(selectedProduct.item_type);
      setEditForm({
        designName: selectedProduct.design_name ?? "",
        category: blueprint?.category ?? "",
        itemType: blueprint?.label ?? selectedProduct.item_type ?? "",
        cost: (blueprint?.cost ?? safeNumber(selectedProduct.cost_to_produce)).toString(),
        price: safeNumber(selectedProduct.selling_price).toString(),
        stock: safeNumber(selectedProduct.stock_quantity).toString(),
      });
    } else {
      setEditForm(INITIAL_FORM);
    }
  }, [selectedProduct]);

  const summary = useMemo(() => {
    if (!Array.isArray(merchandise) || !merchandise.length) {
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

    if (Array.isArray(merchandise)) {
      merchandise.forEach((product) => {
        const blueprint = findBlueprintItem(product.item_type);
        const key = blueprint?.category ?? product.item_type ?? "Uncategorized";
        const entry = categoryMap.get(key) ?? { units: 0, revenue: 0, skus: 0 };
        entry.units += safeNumber(product.stock_quantity);
        entry.revenue += safeNumber(product.selling_price) * safeNumber(product.stock_quantity);
        entry.skus += 1;
        categoryMap.set(key, entry);
      });
    }

    return Array.from(categoryMap.entries())
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [merchandise]);

  const restockAlerts = useMemo(
    () =>
      Array.isArray(merchandise)
        ? merchandise
            .filter((product) => getStatus(product.stock_quantity) !== "in_stock")
            .sort((a, b) => safeNumber(a.stock_quantity) - safeNumber(b.stock_quantity))
            .slice(0, 5)
        : [],
    [merchandise],
  );

  const addProductMutation = useMutation({
    mutationFn: async ({ designName, category, itemType, price, stock }: FormState) => {
      if (!bandId) {
        throw new Error("Join a band to manage merchandise");
      }

      const parsedPrice = Math.max(0, Math.round(Number(price)));
      const parsedStock = Math.max(0, Math.round(Number(stock)));

      if (!category.trim()) {
        throw new Error("Select a product category");
      }

      if (!designName.trim()) {
        throw new Error("Product name is required");
      }

      if (!itemType.trim()) {
        throw new Error("Select a product type");
      }

      const blueprint = findBlueprintItem(itemType);

      if (!blueprint || blueprint.category !== category) {
        throw new Error("Choose a valid product type for the selected category");
      }

      const derivedCost = Math.max(0, Math.round(Number(blueprint.cost)));

      const { error } = await supabase.from("player_merchandise").insert({
        band_id: bandId,
        design_name: designName.trim(),
        item_type: blueprint.label,
        cost_to_produce: derivedCost,
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

  const catalogAddProductMutation = useMutation({
    mutationFn: async ({ item, designName, price, stock }: { 
      item: MerchItemRequirement; 
      designName: string; 
      price: number; 
      stock: number;
    }) => {
      if (!bandId) {
        throw new Error("Join a band to manage merchandise");
      }

      const quality = calculateMerchQuality(item.base_quality_tier, bandFame, false);

      const { error } = await (supabase as any).from("player_merchandise").insert({
        band_id: bandId,
        design_name: designName,
        item_type: item.item_type,
        cost_to_produce: item.base_cost,
        selling_price: price,
        stock_quantity: stock,
        quality_tier: quality,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Merch added",
        description: "The new product is now in your inventory.",
      });
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
    mutationFn: async ({ designName, category, itemType, price, stock }: FormState) => {
      if (!selectedProduct) {
        throw new Error("Select a product to update");
      }

      const parsedPrice = Math.max(0, Math.round(Number(price)));
      const parsedStock = Math.max(0, Math.round(Number(stock)));

      if (!category.trim()) {
        throw new Error("Select a product category");
      }

      if (!itemType.trim()) {
        throw new Error("Select a product type");
      }

      const blueprint = findBlueprintItem(itemType);

      if (!blueprint || blueprint.category !== category) {
        throw new Error("Choose a valid product type for the selected category");
      }

      const derivedCost = Math.max(0, Math.round(Number(blueprint.cost)));

      const { error } = await supabase
        .from("player_merchandise")
        .update({
          design_name: designName.trim(),
          item_type: blueprint.label,
          cost_to_produce: derivedCost,
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

  const createMerchWithDesign = async (designId: string, designName: string) => {
    if (!bandId) {
      toast({
        title: "No band selected",
        description: "Please select a band first",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("player_merchandise")
        .insert({
          band_id: bandId,
          design_name: `Custom ${designName}`,
          item_type: "Custom T-Shirt",
          cost_to_produce: 12,
          selling_price: 35,
          stock_quantity: 50,
          custom_design_id: designId,
          sales_boost_pct: 1.0, // 1% sales boost
        });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["player-merchandise", bandId] });
      toast({
        title: "Custom merch created!",
        description: `"${designName}" has been added to your inventory with a 1% sales boost.`,
      });
      setActiveTab("manage-product");
    } catch (error: any) {
      toast({
        title: "Failed to create merchandise",
        description: error.message,
        variant: "destructive",
      });
    }
  };


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

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabConfig["value"])}
        className="space-y-6"
      >
        {/* Mobile Tabs - Icons with short labels */}
        <TabsList className="grid w-full grid-cols-5 gap-1 rounded-xl bg-muted/40 p-1 md:hidden">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Icon className="h-4 w-4" />
                <span className="truncate max-w-full text-[10px]">{tab.label.split(' ')[0]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Desktop Tabs - Full labels */}
        <TabsList className="hidden w-full grid-cols-5 gap-2 rounded-xl bg-muted/40 p-1 md:grid">
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </TabsTrigger>
            );
          })}
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="hidden xl:table-cell">Category</TableHead>
                        <TableHead>Quality</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Sale</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead className="hidden lg:table-cell">Potential</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.isArray(merchandise) && merchandise.map((product) => {
                        const margin = calculateMargin(product);
                        const unitProfit = safeNumber(product.selling_price) - safeNumber(product.cost_to_produce);
                        const potential = safeNumber(product.selling_price) * safeNumber(product.stock_quantity);
                        const status = getStatus(product.stock_quantity);
                        const qualityTier = (product as any).quality_tier || 'basic';
                        const qualityInfo = QUALITY_TIERS[qualityTier as keyof typeof QUALITY_TIERS] || QUALITY_TIERS.basic;

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
                            <TableCell className="hidden xl:table-cell">{formatProductType(product.item_type)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${qualityInfo.color}`}>
                                {qualityInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>{currencyFormatter.format(safeNumber(product.cost_to_produce))}</TableCell>
                            <TableCell>{currencyFormatter.format(safeNumber(product.selling_price))}</TableCell>
                            <TableCell>{numberFormatter.format(safeNumber(product.stock_quantity))}</TableCell>
                            <TableCell className="hidden lg:table-cell">{currencyFormatter.format(potential)}</TableCell>
                            <TableCell>
                              <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(!merchandise || !Array.isArray(merchandise) || merchandise.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                            No merchandise found yet. Add your first product to start tracking performance.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {/* Quality Distribution Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Quality Distribution</CardTitle>
                  <CardDescription className="text-xs">Higher quality = better sales velocity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(QUALITY_TIERS).map(([tier, info]) => {
                    const count = Array.isArray(merchandise) 
                      ? merchandise.filter((p: any) => (p.quality_tier || 'basic') === tier).length 
                      : 0;
                    return (
                      <div key={tier} className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${info.color}`}>{info.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{count} items</span>
                          <span className="text-muted-foreground">({info.salesMultiplier}x)</span>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

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
                          {formatProductType(product.item_type)} · {statusLabels[getStatus(product.stock_quantity)]} · {numberFormatter.format(
                            safeNumber(product.stock_quantity),
                          )} units
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

              {/* Brand Collaborations */}
              <CollaborationOffersCard bandId={bandId} />
              <ActiveCollaborationsCard bandId={bandId} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sales Analytics</CardTitle>
              <CardDescription>
                Track merchandise revenue, top products, and sales performance across channels.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SalesAnalyticsTab bandId={bandId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add-product">
          <MerchCatalog
            bandFame={bandFame}
            bandFans={bandFans}
            playerLevel={playerLevel}
            onAddProduct={(item, designName, price, stock) => {
              catalogAddProductMutation.mutate({ item, designName, price, stock });
            }}
            isAdding={catalogAddProductMutation.isPending}
          />
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
                  disabled={!merchandise || !Array.isArray(merchandise) || !merchandise.length}
                >
                  <SelectTrigger id="manage-product-select">
                    <SelectValue placeholder="Choose a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(merchandise) && merchandise.map((product) => (
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
                      value={editForm.category}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({
                          ...prev,
                          category: value,
                          itemType: "",
                          cost: "",
                        }))
                      }
                    >
                      <SelectTrigger id="edit-item-type">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {productBlueprints.map((entry) => (
                          <SelectItem key={entry.category} value={entry.category}>
                            {entry.category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="edit-item-subtype">
                      Product Type
                    </label>
                    <Select
                      value={editForm.itemType}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({
                          ...prev,
                          itemType: value,
                          cost: findBlueprintItem(value)?.cost.toString() ?? "",
                        }))
                      }
                      disabled={!editForm.category}
                    >
                      <SelectTrigger id="edit-item-subtype">
                        <SelectValue placeholder="Select product type" />
                      </SelectTrigger>
                      <SelectContent>
                        {findBlueprintCategory(editForm.category)?.items.map((item) => (
                          <SelectItem key={item.label} value={item.label}>
                            {item.label} · {currencyFormatter.format(item.cost)}
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
                      readOnly
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

        <TabsContent value="designer" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TShirtDesignerNew 
                bandId={bandId}
                onSave={() => {
                  queryClient.invalidateQueries({ queryKey: ['tshirt-designs', bandId] });
                }}
              />
            </div>
            <div>
              <SavedDesigns 
                bandId={bandId}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Merchandise;
