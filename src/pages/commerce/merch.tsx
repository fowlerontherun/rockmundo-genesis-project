import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  Flame,
  Loader2,
  PackageSearch,
  Palette,
  Sparkles,
  TrendingUp,
} from "lucide-react";

import { MerchCategoryPerformanceChart, MerchSalesTrendChart } from "@/components/charts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePrimaryBand } from "@/hooks/usePrimaryBand";
import {
  buildCategoryPerformance,
  buildSalesTrendSeries,
  computeInventoryHealth,
  fetchMerchInventory,
  fetchMerchOrders,
  formatMerchCurrency,
  formatMerchPercent,
  summarizeMerchOrders,
  type MerchInventoryItem,
} from "@/lib/api/merch";

const fabricPalette = ["#111827", "#fde68a", "#f1f5f9", "#0f766e", "#1d4ed8", "#9333ea"];
const inkPalette = ["#fb7185", "#f97316", "#22d3ee", "#a855f7", "#facc15", "#4ade80"];
const patternOptions = ["none", "halftone", "grid", "sunburst"] as const;
const productShapes = ["tee", "hoodie", "poster"] as const;

type PatternOption = (typeof patternOptions)[number];
type ProductShape = (typeof productShapes)[number];

type DesignerSettings = {
  title: string;
  tagline: string;
  fabricColor: string;
  inkColor: string;
  accentColor: string;
  pattern: PatternOption;
  productShape: ProductShape;
  texture: number;
};

const defaultDesignerSettings: DesignerSettings = {
  title: "Night Parade",
  tagline: "Limited edition city drop",
  fabricColor: fabricPalette[0],
  inkColor: "#f9fafb",
  accentColor: inkPalette[0],
  pattern: "halftone",
  productShape: "tee",
  texture: 0.45,
};

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

interface MerchDesignerCanvasProps {
  settings: DesignerSettings;
}

