import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Castle,
  Coins,
  Compass,
  Flame,
  Link2,
  MapPin,
  Shield,
  Skull,
  Sparkles,
  Store,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { useUnderworld, type CryptoToken } from "@/hooks/useUnderworld";
import { useCryptoTokens } from "@/hooks/useCryptoTokens";
import { useAuth } from "@/hooks/use-auth-context";
import underworldVeil from "@/assets/underworld-veil.svg";
import { UnderworldStoreTab } from "@/components/underworld/UnderworldStoreTab";
import { toast } from "sonner";

const loreSections = [
  {
    title: "Veil Rift",
    description: "A neon cavern where traders whisper rates that never surface above ground.",
    accent: "Arcane liquidity node",
    icon: Sparkles,
  },
  {
    title: "Gutter Bazaar",
    description: "Tinkerers swap contraband gear beside graffiti-marked freight crates.",
    accent: "Hardware haggling lane",
    icon: Flame,
  },
  {
    title: "Echo Atrium",
    description: "Sound designers test mixes against the stone cathedral's infinite reverb.",
    accent: "Performance test bed",
    icon: Castle,
  },
  {
    title: "Courier Loop",
    description: "Trusted runners route artifacts and IOUs through hidden tram tunnels.",
    accent: "Logistics corridor",
    icon: Compass,
  },
];

const heroLinks = [
  { label: "Shadow Store", href: "store" },
  { label: "Market intel", href: "market" },
  { label: "Lore districts", href: "lore" },
  { label: "Allies & exits", href: "actions" },
];

const callToActions = [
  {
    title: "Navigate the City",
    description: "Scout safe travel lanes and avoid watchful drones before heading topside.",
    href: "/travel",
    icon: MapPin,
  },
  {
    title: "Study the Pulse",
    description: "Check World Pulse briefings to anticipate when Underworld gates reopen.",
    href: "/world-pulse",
    icon: BookOpen,
  },
  {
    title: "Secure a Safehouse",
    description: "Reserve rehearsal rooms with reinforced walls for late-night experiments.",
    href: "/rehearsals",
    icon: Shield,
  },
];

