import React from "react";
import { ArrowDownRight, ArrowUpRight, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

interface TokenMarketRow {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: number;
}

interface MerchandiseItem {
  name: string;
  category: string;
  rarity: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
  price: string;
  availability?: "In Stock" | "Limited" | "Restocking";
}

const mockTokens: TokenMarketRow[] = [
  { symbol: "SCL", name: "SoulCoin Ledger", price: 1248.92, change24h: 3.6, volume: 2450000 },
  { symbol: "GEM", name: "Gloom Emerald", price: 482.17, change24h: -1.2, volume: 780000 },
  { symbol: "OBL", name: "Obsidian Link", price: 96.34, change24h: 5.4, volume: 195000 },
  { symbol: "ASH", name: "Ashen Token", price: 12.58, change24h: 0.8, volume: 3880000 },
  { symbol: "WSP", name: "Whisper Credit", price: 2.09, change24h: -4.1, volume: 665000 },
];

const tokenHistory: Record<string, { timestamp: string; price: number }[]> = {
  SCL: [
    { timestamp: "2024-03-01", price: 1188.21 },
    { timestamp: "2024-03-05", price: 1206.64 },
    { timestamp: "2024-03-09", price: 1231.48 },
    { timestamp: "2024-03-13", price: 1222.19 },
    { timestamp: "2024-03-17", price: 1245.92 },
    { timestamp: "2024-03-21", price: 1260.41 },
    { timestamp: "2024-03-25", price: 1254.78 },
  ],
  GEM: [
    { timestamp: "2024-03-01", price: 468.35 },
    { timestamp: "2024-03-05", price: 472.91 },
    { timestamp: "2024-03-09", price: 479.64 },
    { timestamp: "2024-03-13", price: 488.12 },
    { timestamp: "2024-03-17", price: 481.23 },
    { timestamp: "2024-03-21", price: 475.88 },
    { timestamp: "2024-03-25", price: 482.17 },
  ],
  OBL: [
    { timestamp: "2024-03-01", price: 88.19 },
    { timestamp: "2024-03-05", price: 90.74 },
    { timestamp: "2024-03-09", price: 92.16 },
    { timestamp: "2024-03-13", price: 94.83 },
    { timestamp: "2024-03-17", price: 95.42 },
    { timestamp: "2024-03-21", price: 97.03 },
    { timestamp: "2024-03-25", price: 96.34 },
  ],
  ASH: [
    { timestamp: "2024-03-01", price: 11.42 },
    { timestamp: "2024-03-05", price: 11.63 },
    { timestamp: "2024-03-09", price: 11.95 },
    { timestamp: "2024-03-13", price: 12.07 },
    { timestamp: "2024-03-17", price: 12.26 },
    { timestamp: "2024-03-21", price: 12.44 },
    { timestamp: "2024-03-25", price: 12.58 },
  ],
  WSP: [
    { timestamp: "2024-03-01", price: 1.94 },
    { timestamp: "2024-03-05", price: 1.99 },
    { timestamp: "2024-03-09", price: 2.05 },
    { timestamp: "2024-03-13", price: 2.12 },
    { timestamp: "2024-03-17", price: 2.18 },
    { timestamp: "2024-03-21", price: 2.13 },
    { timestamp: "2024-03-25", price: 2.09 },
  ],
};

const mockMerchandise: MerchandiseItem[] = [
  {
    name: "Phantom Cloak",
    category: "Apparel",
    rarity: "Legendary",
    price: "2,500 SCL",
    availability: "Limited",
  },
  {
    name: "Gloom Resonator",
    category: "Instruments",
    rarity: "Epic",
    price: "1,150 GEM",
    availability: "In Stock",
  },
  {
    name: "Shadowbound Strings",
    category: "Accessories",
    rarity: "Rare",
    price: "780 OBL",
  },
  {
    name: "Eclipse Mix Console",
    category: "Production",
    rarity: "Epic",
    price: "3,950 ASH",
    availability: "Restocking",
  },
  {
    name: "Spectral Amp",
    category: "Gear",
    rarity: "Uncommon",
    price: "520 WSP",
    availability: "In Stock",
  },
];

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const volumeFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const overviewMetrics = [
  { label: "Market Cap", value: "$8.2B", change: 2.4 },
  { label: "Active Traders", value: "38.4K", change: 5.1 },
  { label: "Artifacts Listed", value: "612", change: -1.8 },
  { label: "Vault Liquidity", value: "$1.6B", change: 0.9 },
];

const rarityBadgeStyles: Record<MerchandiseItem["rarity"], string> = {
  Common: "border-muted text-muted-foreground",
  Uncommon: "border-emerald-500/40 text-emerald-500",
  Rare: "border-sky-500/40 text-sky-500",
  Epic: "border-fuchsia-500/40 text-fuchsia-500",
  Legendary: "border-amber-500/40 text-amber-500",
};

const availabilityBadgeVariant: Record<NonNullable<MerchandiseItem["availability"]>, "default" | "secondary" | "destructive" | "outline"> = {
  "In Stock": "secondary",
  Limited: "default",
  Restocking: "outline",
};

const Underworld: React.FC = () => {
  const [selectedToken, setSelectedToken] = React.useState<TokenMarketRow>(mockTokens[0]);
  const [buyQuantity, setBuyQuantity] = React.useState("1");
  const [buyPrice, setBuyPrice] = React.useState(mockTokens[0].price.toFixed(2));
  const [sellQuantity, setSellQuantity] = React.useState("1");
  const [sellPrice, setSellPrice] = React.useState(mockTokens[0].price.toFixed(2));

  const selectedTokenHistory = React.useMemo(
    () => tokenHistory[selectedToken.symbol] ?? [],
    [selectedToken.symbol],
  );
  const latestPrice = selectedTokenHistory[selectedTokenHistory.length - 1]?.price ?? selectedToken.price;
  const gradientId = React.useMemo(
    () => `gradient-${selectedToken.symbol.toLowerCase()}`,
    [selectedToken.symbol],
  );
  const chartConfig = React.useMemo(
    () => ({
      price: {
        label: `${selectedToken.symbol} price`,
        color: "hsl(var(--chart-1))",
      },
    }),
    [selectedToken.symbol],
  );

  React.useEffect(() => {
    setBuyPrice(latestPrice.toFixed(2));
    setSellPrice(latestPrice.toFixed(2));
    setBuyQuantity("1");
    setSellQuantity("1");
  }, [latestPrice, selectedToken.symbol]);

  const safeNumber = React.useCallback((value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }, []);

  const buyTotal = safeNumber(buyQuantity) * safeNumber(buyPrice);
  const sellTotal = safeNumber(sellQuantity) * safeNumber(sellPrice);

  return (
    <div className="container mx-auto space-y-8 p-6">
      <section className="space-y-4">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-3 text-primary">
              <Coins className="h-6 w-6" />
              <Badge variant="outline" className="border-primary/40 text-primary">
                New Frontier
              </Badge>
            </div>
            <CardTitle className="text-3xl font-bold">Underworld Nexus</CardTitle>
            <CardDescription className="max-w-2xl text-base">
              Explore the hidden economy that powers Rockmundo&apos;s underground scene. Monitor market sentiment, trade
              exclusive tokens, and secure rare gear before it reaches the surface.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {overviewMetrics.map((metric) => {
              const trendColor = metric.change >= 0 ? "text-emerald-500" : "text-red-500";
              const changePrefix = metric.change >= 0 ? "+" : "";
              return (
                <div key={metric.label} className="rounded-lg border border-primary/10 bg-background/60 p-4 shadow-sm">
                  <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
                  <p className={`mt-1 text-xs font-medium ${trendColor}`}>
                    {changePrefix}
                    {metric.change.toFixed(1)}% today
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Crypto Market</CardTitle>
            <CardDescription>Live sentiment snapshots from the shadow exchange.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.6fr,1fr]">
              <div className="overflow-hidden rounded-lg border border-muted/40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead className="hidden sm:table-cell">Symbol</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">24h Change</TableHead>
                      <TableHead className="hidden md:table-cell text-right">Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockTokens.map((token) => {
                      const isPositive = token.change24h >= 0;
                      const isSelected = token.symbol === selectedToken.symbol;
                      return (
                        <TableRow
                          key={token.symbol}
                          tabIndex={0}
                          aria-selected={isSelected}
                          className={cn(
                            "cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
                            isSelected ? "bg-muted/60" : "hover:bg-muted/50",
                          )}
                          onClick={() => setSelectedToken(token)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedToken(token);
                            }
                          }}
                        >
                          <TableCell className="font-medium">{token.name}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground">{token.symbol}</TableCell>
                          <TableCell className="text-right font-medium">{priceFormatter.format(token.price)}</TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-medium",
                              isPositive ? "text-emerald-500" : "text-red-500",
                            )}
                          >
                            <span className="inline-flex items-center justify-end gap-1">
                              {isPositive ? (
                                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
                              )}
                              {Math.abs(token.change24h).toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-right text-muted-foreground">
                            {volumeFormatter.format(token.volume)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-6">
                <section className="rounded-lg border border-muted/40 bg-background/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Market movement</p>
                      <h3 className="text-lg font-semibold">{selectedToken.name}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-muted-foreground">Last price</p>
                      <p className="text-xl font-semibold">{priceFormatter.format(latestPrice)}</p>
                    </div>
                  </div>
                  <div className="mt-4 h-48 sm:h-56">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                      <AreaChart data={selectedTokenHistory} margin={{ left: -20, right: 0, top: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-price)" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="var(--color-price)" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="timestamp"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                          tickFormatter={(value) => dateFormatter.format(new Date(String(value)))}
                          minTickGap={16}
                        />
                        <YAxis
                          dataKey="price"
                          tickLine={false}
                          axisLine={false}
                          width={72}
                          tickFormatter={(value) => priceFormatter.format(Number(value))}
                          domain={["dataMin", "dataMax"]}
                        />
                        <ChartTooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={
                            <ChartTooltipContent
                              formatter={(value) => [
                                priceFormatter.format(typeof value === "number" ? value : Number(value)),
                                `${selectedToken.symbol} price`,
                              ]}
                              labelFormatter={(value) => dateFormatter.format(new Date(String(value)))}
                            />
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="price"
                          stroke="var(--color-price)"
                          strokeWidth={2}
                          fill={`url(#${gradientId})`}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </AreaChart>
                    </ChartContainer>
                  </div>
                </section>

                <section className="rounded-lg border border-muted/40 bg-background/60 p-4">
                  <Tabs defaultValue="buy" className="w-full">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Trade {selectedToken.symbol}</p>
                        <h3 className="text-lg font-semibold">{selectedToken.name}</h3>
                      </div>
                      <TabsList className="grid w-full max-w-[240px] grid-cols-2">
                        <TabsTrigger value="buy">Buy</TabsTrigger>
                        <TabsTrigger value="sell">Sell</TabsTrigger>
                      </TabsList>
                    </div>
                    <TabsContent value="buy" className="mt-4 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`buy-quantity-${selectedToken.symbol}`}>Quantity</Label>
                          <Input
                            id={`buy-quantity-${selectedToken.symbol}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={buyQuantity}
                            onChange={(event) => setBuyQuantity(event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`buy-price-${selectedToken.symbol}`}>Price (USD)</Label>
                          <Input
                            id={`buy-price-${selectedToken.symbol}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={buyPrice}
                            onChange={(event) => setBuyPrice(event.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">Estimated total</p>
                        <p className="font-mono text-base font-semibold">{priceFormatter.format(buyTotal)}</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button className="w-full sm:flex-1">Execute Buy</Button>
                        <Button variant="outline" className="w-full sm:flex-1">
                          Add to Watchlist
                        </Button>
                      </div>
                    </TabsContent>
                    <TabsContent value="sell" className="mt-4 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`sell-quantity-${selectedToken.symbol}`}>Quantity</Label>
                          <Input
                            id={`sell-quantity-${selectedToken.symbol}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={sellQuantity}
                            onChange={(event) => setSellQuantity(event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`sell-price-${selectedToken.symbol}`}>Price (USD)</Label>
                          <Input
                            id={`sell-price-${selectedToken.symbol}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={sellPrice}
                            onChange={(event) => setSellPrice(event.target.value)}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">Estimated total</p>
                        <p className="font-mono text-base font-semibold">{priceFormatter.format(sellTotal)}</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button variant="destructive" className="w-full sm:flex-1">
                          Execute Sell
                        </Button>
                        <Button variant="outline" className="w-full sm:flex-1">
                          Set Price Alert
                        </Button>
                      </div>
                    </TabsContent>
                  </Tabs>
                </section>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Underworld Store</CardTitle>
            <CardDescription>Curated artifacts for the daring performer.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {mockMerchandise.map((item) => (
                <Card key={item.name} className="border-dashed border-primary/20 bg-background/80 shadow-sm">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{item.name}</CardTitle>
                      <Badge variant="outline" className={rarityBadgeStyles[item.rarity]}>
                        {item.rarity}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm text-muted-foreground">{item.category}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">Starting at</p>
                    <p className="text-2xl font-semibold">{item.price}</p>
                    {item.availability ? (
                      <Badge variant={availabilityBadgeVariant[item.availability]}>{item.availability}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Special order
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Underworld;
