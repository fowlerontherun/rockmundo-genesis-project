import React from "react";
import { ArrowDownRight, ArrowUpRight, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
          <CardContent className="space-y-4">
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
                  return (
                    <TableRow key={token.symbol}>
                      <TableCell className="font-medium">{token.name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{token.symbol}</TableCell>
                      <TableCell className="text-right font-medium">{priceFormatter.format(token.price)}</TableCell>
                      <TableCell className={`text-right font-medium ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
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