export const formatPrice = (price: number) => {
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
export const formatVolume = (volume: number) => {
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(1)}K`;
  return `$${volume.toFixed(0)}`;
};
const formatDate = (date: string) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const sectionVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const AnchorLink = ({ href, label }: { href: string; label: string }) => {
  const scrollToSection = () => {
    const el = document.getElementById(href);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <Button variant="secondary" size="sm" className="gap-2" onClick={scrollToSection}>
      <Link2 className="h-4 w-4" />
      {label}
    </Button>
  );
};

// Price flash component
const PriceCell = ({ price, previousPrice }: { price: number; previousPrice?: number }) => {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (previousPrice !== undefined && previousPrice !== price) {
      setFlash(price > previousPrice ? "up" : "down");
      const timer = setTimeout(() => setFlash(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [price, previousPrice]);

  return (
    <span
      className={cn(
        "font-mono transition-colors duration-300",
        flash === "up" && "text-green-400 bg-green-400/10 rounded px-1",
        flash === "down" && "text-red-400 bg-red-400/10 rounded px-1"
      )}
    >
      {formatPrice(price)}
    </span>
  );
};

// Portfolio panel
const PortfolioPanel = ({ userId }: { userId: string }) => {
  const { holdings, isLoading } = useCryptoTokens(userId);

  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!holdings || holdings.length === 0) return null;

  const totalValue = holdings.reduce((sum, h) => sum + h.quantity * (h.token?.current_price || 0), 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.quantity * h.average_buy_price, 0);
  const pnl = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-primary" />
          Your Portfolio
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-2xl font-bold font-mono">{formatPrice(totalValue)}</p>
            <p className="text-xs text-muted-foreground">Total holdings value</p>
          </div>
          <div className="text-right">
            <p className={cn("text-lg font-bold font-mono", pnl >= 0 ? "text-green-400" : "text-red-400")}>
              {pnl >= 0 ? "+" : ""}{formatPrice(pnl)}
            </p>
            <p className={cn("text-xs", pnl >= 0 ? "text-green-400" : "text-red-400")}>
              {pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
            </p>
          </div>
        </div>
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {holdings.map((h) => {
            const currentVal = h.quantity * (h.token?.current_price || 0);
            const costBasis = h.quantity * h.average_buy_price;
            const holdingPnl = currentVal - costBasis;
            return (
              <div key={h.id} className="flex items-center justify-between text-sm rounded-lg px-2 py-1 bg-muted/30">
                <div>
                  <span className="font-mono font-bold">{h.token?.symbol}</span>
                  <span className="text-muted-foreground ml-2">{h.quantity.toFixed(2)} units</span>
                </div>
                <span className={cn("font-mono text-xs", holdingPnl >= 0 ? "text-green-400" : "text-red-400")}>
                  {holdingPnl >= 0 ? "+" : ""}{formatPrice(holdingPnl)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// Rug alert
const RugAlertBanner = ({ ruggedSymbols }: { ruggedSymbols: string[] }) => {
  if (ruggedSymbols.length === 0) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 flex items-center gap-3"
      >
        <Skull className="h-6 w-6 text-red-400 flex-shrink-0" />
        <div>
          <p className="font-bold text-red-400">⚠️ RUG PULL ALERT</p>
          <p className="text-sm text-red-300">
            {ruggedSymbols.join(", ")} {ruggedSymbols.length === 1 ? "has" : "have"} been rugged! Price dropped to $0.00
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export const UnderworldContent = ({ tokens, tokensLoading }: { tokens: CryptoToken[]; tokensLoading: boolean }) => {
  const { user } = useAuth();
  const { holdings, buyToken, sellToken, isBuying, isSelling } = useCryptoTokens(user?.id);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [buyQuantity, setBuyQuantity] = useState("");
  const [sellQuantity, setSellQuantity] = useState("");
  const [ruggedGraveyardOpen, setRuggedGraveyardOpen] = useState(false);
  const previousPricesRef = useRef<Record<string, number>>({});

  // Track previous prices for flash animations
  const previousPrices = previousPricesRef.current;
  useEffect(() => {
    if (tokens.length > 0) {
      const newPrices: Record<string, number> = {};
      tokens.forEach((t) => { newPrices[t.symbol] = t.current_price; });
      // Update after render so current render uses old prices
      const timer = setTimeout(() => { previousPricesRef.current = newPrices; }, 100);
      return () => clearTimeout(timer);
    }
  }, [tokens]);

  const activeTokens = useMemo(() => tokens.filter((t) => t.is_active && !t.is_rugged), [tokens]);
  const selectedTokenData = useMemo(
    () => activeTokens.find((t) => t.symbol === selectedToken) || (activeTokens.length > 0 ? activeTokens[0] : null),
    [activeTokens, selectedToken]
  );
  const chartData = selectedTokenData?.price_history || [];

  // Check if user holds any rugged tokens
  const ruggedHeldSymbols = useMemo(() => {
    if (!holdings) return [];
    return holdings
      .filter((h) => h.token && (h.token as any).is_rugged)
      .map((h) => (h.token as any)?.symbol)
      .filter(Boolean);
  }, [holdings]);

  // Compute overview metrics from live data
  const totalMarketCap = useMemo(() => activeTokens.reduce((s, t) => s + (t.market_cap || 0), 0), [activeTokens]);
  const totalVolume = useMemo(() => activeTokens.reduce((s, t) => s + (t.volume_24h || 0), 0), [activeTokens]);

  const handleBuy = () => {
    if (!selectedTokenData || !buyQuantity || !user) return;
    const qty = parseFloat(buyQuantity);
    if (isNaN(qty) || qty <= 0) return;
    buyToken({
      tokenId: selectedTokenData.id,
      quantity: qty,
      price: selectedTokenData.current_price,
    });
    setBuyQuantity("");
  };

  const handleSell = () => {
    if (!selectedTokenData || !sellQuantity || !user) return;
    const qty = parseFloat(sellQuantity);
    if (isNaN(qty) || qty <= 0) return;
    sellToken({
      tokenId: selectedTokenData.id,
      quantity: qty,
      price: selectedTokenData.current_price,
    });
    setSellQuantity("");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-slate-950 to-background text-foreground">
      <img
        src={underworldVeil}
        alt="Abstract neon fog"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
        loading="lazy"
      />
      <div className="relative mx-auto max-w-7xl space-y-10 px-6 py-10">
        {/* Breadcrumbs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem><BreadcrumbLink href="/">Home</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbLink href="/city">City</BreadcrumbLink></BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem><BreadcrumbPage>Underworld</BreadcrumbPage></BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1">
              <Shield className="h-3.5 w-3.5" /> Secure relay
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1">
              <Compass className="h-3.5 w-3.5" /> Prices update every 30s
            </span>
          </div>
        </div>

        {/* Hero */}
        <section className="grid gap-8 rounded-3xl border border-primary/10 bg-background/70 p-8 shadow-xl backdrop-blur" id="hero">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4 lg:max-w-2xl">
              <div className="flex items-center gap-3 text-sm text-primary">
                <Coins className="h-6 w-6" />
                <span className="font-semibold uppercase tracking-wide">Underworld Nexus</span>
              </div>
              <h1 className="text-4xl font-bold leading-tight lg:text-5xl">Shadow market for off-ledger deals</h1>
              <p className="text-lg text-muted-foreground">
                Exchange tokens, broker rare merch drops, and follow whispered routes that keep your band ahead of corporate scouts.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="gap-2" onClick={() => document.getElementById("store")?.scrollIntoView({ behavior: "smooth" })}>
                  <Store className="h-4 w-4" /> Browse Shadow Store
                </Button>
                <Button size="lg" variant="outline" className="gap-2" onClick={() => document.getElementById("market")?.scrollIntoView({ behavior: "smooth" })}>
                  <ArrowDownRight className="h-4 w-4" /> Enter the pit
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {heroLinks.map((link) => <AnchorLink key={link.href} href={link.href} label={link.label} />)}
              </div>
            </div>
            <div className="w-full lg:max-w-sm">
              <Card className="border-primary/30 bg-primary/5 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-primary" /> Live intel
                  </CardTitle>
                  <CardDescription>Real-time market data. Prices auto-refresh.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Total Market Cap</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold font-mono">{formatVolume(totalMarketCap)}</p>
                  </div>
                  <div className="rounded-xl border border-muted/60 px-4 py-3">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>24h Volume</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold font-mono">{formatVolume(totalVolume)}</p>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Active Tokens</span>
                      <Badge variant="outline" className="text-xs">{activeTokens.length}/100</Badge>
                    </div>
                    <p className="mt-1 text-2xl font-bold">{activeTokens.length}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Rug Alert */}
        <RugAlertBanner ruggedSymbols={ruggedHeldSymbols} />

        {/* Portfolio */}
        {user && <PortfolioPanel userId={user.id} />}

        {/* Shadow Store */}
        <section id="store" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary"><Store className="h-5 w-5" /></div>
            <div>
              <p className="text-sm uppercase tracking-wide text-primary">Shadow Store</p>
              <h2 className="text-3xl font-semibold">Acquire power from the depths</h2>
              <p className="text-muted-foreground">Consumables, boosters, and forbidden knowledge.</p>
            </div>
          </div>
          <Card className="border-primary/20 bg-background/70">
            <CardContent className="pt-6"><UnderworldStoreTab /></CardContent>
          </Card>
        </section>

        {/* Lore */}
        <section id="lore" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary"><BookOpen className="h-5 w-5" /></div>
            <div>
              <p className="text-sm uppercase tracking-wide text-primary">District lore</p>
              <h2 className="text-3xl font-semibold">Navigate the tunnels without losing the plot</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {loreSections.map((entry) => {
              const Icon = entry.icon;
              return (
                <motion.div key={entry.title} variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true, amount: 0.2 }} className="rounded-2xl border border-muted/50 bg-background/60 p-5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></span>
                      <h3 className="text-xl font-semibold">{entry.title}</h3>
                    </div>
                    <Badge variant="outline" className="border-primary/40 text-xs text-primary">{entry.accent}</Badge>
                  </div>
                  <p className="mt-3 text-muted-foreground">{entry.description}</p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* Market */}
        <section id="market" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-wide text-primary">Token desk</p>
              <h2 className="text-3xl font-semibold">Trade routes, charts, and liquidity</h2>
              <p className="text-muted-foreground">Choose a token to trade. Prices are volatile — trade at your own risk.</p>
            </div>
            <Badge variant="outline" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" /> Tokens can rug at any time
            </Badge>
          </div>

          <Card className="border-primary/20 bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">Crypto Market</CardTitle>
              <CardDescription>Live token prices — auto-refreshing every 30s</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tokensLoading ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, idx) => <Skeleton key={idx} className="h-12 w-full rounded-lg" />)}
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Token</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">24h Change</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Volume</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Tier</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeTokens.map((token) => {
                        const hist = token.price_history || [];
                        const priceChange24h = hist.length > 1
                          ? ((token.current_price - hist[0].price) / hist[0].price) * 100
                          : 0;
                        const isPositive = priceChange24h >= 0;
                        const tierColors: Record<string, string> = {
                          blue_chip: "text-blue-400",
                          large: "text-purple-400",
                          mid: "text-yellow-400",
                          micro: "text-red-400",
                        };

                        return (
                          <TableRow
                            key={token.symbol}
                            className={cn(
                              "cursor-pointer transition hover:bg-primary/5",
                              selectedToken === token.symbol && "bg-primary/10"
                            )}
                            onClick={() => setSelectedToken(token.symbol)}
                          >
                            <TableCell>
                              <div className="font-mono font-bold">{token.symbol}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[120px]">{token.name}</div>
                            </TableCell>
                            <TableCell className="text-right">
                              <PriceCell price={token.current_price} previousPrice={previousPrices[token.symbol]} />
                            </TableCell>
                            <TableCell className={cn("text-right font-medium text-xs", isPositive ? "text-green-400" : "text-red-400")}>
                              <span className="inline-flex items-center gap-0.5">
                                {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                {isPositive ? "+" : ""}{priceChange24h.toFixed(2)}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs hidden md:table-cell">{formatVolume(token.volume_24h || 0)}</TableCell>
                            <TableCell className={cn("text-right text-xs hidden md:table-cell capitalize", tierColors[token.volatility_tier] || "")}>
                              {token.volatility_tier?.replace("_", " ")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" className="text-xs" onClick={(e) => { e.stopPropagation(); setSelectedToken(token.symbol); }}>
                                Trade
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Selected token detail + trading */}
              {!tokensLoading && selectedTokenData && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedTokenData.name} ({selectedTokenData.symbol})</h3>
                      <p className="text-sm text-muted-foreground">{selectedTokenData.description || "No description available."}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">{selectedTokenData.volatility_tier?.replace("_", " ")}</Badge>
                        <Badge variant="outline" className="text-xs font-mono">{formatPrice(selectedTokenData.current_price)}</Badge>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedToken(null)}>Clear focus</Button>
                  </div>

                  {chartData.length > 1 && (
                    <ChartContainer config={{ price: { label: "Price", color: "hsl(var(--primary))" } }} className="h-64">
                      <AreaChart data={chartData} margin={{ left: 10, right: 10 }}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="timestamp" tickFormatter={formatDate} stroke="hsl(var(--muted-foreground))" />
                        <YAxis domain={["dataMin * 0.9", "dataMax * 1.1"]} tickFormatter={(val) => formatPrice(val)} stroke="hsl(var(--muted-foreground))" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPrice)" />
                      </AreaChart>
                    </ChartContainer>
                  )}

                  <Tabs defaultValue="buy" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="buy">Buy</TabsTrigger>
                      <TabsTrigger value="sell">Sell</TabsTrigger>
                    </TabsList>
                    <TabsContent value="buy" className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="buy-quantity">Quantity</Label>
                          <Input
                            id="buy-quantity"
                            type="number"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={buyQuantity}
                            onChange={(e) => setBuyQuantity(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Total Cost</Label>
                          <div className="h-10 flex items-center px-3 border rounded-md bg-muted/30 font-mono text-sm">
                            {buyQuantity ? formatPrice(parseFloat(buyQuantity || "0") * selectedTokenData.current_price) : "—"}
                          </div>
                        </div>
                      </div>
                      <Button className="w-full" onClick={handleBuy} disabled={isBuying || !user || !buyQuantity}>
                        {isBuying ? "Processing..." : `Buy ${selectedTokenData.symbol} at ${formatPrice(selectedTokenData.current_price)}`}
                      </Button>
                      {!user && <p className="text-xs text-muted-foreground text-center">Log in to trade</p>}
                    </TabsContent>
                    <TabsContent value="sell" className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="sell-quantity">Quantity</Label>
                          <Input
                            id="sell-quantity"
                            type="number"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={sellQuantity}
                            onChange={(e) => setSellQuantity(e.target.value)}
                          />
                          {holdings && holdings.find((h) => h.token_id === selectedTokenData.id) && (
                            <p className="text-xs text-muted-foreground mt-1">
                              You hold: {holdings.find((h) => h.token_id === selectedTokenData.id)!.quantity.toFixed(4)}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Total Revenue</Label>
                          <div className="h-10 flex items-center px-3 border rounded-md bg-muted/30 font-mono text-sm">
                            {sellQuantity ? formatPrice(parseFloat(sellQuantity || "0") * selectedTokenData.current_price) : "—"}
                          </div>
                        </div>
                      </div>
                      <Button className="w-full" variant="destructive" onClick={handleSell} disabled={isSelling || !user || !sellQuantity}>
                        {isSelling ? "Processing..." : `Sell ${selectedTokenData.symbol} at ${formatPrice(selectedTokenData.current_price)}`}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Allies & exits */}
        <section id="actions" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary"><MapPin className="h-5 w-5" /></div>
            <div>
              <p className="text-sm uppercase tracking-wide text-primary">Allies & exits</p>
              <h2 className="text-3xl font-semibold">Move quietly between trusted nodes</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {callToActions.map((cta) => {
              const Icon = cta.icon;
              return (
                <Card key={cta.title} className="border-primary/20 bg-background/70">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></span>
                      <CardTitle className="text-lg">{cta.title}</CardTitle>
                    </div>
                    <CardDescription>{cta.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full" variant="outline"><a href={cta.href}>Open link</a></Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};

const Underworld = () => {
  const { tokens, tokensLoading } = useUnderworld();
  return <UnderworldContent tokens={tokens} tokensLoading={tokensLoading} />;
};

export default Underworld;
