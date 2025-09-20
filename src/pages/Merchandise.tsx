import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, Lock, ArrowUpRight } from "lucide-react";

type ProductStatus = "Available" | "Locked" | "Upgradeable";

type ProductRecord = {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  salePrice: number;
  weeklySales: number;
  monthlySales: number;
  yearlySales: number;
  status: ProductStatus;
};

type CityMerchandise = {
  metrics: {
    totalRevenue: number;
    profitMargin: number;
    averageOrderValue: number;
    conversionRate: number;
  };
  spotlight: string;
  products: ProductRecord[];
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const cityMerchandise: Record<string, CityMerchandise> = {
  "Los Angeles": {
    metrics: {
      totalRevenue: 248_500,
      profitMargin: 0.42,
      averageOrderValue: 68,
      conversionRate: 0.164,
    },
    spotlight: "Pop-up merch booths across Sunset Strip are outperforming projections thanks to collab bundles with local artists.",
    products: [
      {
        id: "la-hoodie",
        name: "Sunset Tour Hoodie",
        category: "Apparel",
        costPrice: 28,
        salePrice: 75,
        weeklySales: 210,
        monthlySales: 840,
        yearlySales: 9120,
        status: "Available",
      },
      {
        id: "la-tees",
        name: "Limited Vinyl Tee",
        category: "Apparel",
        costPrice: 12,
        salePrice: 38,
        weeklySales: 320,
        monthlySales: 1240,
        yearlySales: 14880,
        status: "Upgradeable",
      },
      {
        id: "la-cap",
        name: "Graffiti Logo Cap",
        category: "Accessories",
        costPrice: 9,
        salePrice: 32,
        weeklySales: 150,
        monthlySales: 620,
        yearlySales: 7440,
        status: "Available",
      },
      {
        id: "la-poster",
        name: "Tour Poster Set",
        category: "Collectibles",
        costPrice: 6,
        salePrice: 24,
        weeklySales: 90,
        monthlySales: 360,
        yearlySales: 4200,
        status: "Locked",
      },
    ],
  },
  "New York": {
    metrics: {
      totalRevenue: 312_900,
      profitMargin: 0.47,
      averageOrderValue: 74,
      conversionRate: 0.182,
    },
    spotlight: "Flagship store foot traffic surged after the record release party — signed vinyl bundles are nearly sold out.",
    products: [
      {
        id: "ny-jacket",
        name: "Midnight Skyline Jacket",
        category: "Apparel",
        costPrice: 45,
        salePrice: 120,
        weeklySales: 130,
        monthlySales: 520,
        yearlySales: 6240,
        status: "Available",
      },
      {
        id: "ny-record",
        name: "Signed Collector Vinyl",
        category: "Collectibles",
        costPrice: 18,
        salePrice: 65,
        weeklySales: 280,
        monthlySales: 1120,
        yearlySales: 13440,
        status: "Available",
      },
      {
        id: "ny-bag",
        name: "Street Team Sling Bag",
        category: "Accessories",
        costPrice: 14,
        salePrice: 48,
        weeklySales: 210,
        monthlySales: 830,
        yearlySales: 9960,
        status: "Upgradeable",
      },
      {
        id: "ny-pass",
        name: "Backstage City Pass",
        category: "Experiences",
        costPrice: 0,
        salePrice: 95,
        weeklySales: 60,
        monthlySales: 220,
        yearlySales: 2520,
        status: "Locked",
      },
    ],
  },
  "Berlin": {
    metrics: {
      totalRevenue: 187_200,
      profitMargin: 0.38,
      averageOrderValue: 56,
      conversionRate: 0.142,
    },
    spotlight: "Immersive projections at the art-house residency boosted merch conversions among touring fans.",
    products: [
      {
        id: "berlin-tee",
        name: "Neon Skyline Tee",
        category: "Apparel",
        costPrice: 11,
        salePrice: 34,
        weeklySales: 260,
        monthlySales: 980,
        yearlySales: 11320,
        status: "Available",
      },
      {
        id: "berlin-patch",
        name: "Analog Synth Patch Set",
        category: "Accessories",
        costPrice: 5,
        salePrice: 22,
        weeklySales: 190,
        monthlySales: 710,
        yearlySales: 8520,
        status: "Available",
      },
      {
        id: "berlin-print",
        name: "Residency Art Print",
        category: "Collectibles",
        costPrice: 7,
        salePrice: 28,
        weeklySales: 120,
        monthlySales: 430,
        yearlySales: 5160,
        status: "Upgradeable",
      },
      {
        id: "berlin-pin",
        name: "Retro Enamel Pin",
        category: "Accessories",
        costPrice: 3,
        salePrice: 14,
        weeklySales: 210,
        monthlySales: 820,
        yearlySales: 9840,
        status: "Locked",
      },
    ],
  },
};

const cityOptions = Object.keys(cityMerchandise);

const Merchandise = () => {
  const [selectedCity, setSelectedCity] = useState<string>(cityOptions[0] ?? "Los Angeles");

  const overallSummary = useMemo(() => {
    const allProducts = Object.values(cityMerchandise).flatMap((city) => city.products);
    const totalRevenue = allProducts.reduce((sum, product) => sum + product.salePrice * product.yearlySales, 0);
    const totalCost = allProducts.reduce((sum, product) => sum + product.costPrice * product.yearlySales, 0);
    const totalUnits = allProducts.reduce((sum, product) => sum + product.yearlySales, 0);

    return {
      totalRevenue,
      totalCost,
      totalUnits,
      profitMargin: totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0,
      topOpportunities: allProducts.filter((product) => product.status !== "Available").slice(0, 3),
    };
  }, []);

  const selectedCityData = cityMerchandise[selectedCity] ?? cityMerchandise[cityOptions[0]];

  const selectedCityTotals = useMemo(() => {
    if (!selectedCityData) {
      return { weeklyRevenue: 0, monthlyRevenue: 0, yearlyRevenue: 0, averageMargin: 0 };
    }

    const { products } = selectedCityData;
    const weeklyRevenue = products.reduce((sum, product) => sum + product.salePrice * product.weeklySales, 0);
    const monthlyRevenue = products.reduce((sum, product) => sum + product.salePrice * product.monthlySales, 0);
    const yearlyRevenue = products.reduce((sum, product) => sum + product.salePrice * product.yearlySales, 0);
    const totalMargin = products.reduce(
      (sum, product) => sum + (product.salePrice - product.costPrice) / (product.salePrice || 1),
      0,
    );
    const averageMargin = products.length > 0 ? totalMargin / products.length : 0;

    return { weeklyRevenue, monthlyRevenue, yearlyRevenue, averageMargin };
  }, [selectedCityData]);

  const handlePlaceholderSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Merchandise Operations</h1>
        <p className="text-muted-foreground">
          Track merchandise performance across touring cities, queue up new drops, and coordinate limited edition releases.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="add-product">Add Product</TabsTrigger>
          <TabsTrigger value="remove-product">Remove Product</TabsTrigger>
          <TabsTrigger value="designer">Custom T-Shirt Designer</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <span>City Performance Overview</span>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs uppercase text-muted-foreground">Select City</p>
                    <p className="text-sm font-medium">Tailor metrics to your on-the-ground team.</p>
                  </div>
                  <Select value={selectedCity} onValueChange={setSelectedCity}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cityOptions.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardTitle>
              <CardDescription>{selectedCityData?.spotlight}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Total Revenue (YTD)</CardTitle>
                    <CardDescription>Gross merch revenue tracked in this city.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{currencyFormatter.format(selectedCityData?.metrics.totalRevenue ?? 0)}</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Average Order Value</CardTitle>
                    <CardDescription>Merch basket size across shows.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{currencyFormatter.format(selectedCityData?.metrics.averageOrderValue ?? 0)}</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Profit Margin</CardTitle>
                    <CardDescription>After production and staffing costs.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{percentFormatter.format(selectedCityData?.metrics.profitMargin ?? 0)}</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold">Conversion Rate</CardTitle>
                    <CardDescription>Share of attendees purchasing merch.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{percentFormatter.format(selectedCityData?.metrics.conversionRate ?? 0)}</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Product Sales Snapshot</CardTitle>
                <CardDescription>Compare cost structure, pricing, and sell-through for each product line.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-dashed bg-muted/30 p-4">
                    <p className="text-xs uppercase text-muted-foreground">Weekly Revenue</p>
                    <p className="text-2xl font-semibold">{currencyFormatter.format(selectedCityTotals.weeklyRevenue)}</p>
                  </div>
                  <div className="rounded-lg border border-dashed bg-muted/30 p-4">
                    <p className="text-xs uppercase text-muted-foreground">Monthly Revenue</p>
                    <p className="text-2xl font-semibold">{currencyFormatter.format(selectedCityTotals.monthlyRevenue)}</p>
                  </div>
                  <div className="rounded-lg border border-dashed bg-muted/30 p-4">
                    <p className="text-xs uppercase text-muted-foreground">Average Margin</p>
                    <p className="text-2xl font-semibold">{percentFormatter.format(selectedCityTotals.averageMargin)}</p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden xl:table-cell">Category</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Sale</TableHead>
                      <TableHead className="hidden md:table-cell">Weekly</TableHead>
                      <TableHead className="hidden md:table-cell">Monthly</TableHead>
                      <TableHead className="hidden lg:table-cell">Yearly</TableHead>
                      <TableHead className="hidden lg:table-cell">Unit Profit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedCityData?.products.map((product) => {
                      const unitProfit = product.salePrice - product.costPrice;
                      const margin = product.salePrice ? unitProfit / product.salePrice : 0;
                      const statusVariant =
                        product.status === "Locked"
                          ? "destructive"
                          : product.status === "Upgradeable"
                            ? "secondary"
                            : "outline";

                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold">{product.name}</span>
                              <span className="text-xs text-muted-foreground">{percentFormatter.format(margin)} margin</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">{product.category}</TableCell>
                          <TableCell>{currencyFormatter.format(product.costPrice)}</TableCell>
                          <TableCell>{currencyFormatter.format(product.salePrice)}</TableCell>
                          <TableCell className="hidden md:table-cell">{product.weeklySales.toLocaleString()}</TableCell>
                          <TableCell className="hidden md:table-cell">{product.monthlySales.toLocaleString()}</TableCell>
                          <TableCell className="hidden lg:table-cell">{product.yearlySales.toLocaleString()}</TableCell>
                          <TableCell className="hidden lg:table-cell">{currencyFormatter.format(unitProfit)}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant as "default" | "secondary" | "destructive" | "outline"}>
                              {product.status === "Locked" ? (
                                <span className="flex items-center gap-1">
                                  <Lock className="h-3.5 w-3.5" /> Locked
                                </span>
                              ) : product.status === "Upgradeable" ? (
                                <span className="flex items-center gap-1">
                                  <ArrowUpRight className="h-3.5 w-3.5" /> Upgradeable
                                </span>
                              ) : (
                                "Available"
                              )}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Global Opportunities</CardTitle>
                <CardDescription>
                  Locked or upgradeable items across cities. Prioritize production to unlock revenue.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-dashed bg-muted/30 p-4">
                  <p className="text-xs uppercase text-muted-foreground">Network Revenue</p>
                  <p className="text-2xl font-semibold">{currencyFormatter.format(overallSummary.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">
                    Profit margin {percentFormatter.format(overallSummary.profitMargin)} across {overallSummary.totalUnits.toLocaleString()} units
                    sold globally.
                  </p>
                </div>
                <div className="space-y-3">
                  {overallSummary.topOpportunities.map((product) => (
                    <div key={product.id} className="rounded-lg border bg-muted/40 p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.category}</p>
                        </div>
                        <Badge variant={product.status === "Locked" ? "destructive" : "secondary"}>{product.status}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Unlocking could add {currencyFormatter.format(product.salePrice * product.monthlySales)} monthly revenue.
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="add-product">
          <Card>
            <CardHeader>
              <CardTitle>Launch a New Merch Drop</CardTitle>
              <CardDescription>
                Draft the details for your next product — production orders remain in review until approved by operations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handlePlaceholderSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product Name</label>
                  <Input placeholder="e.g. Tour Finale Bomber Jacket" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">City Launch</label>
                  <Select defaultValue={selectedCity}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cityOptions.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cost Price</label>
                  <Input type="number" min={0} step={0.5} placeholder="12.00" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sale Price</label>
                  <Input type="number" min={0} step={0.5} placeholder="45.00" required />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium">Launch Notes</label>
                  <Textarea rows={4} placeholder="Share marketing tie-ins, influencer partners, or tour story hooks." />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full" disabled>
                    Submit for Approval
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="remove-product">
          <Card>
            <CardHeader>
              <CardTitle>Product Retirement Checklist</CardTitle>
              <CardDescription>
                Confirm which merch items should be sunset after the current leg of the tour.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                Removing a product notifies distribution hubs, updates venue inventory manifests, and archives related bundles.
                Double-check any outstanding VIP packages or fan club commitments before confirming.
              </div>
              <form className="grid gap-4 md:grid-cols-2" onSubmit={handlePlaceholderSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Product to Remove</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedCityData?.products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Effective City</label>
                  <Select defaultValue={selectedCity}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cityOptions.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium">Reason for Removal</label>
                  <Textarea rows={4} placeholder="Share sell-through data or replacement product details." />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full" variant="secondary" disabled>
                    Schedule Removal
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="designer">
          <Card>
            <CardHeader>
              <CardTitle>Custom T-Shirt Designer</CardTitle>
              <CardDescription>
                Drop in tour poster art, commemorative record release graphics, or city-specific iconography to preview your next tee.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/40 bg-muted/30 p-10 text-center">
                <UploadCloud className="h-10 w-10 text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold">Drag & Drop Artwork</p>
                  <p className="text-sm text-muted-foreground">
                    Upload layered PNGs, vector logos, or backstage photo moments to generate mockups for your crew.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button type="button" disabled>
                    Upload Files
                  </Button>
                  <Button type="button" variant="outline" disabled>
                    Explore Inspiration Tour
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">Artwork Inspiration</CardTitle>
                    <CardDescription>Recent designs fans loved.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>• Limited pressings referencing the "Neon Afterglow" record release.</p>
                    <p>• Tour stop skyline silhouettes with glow-in-the-dark ink.</p>
                    <p>• Fan-submitted graffiti tags layered with band monograms.</p>
                  </CardContent>
                </Card>
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">Production Notes</CardTitle>
                    <CardDescription>Ensure stage-ready quality.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>• Prioritize eco-friendly inks for European tour legs.</p>
                    <p>• Keep design colors under six layers for quick turnaround.</p>
                    <p>• Verify licensing for collaborative artwork before printing.</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Merchandise;
