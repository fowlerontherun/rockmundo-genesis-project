import React, { useMemo, useState } from "react";
import {
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
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
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
import { cn } from "@/lib/utils";
import { Area, AreaChart, XAxis, YAxis } from "recharts";
import { useUnderworld, type CryptoToken } from "@/hooks/useUnderworld";
import underworldVeil from "@/assets/underworld-veil.svg";


interface MerchandiseItem {
  name: string;
  category: string;
  rarity: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
  price: string;
  availability?: "In Stock" | "Limited" | "Restocking";
  lore: string;
}

const mockMerchandise: MerchandiseItem[] = [
  { name: "Phantom Cloak", category: "Apparel", rarity: "Legendary", price: "2,500 SCL", availability: "Limited", lore: "Masks heat signatures to help you slip unseen through the catacombs." },
  { name: "Gloom Resonator", category: "Instruments", rarity: "Epic", price: "1,150 GEM", availability: "In Stock", lore: "Reinforces bass frequencies that only echo inside the Underworld halls." },
  { name: "Shadowbound Strings", category: "Accessories", rarity: "Rare", price: "780 OBL", lore: "Infused with silver dust from the Veil Rift; tuned for haunting ballads." },
  { name: "Eclipse Mix Console", category: "Production", rarity: "Epic", price: "1,450 GEM", availability: "In Stock", lore: "Portable console with cryptic routing presets favored by subculture DJs." },
  { name: "Veil Fragment", category: "Collectibles", rarity: "Uncommon", price: "120 ASH", lore: "A shard of tempered obsidian said to glow when new markets open." },
  { name: "Darkstage Pedal Board", category: "Accessories", rarity: "Rare", price: "890 OBL", availability: "Restocking", lore: "Chain-ready board that adds smoke-like modulation to any riff." },
];

const overviewMetrics = [
  { label: "Total Market Cap", value: "$8.2B", change: "+12.4%", isPositive: true },
  { label: "24h Volume", value: "$412M", change: "-3.2%", isPositive: false },
  { label: "Active Tokens", value: "5", change: "—", isPositive: true },
];

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

export const placeholderTokens: CryptoToken[] = [
  {
    id: "veil",
    symbol: "VEIL",
    name: "Veil Shard",
    current_price: 182.45,
    volume_24h: 5200000,
    market_cap: 320000000,
    price_history: [
      { timestamp: "2024-11-01", price: 160 },
      { timestamp: "2024-11-10", price: 170 },
      { timestamp: "2024-11-20", price: 182.45 },
    ],
    description: "Preferred tender for shadow couriers.",
    created_at: "2024-11-01",
    updated_at: "2024-11-20",
  },
  {
    id: "ember",
    symbol: "EMBER",
    name: "Ember Note",
    current_price: 42.8,
    volume_24h: 1800000,
    market_cap: 82000000,
    price_history: [
      { timestamp: "2024-11-01", price: 36 },
      { timestamp: "2024-11-10", price: 41 },
      { timestamp: "2024-11-20", price: 42.8 },
    ],
    description: "Liquidates fast during surprise raids.",
    created_at: "2024-11-01",
    updated_at: "2024-11-20",
  },
  {
    id: "ash",
    symbol: "ASH",
    name: "Ash Relay",
    current_price: 4.21,
    volume_24h: 920000,
    market_cap: 32000000,
    price_history: [
      { timestamp: "2024-11-01", price: 3.1 },
      { timestamp: "2024-11-10", price: 3.8 },
      { timestamp: "2024-11-20", price: 4.21 },
    ],
    description: "IOUs used for single-night gigs.",
    created_at: "2024-11-01",
    updated_at: "2024-11-20",
  },
];

export const formatPrice = (price: number) =>
  `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const formatVolume = (volume: number) => `$${(volume / 1_000_000).toFixed(2)}M`;
const formatDate = (date: string) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const getDisplayTokens = (tokens: CryptoToken[]) => (tokens.length ? tokens : placeholderTokens);

const rarityStyles: Record<string, { badge: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  Common: { badge: "bg-muted text-muted-foreground", variant: "secondary" },
  Uncommon: { badge: "bg-success text-success-foreground", variant: "default" },
  Rare: { badge: "bg-primary text-primary-foreground", variant: "default" },
  Epic: { badge: "bg-accent text-accent-foreground", variant: "default" },
  Legendary: { badge: "bg-gradient-to-r from-primary to-accent text-primary-foreground", variant: "default" },
};

const availabilityStyles: Record<string, { badge: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  "In Stock": { badge: "bg-success", variant: "default" },
  Limited: { badge: "bg-accent", variant: "default" },
  Restocking: { badge: "bg-muted", variant: "secondary" },
};

const sectionVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const AnchorLink = ({ href, label }: { href: string; label: string }) => {
  const scrollToSection = () => {
    const el = document.getElementById(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <Button variant="secondary" size="sm" className="gap-2" onClick={scrollToSection} aria-label={`Jump to ${label}`}>
      <Link2 className="h-4 w-4" />
      {label}
    </Button>
  );
};

export const UnderworldContent = ({ tokens, tokensLoading }: { tokens: CryptoToken[]; tokensLoading: boolean }) => {
  const [selectedToken, setSelectedToken] = useState<string | null>(tokens[0]?.symbol ?? null);
  const dataTokens = useMemo(() => getDisplayTokens(tokens), [tokens]);
  const selectedTokenData = useMemo(() => dataTokens.find((t) => t.symbol === selectedToken) || dataTokens[0], [dataTokens, selectedToken]);
  const chartData = selectedTokenData?.price_history || [];

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-slate-950 to-background text-foreground">
      <img
        src={underworldVeil}
        alt="Abstract neon fog drifting through the Underworld tunnels"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
        loading="lazy"
      />
      <div className="relative mx-auto max-w-7xl space-y-10 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3" aria-label="Underworld breadcrumbs">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/city">City</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Underworld</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1">
              <Shield className="h-3.5 w-3.5" />
              Secure relay
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1">
              <Compass className="h-3.5 w-3.5" />
              Underworld map updated hourly
            </span>
          </div>
        </div>

        <section className="grid gap-8 rounded-3xl border border-primary/10 bg-background/70 p-8 shadow-xl backdrop-blur" id="hero">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-4 lg:max-w-2xl">
              <div className="flex items-center gap-3 text-sm text-primary">
                <Coins className="h-6 w-6" />
                <span className="font-semibold uppercase tracking-wide">Underworld Nexus</span>
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold leading-tight lg:text-5xl">Shadow market for off-ledger deals</h1>
                <p className="text-lg text-muted-foreground">
                  Exchange tokens, broker rare merch drops, and follow whispered routes that keep your band ahead of corporate scouts.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="gap-2" onClick={() => document.getElementById("market")?.scrollIntoView({ behavior: "smooth" })}>
                  <Coins className="h-4 w-4" />
                  Token Desk
                </Button>
                <Button size="lg" variant="outline" className="gap-2" onClick={() => document.getElementById("lore")?.scrollIntoView({ behavior: "smooth" })}>
                  <ArrowDownRight className="h-4 w-4" />
                  Explore Districts
                </Button>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Underworld section quick links">
                {heroLinks.map((link) => (
                  <AnchorLink key={link.href} href={link.href} label={link.label} />
                ))}
              </div>
            </div>
            <div className="w-full lg:max-w-sm">
              <Card className="border-primary/30 bg-primary/5 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Live intel
                  </CardTitle>
                  <CardDescription>Signals refreshed whenever a courier arrives.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {overviewMetrics.map((metric, idx) => (
                    <div key={metric.label} className={cn("rounded-xl border px-4 py-3", idx % 2 === 0 ? "border-primary/20 bg-primary/5" : "border-muted/60")}> 
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{metric.label}</span>
                        <span className="flex items-center gap-1 font-medium text-primary">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          refreshed
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <p className="text-2xl font-bold">{metric.value}</p>
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold", metric.isPositive ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>{metric.change}</span>
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Bring your own token wallet or use the house ledger for instant swaps.</p>
                    <p className="text-xs text-muted-foreground/80">Latency monitored; failsafe routes preloaded for accessibility devices.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>


        <section id="lore" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary" aria-hidden>
              <BookOpen className="h-5 w-5" />
            </div>
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
                      <span className="rounded-full bg-primary/10 p-2 text-primary" aria-hidden>
                        <Icon className="h-5 w-5" />
                      </span>
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

        <section id="market" className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-wide text-primary">Token desk</p>
              <h2 className="text-3xl font-semibold">Trade routes, charts, and liquidity</h2>
              <p className="text-muted-foreground">Choose a token to view its recent momentum and place simulated orders.</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              <span>Focus order preserved for keyboard navigation.</span>
            </div>
          </div>

          <Card className="border-primary/20 bg-background/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">Crypto Market</CardTitle>
              <CardDescription>Live token prices and trading volume</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tokensLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, idx) => (
                    <Skeleton key={idx} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">24h Change</TableHead>
                      <TableHead className="text-right">Volume</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataTokens.map((token) => {
                      const priceChange24h = token.price_history && token.price_history.length > 1
                        ? ((token.current_price - token.price_history[0].price) / token.price_history[0].price) * 100
                        : 0;
                      const isPositive = priceChange24h >= 0;

                      return (
                        <TableRow
                          key={token.symbol}
                          className="cursor-pointer transition hover:bg-primary/5"
                          onClick={() => setSelectedToken(token.symbol)}
                        >
                          <TableCell>
                            <div>
                              <div className="font-mono font-bold">{token.symbol}</div>
                              <div className="text-sm text-muted-foreground">{token.name}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatPrice(token.current_price)}</TableCell>
                          <TableCell className={cn("text-right font-medium", isPositive ? "text-success" : "text-destructive")}> 
                            {isPositive ? "+" : ""}
                            {priceChange24h.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatVolume(token.volume_24h || 0)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedToken(token.symbol); }}>
                              Trade
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {!tokensLoading && selectedTokenData && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedTokenData.name} ({selectedTokenData.symbol})</h3>
                      <p className="text-sm text-muted-foreground">{selectedTokenData.description || "No description available."}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedToken(null)}>Clear focus</Button>
                  </div>

                  {chartData.length > 0 && (
                    <ChartContainer config={{ price: { label: "Price", color: "hsl(var(--primary))" } }} className="h-64">
                      <AreaChart data={chartData} margin={{ left: 10, right: 10 }}>
                        <defs>
                          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="timestamp" tickFormatter={formatDate} stroke="hsl(var(--muted-foreground))" />
                        <YAxis domain={["dataMin - 5", "dataMax + 5"]} tickFormatter={(val) => `$${val}`} stroke="hsl(var(--muted-foreground))" />
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
                          <Input id="buy-quantity" type="number" inputMode="decimal" name="buy-quantity" placeholder="1" aria-describedby="buy-quantity-hint" />
                          <p id="buy-quantity-hint" className="mt-1 text-xs text-muted-foreground">Set your ideal fill size.</p>
                        </div>
                        <div>
                          <Label htmlFor="buy-price">Price per token</Label>
                          <Input id="buy-price" type="number" inputMode="decimal" name="buy-price" placeholder={formatPrice(selectedTokenData.current_price)} aria-describedby="buy-price-hint" />
                          <p id="buy-price-hint" className="mt-1 text-xs text-muted-foreground">Defaults to last traded price.</p>
                        </div>
                      </div>
                      <Button className="w-full">Place Buy Order</Button>
                    </TabsContent>
                    <TabsContent value="sell" className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="sell-quantity">Quantity</Label>
                          <Input id="sell-quantity" type="number" inputMode="decimal" name="sell-quantity" placeholder="1" aria-describedby="sell-quantity-hint" />
                          <p id="sell-quantity-hint" className="mt-1 text-xs text-muted-foreground">Offload partial stacks safely.</p>
                        </div>
                        <div>
                          <Label htmlFor="sell-price">Price per token</Label>
                          <Input id="sell-price" type="number" inputMode="decimal" name="sell-price" placeholder={formatPrice(selectedTokenData.current_price)} aria-describedby="sell-price-hint" />
                          <p id="sell-price-hint" className="mt-1 text-xs text-muted-foreground">Trail the bid to move faster.</p>
                        </div>
                      </div>
                      <Button className="w-full" variant="destructive">Place Sell Order</Button>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section id="merch" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary" aria-hidden>
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide text-primary">Curated merchandise</p>
              <h2 className="text-3xl font-semibold">Rare items available for trade</h2>
            </div>
          </div>
          <Card className="border-primary/20 bg-background/60">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mockMerchandise.map((item, idx) => (
                  <motion.div key={item.name} variants={sectionVariants} initial="initial" whileInView="animate" viewport={{ once: true, amount: 0.15 }}>
                    <Card className="overflow-hidden border-muted/60">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{item.name}</CardTitle>
                          <Badge className={rarityStyles[item.rarity].badge} variant={rarityStyles[item.rarity].variant}>
                            {item.rarity}
                          </Badge>
                        </div>
                        <CardDescription>{item.category}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">{item.lore}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Price</span>
                          <span className="font-mono font-semibold">{item.price}</span>
                        </div>
                        {item.availability && (
                          <Badge className={availabilityStyles[item.availability].badge} variant={availabilityStyles[item.availability].variant}>
                            {item.availability}
                          </Badge>
                        )}
                        <Button className="w-full" size="sm">
                          Reserve
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="actions" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary" aria-hidden>
              <MapPin className="h-5 w-5" />
            </div>
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
                      <span className="rounded-full bg-primary/10 p-2 text-primary" aria-hidden>
                        <Icon className="h-5 w-5" />
                      </span>
                      <CardTitle className="text-lg">{cta.title}</CardTitle>
                    </div>
                    <CardDescription>{cta.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild className="w-full" variant="outline">
                      <a href={cta.href}>Open link</a>
                    </Button>
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