const MerchDesignerCanvas = ({ settings }: MerchDesignerCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const drawBackground = () => {
      ctx.fillStyle = settings.fabricColor;
      ctx.fillRect(0, 0, width, height);
    };

    const drawGarmentSilhouette = () => {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.fillStyle = settings.fabricColor;
      ctx.strokeStyle = "rgba(17, 24, 39, 0.65)";
      ctx.lineWidth = 4;

      if (settings.productShape === "poster") {
        const posterWidth = width * 0.68;
        const posterHeight = height * 0.82;
        ctx.fillStyle = "#f1f5f9";
        ctx.strokeStyle = settings.accentColor;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.rect(-posterWidth / 2, -posterHeight / 2, posterWidth, posterHeight);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        const bodyWidth = width * 0.62;
        const bodyHeight = height * 0.68;
        const shoulderCurve = settings.productShape === "hoodie" ? 48 : 36;

        ctx.moveTo(-bodyWidth / 2, -bodyHeight / 2 + shoulderCurve);
        ctx.quadraticCurveTo(-bodyWidth / 2, -bodyHeight / 2, -bodyWidth / 2 + 40, -bodyHeight / 2);
        ctx.lineTo(bodyWidth / 2 - 40, -bodyHeight / 2);
        ctx.quadraticCurveTo(bodyWidth / 2, -bodyHeight / 2, bodyWidth / 2, -bodyHeight / 2 + shoulderCurve);
        ctx.lineTo(bodyWidth / 2, bodyHeight / 2 - 60);
        ctx.quadraticCurveTo(bodyWidth / 2 - 12, bodyHeight / 2, bodyWidth / 2 - 64, bodyHeight / 2);
        ctx.lineTo(-bodyWidth / 2 + 64, bodyHeight / 2);
        ctx.quadraticCurveTo(-bodyWidth / 2, bodyHeight / 2, -bodyWidth / 2, bodyHeight / 2 - 60);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (settings.productShape === "hoodie") {
          ctx.beginPath();
          ctx.fillStyle = settings.fabricColor;
          ctx.strokeStyle = "rgba(15, 23, 42, 0.6)";
          ctx.lineWidth = 3;
          ctx.ellipse(0, -bodyHeight / 2 + 28, bodyWidth * 0.27, bodyHeight * 0.18, 0, Math.PI, 0, true);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();
    };

    const drawPattern = () => {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.globalAlpha = 0.12 + settings.texture * 0.18;
      ctx.fillStyle = settings.accentColor;
      ctx.strokeStyle = settings.accentColor;

      switch (settings.pattern) {
        case "grid": {
          const spacing = 28 - settings.texture * 10;
          for (let x = -width; x < width; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, -height);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let y = -height; y < height; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(-width, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }
          break;
        }
        case "halftone": {
          const dotSpacing = 26 - settings.texture * 12;
          const dotRadius = 3 + settings.texture * 4;
          for (let y = -height / 2; y < height / 2; y += dotSpacing) {
            for (let x = -width / 2; x < width / 2; x += dotSpacing) {
              ctx.beginPath();
              ctx.arc(x, y, dotRadius * Math.abs(Math.sin((x + y) / 120)), 0, Math.PI * 2);
              ctx.fill();
            }
          }
          break;
        }
        case "sunburst": {
          const rays = 18;
          ctx.lineWidth = 6;
          for (let index = 0; index < rays; index += 1) {
            const angle = (index / rays) * Math.PI * 2;
            const length = height * (0.6 + ((index % 3) / 10));
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
            ctx.stroke();
          }
          break;
        }
        default:
          break;
      }

      ctx.restore();
    };

    const drawHighlight = () => {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.globalAlpha = 0.18 + settings.texture * 0.15;
      const gradient = ctx.createRadialGradient(0, 0, 40, 0, 0, 220);
      gradient.addColorStop(0, settings.accentColor);
      gradient.addColorStop(1, "transparent");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, width * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawTypography = () => {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.fillStyle = settings.inkColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.font = `700 ${Math.round(34 + settings.texture * 14)}px 'Bebas Neue', 'Oswald', sans-serif`;
      ctx.fillText(settings.title.toUpperCase(), 0, -18);

      ctx.globalAlpha = 0.9;
      ctx.font = `400 ${Math.round(18 + settings.texture * 6)}px 'Inter', 'Karla', sans-serif`;
      ctx.fillText(settings.tagline, 0, 28);
      ctx.restore();
    };

    drawBackground();
    drawGarmentSilhouette();
    if (settings.pattern !== "none") {
      drawPattern();
    }
    drawHighlight();
    drawTypography();
  }, [settings]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
      <canvas ref={canvasRef} width={420} height={420} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-4 text-xs font-medium text-muted-foreground">
        {settings.productShape === "poster"
          ? "Poster mock simulated in canvas"
          : "Garment mock simulated in canvas"}
      </div>
    </div>
  );
};

const swatchClasses = "h-8 w-8 rounded-md border border-border/50";

export default function MerchCommercePage() {
  const { data: primaryBand, isLoading: loadingPrimaryBand } = usePrimaryBand();
  const bandId = primaryBand?.band_id;
  const bandName = primaryBand?.bands?.name ?? "your band";

  const [designerSettings, setDesignerSettings] = useState<DesignerSettings>(defaultDesignerSettings);

  const inventoryQuery = useQuery({
    queryKey: ["merch-inventory", bandId],
    queryFn: () => fetchMerchInventory(bandId as string),
    enabled: Boolean(bandId),
  });

  const ordersQuery = useQuery({
    queryKey: ["merch-orders", bandId, inventoryQuery.data?.length ?? 0],
    queryFn: () => fetchMerchOrders(bandId as string, inventoryQuery.data ?? []),
    enabled: Boolean(bandId) && !inventoryQuery.isLoading,
  });

  const inventory = useMemo(
    () => (inventoryQuery.data ?? []) as MerchInventoryItem[],
    [inventoryQuery.data],
  );
  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);

  const orderSummary = useMemo(() => summarizeMerchOrders(orders), [orders]);
  const inventoryHealth = useMemo(() => computeInventoryHealth(inventory), [inventory]);
  const salesTrend = useMemo(() => buildSalesTrendSeries(orders), [orders]);
  const categoryPerformance = useMemo(
    () => buildCategoryPerformance(inventory, orders),
    [inventory, orders],
  );

  const restockAlerts = useMemo(
    () =>
      [...inventoryHealth.lowStock].sort(
        (a, b) => (a.stock_quantity ?? 0) - (b.stock_quantity ?? 0),
      ),
    [inventoryHealth.lowStock],
  );

  const handleSettingChange = useCallback(<K extends keyof DesignerSettings>(key: K, value: DesignerSettings[K]) => {
    setDesignerSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyPreset = useCallback(
    (preset: Partial<DesignerSettings>) => {
      setDesignerSettings((prev) => ({ ...prev, ...preset }));
    },
    [],
  );

  if (loadingPrimaryBand) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Checking band permissions...
      </div>
    );
  }

  if (!bandId) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Link your band to unlock commerce tools</CardTitle>
            <CardDescription>
              Join or create a band first. The merch command center pulls live inventory from your Supabase tables.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              When you become an active band member, this workspace will auto-load your merch inventory, simulate order
              flows, and reveal analytics tuned to your drops.
            </p>
            <p>Head to the Band Manager to invite teammates and start building your merch economy.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = inventoryQuery.isLoading || ordersQuery.isLoading;

  return (
    <div className="space-y-10 pb-16">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" /> Commerce Ops Hub
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Merch Designer &amp; Control Room</h1>
        <p className="max-w-2xl text-muted-foreground">
          Prototype new drops, monitor velocity, and keep {bandName}&apos;s inventory dialed-in without leaving your
          command center.
        </p>
      </header>

      <section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trailing 30-day revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatMerchCurrency(orderSummary.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                Avg order value {formatMerchCurrency(orderSummary.averageOrderValue || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory on hand</CardTitle>
              <PackageSearch className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{numberFormatter.format(inventoryHealth.totalUnits)}</div>
              <p className="text-xs text-muted-foreground">
                Potential revenue {formatMerchCurrency(inventoryHealth.potentialRevenue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fulfillment rate</CardTitle>
              <BadgeCheck className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatMerchPercent(orderSummary.fulfillmentRate || 0)}</div>
              <p className="text-xs text-muted-foreground">
                {orderSummary.orderCount} orders processed last 8 weeks
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Margin outlook</CardTitle>
              <Flame className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatMerchPercent(inventoryHealth.grossMargin || 0)}</div>
              <p className="text-xs text-muted-foreground">
                Cost basis {formatMerchCurrency(inventoryHealth.costBasis)}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Concept canvas</CardTitle>
            <CardDescription>
              Tweak palette and typography to visualize the next drop before sending specs to production.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <MerchDesignerCanvas settings={designerSettings} />
            <Tabs defaultValue="palette" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="palette">Palette</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="presets">Presets</TabsTrigger>
              </TabsList>
              <TabsContent value="palette" className="space-y-6 pt-4">
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                    <Palette className="h-4 w-4" /> Fabric color
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {fabricPalette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleSettingChange("fabricColor", color)}
                        className={`${swatchClasses} ${
                          designerSettings.fabricColor === color ? "ring-2 ring-offset-2 ring-primary" : ""
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select fabric color ${color}`}
                      />
                    ))}
                    <Input
                      type="color"
                      value={designerSettings.fabricColor}
                      onChange={(event) => handleSettingChange("fabricColor", event.target.value)}
                      className="h-8 w-12 cursor-pointer rounded-md border border-border/50 p-1"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                    <Sparkles className="h-4 w-4" /> Ink &amp; accent
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {inkPalette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleSettingChange("accentColor", color)}
                        className={`${swatchClasses} ${
                          designerSettings.accentColor === color ? "ring-2 ring-offset-2 ring-primary" : ""
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Select accent color ${color}`}
                      />
                    ))}
                    <Input
                      type="color"
                      value={designerSettings.accentColor}
                      onChange={(event) => handleSettingChange("accentColor", event.target.value)}
                      className="h-8 w-12 cursor-pointer rounded-md border border-border/50 p-1"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-xs uppercase text-muted-foreground">Print color</Label>
                    <Input
                      type="color"
                      value={designerSettings.inkColor}
                      onChange={(event) => handleSettingChange("inkColor", event.target.value)}
                      className="h-8 w-12 cursor-pointer rounded-md border border-border/50 p-1"
                    />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="details" className="space-y-6 pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="designer-title">Headline</Label>
                    <Input
                      id="designer-title"
                      value={designerSettings.title}
                      onChange={(event) => handleSettingChange("title", event.target.value)}
                      placeholder="Drop title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designer-tagline">Tagline</Label>
                    <Input
                      id="designer-tagline"
                      value={designerSettings.tagline}
                      onChange={(event) => handleSettingChange("tagline", event.target.value)}
                      placeholder="Tagline copy"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="text-xs uppercase text-muted-foreground">Pattern</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {patternOptions.map((pattern) => (
                        <Button
                          key={pattern}
                          type="button"
                          variant={designerSettings.pattern === pattern ? "default" : "outline"}
                          onClick={() => handleSettingChange("pattern", pattern)}
                        >
                          {pattern === "none" ? "No pattern" : pattern.charAt(0).toUpperCase() + pattern.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs uppercase text-muted-foreground">Product silhouette</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {productShapes.map((shape) => (
                        <Button
                          key={shape}
                          type="button"
                          variant={designerSettings.productShape === shape ? "default" : "outline"}
                          onClick={() => handleSettingChange("productShape", shape)}
                        >
                          {shape.charAt(0).toUpperCase() + shape.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-xs uppercase text-muted-foreground">Texture intensity</Label>
                  <Slider
                    value={[designerSettings.texture]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueChange={(value) => handleSettingChange("texture", value[0] ?? 0)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Increase texture to push halftone depth, grid density, and gradient glow for bolder mockups.
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="presets" className="space-y-4 pt-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      applyPreset({
                        title: "Glow Lines",
                        tagline: "Neon skyline tour drop",
                        fabricColor: "#020617",
                        accentColor: "#38bdf8",
                        inkColor: "#f8fafc",
                        pattern: "grid",
                        productShape: "hoodie",
                        texture: 0.65,
                      })
                    }
                  >
                    Neon Skyline
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      applyPreset({
                        title: "Sunset Riot",
                        tagline: "Limited press art poster",
                        fabricColor: "#fef3c7",
                        accentColor: "#f97316",
                        inkColor: "#0f172a",
                        pattern: "sunburst",
                        productShape: "poster",
                        texture: 0.5,
                      })
                    }
                  >
                    Sunset Poster
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      applyPreset({
                        title: "Chrome Bloom",
                        tagline: "Iridescent fan club tee",
                        fabricColor: "#111827",
                        accentColor: "#c084fc",
                        inkColor: "#f8fafc",
                        pattern: "halftone",
                        productShape: "tee",
                        texture: 0.35,
                      })
                    }
                  >
                    Fan Club Drop
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Presets instantly reset palette, silhouette, and copy. Tweak further to match your merch vendor specs.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Operations snapshot</CardTitle>
            <CardDescription>Keep fulfillment teams aligned and prep restocks before tour legs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Latest activity</p>
                  <p className="text-xs text-muted-foreground">
                    Last order {formatDate(orderSummary.lastOrderAt)} · {orderSummary.orderCount} orders active
                  </p>
                </div>
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="h-3.5 w-3.5" /> {formatMerchCurrency(orderSummary.totalRevenue)} revenue
                </Badge>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Restock radar
              </h3>
              {restockAlerts.length ? (
                <div className="space-y-3">
                  {restockAlerts.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between rounded-md border border-border/60 bg-background/80 p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{item.design_name}</p>
                        <p className="text-xs text-muted-foreground">{item.item_type}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="secondary" className="gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" /> {item.stock_quantity} units
                        </Badge>
                        <span className="text-muted-foreground">
                          {formatMerchCurrency((item.selling_price ?? 0) * (item.stock_quantity ?? 0))} left
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
                  <BadgeCheck className="h-4 w-4 text-primary" />
                  Stock levels look healthy across your current catalogue.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales velocity</CardTitle>
            <CardDescription>Trailing drop performance across storefronts and booths.</CardDescription>
          </CardHeader>
          <CardContent>{isLoading ? <LoadingChartMessage /> : <MerchSalesTrendChart data={salesTrend} />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Category performance</CardTitle>
            <CardDescription>See which lanes are fueling merch revenue right now.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <LoadingChartMessage /> : <MerchCategoryPerformanceChart data={categoryPerformance} />}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Inventory ledger</CardTitle>
            <CardDescription>Live view sourced from Supabase player_merchandise table.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inventoryQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading inventory...
              </div>
            ) : inventory.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Design</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">In stock</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.map((item) => {
                      const value = (item.stock_quantity ?? 0) * (item.selling_price ?? 0);
                      const isLow = (item.stock_quantity ?? 0) < 20;
                      return (
                        <TableRow key={item.id} className={isLow ? "bg-destructive/5" : undefined}>
                          <TableCell>
                            <div className="font-medium">{item.design_name}</div>
                            <div className="text-xs text-muted-foreground">{item.id}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.item_type}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.stock_quantity}</TableCell>
                          <TableCell className="text-right">{formatMerchCurrency(item.selling_price ?? 0)}</TableCell>
                          <TableCell className="text-right">{formatMerchCurrency(value)}</TableCell>
                          <TableCell className="text-right">{formatDate(item.updated_at)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
                <PackageSearch className="h-8 w-8 text-muted-foreground" />
                <p>Add your first product in the Merchandise page to populate this ledger.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

const LoadingChartMessage = () => (
  <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    Crunching numbers from your drops...
  </div>
);
