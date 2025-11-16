import React, { useEffect, useState } from "react";
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
import { useUnderworld } from "@/hooks/useUnderworld";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth-context";

interface MerchandiseItem {
  name: string;
  category: string;
  rarity: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";
  price: string;
  availability?: "In Stock" | "Limited" | "Restocking";
}

const mockMerchandise: MerchandiseItem[] = [
  { name: "Phantom Cloak", category: "Apparel", rarity: "Legendary", price: "2,500 SCL", availability: "Limited" },
  { name: "Gloom Resonator", category: "Instruments", rarity: "Epic", price: "1,150 GEM", availability: "In Stock" },
  { name: "Shadowbound Strings", category: "Accessories", rarity: "Rare", price: "780 OBL" },
  { name: "Eclipse Mix Console", category: "Production", rarity: "Epic", price: "1,450 GEM", availability: "In Stock" },
  { name: "Veil Fragment", category: "Collectibles", rarity: "Uncommon", price: "120 ASH" },
  { name: "Darkstage Pedal Board", category: "Accessories", rarity: "Rare", price: "890 OBL", availability: "Restocking" },
];

const overviewMetrics = [
  { label: "Total Market Cap", value: "$8.2B", change: "+12.4%", isPositive: true },
  { label: "24h Volume", value: "$412M", change: "-3.2%", isPositive: false },
  { label: "Active Tokens", value: "5", change: "—", isPositive: true },
];

const formatPrice = (price: number) => `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatVolume = (volume: number) => `$${(volume / 1_000_000).toFixed(2)}M`;
const formatDate = (date: string) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const formatDateTime = (date: string) =>
  new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

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

const Underworld = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { tokens, tokensLoading, holdings, holdingsLoading, transactions, transactionsLoading, placeOrder, placingOrder } = useUnderworld();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [buyQuantity, setBuyQuantity] = useState<string>("1");
  const [sellQuantity, setSellQuantity] = useState<string>("1");
  const [buyPrice, setBuyPrice] = useState<string>("");
  const [sellPrice, setSellPrice] = useState<string>("");

  const selectedTokenData = tokens.find((t) => t.symbol === selectedToken);
  const chartData = selectedTokenData?.price_history || [];

  useEffect(() => {
    if (!selectedToken && tokens.length > 0) {
      setSelectedToken(tokens[0].symbol);
    }
  }, [tokens, selectedToken]);

  const handleTrade = async (type: "buy" | "sell") => {
    if (!selectedTokenData) {
      toast({ title: "Select a token", description: "Choose a token from the market table before trading.", variant: "destructive" });
      return;
    }

    const quantityInput = type === "buy" ? buyQuantity : sellQuantity;
    const priceInput = type === "buy" ? buyPrice : sellPrice;
    const parsedQuantity = Number(quantityInput);
    const parsedPrice = priceInput ? Number(priceInput) : Number(selectedTokenData.current_price);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      toast({ title: "Invalid quantity", description: "Enter how many tokens you want to trade.", variant: "destructive" });
      return;
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast({ title: "Invalid price", description: "Enter a valid price per token.", variant: "destructive" });
      return;
    }

    try {
      await placeOrder({
        tokenId: selectedTokenData.id,
        quantity: parsedQuantity,
        pricePerToken: parsedPrice,
        type,
      });

      if (type === "buy") {
        setBuyQuantity("1");
        setBuyPrice("");
      } else {
        setSellQuantity("1");
        setSellPrice("");
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (tokensLoading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-stage p-6 space-y-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-2">
            <Coins className="h-10 w-10" />
            The Underworld
          </h1>
          <p className="text-muted-foreground">
            A shadow economy where crypto tokens fuel underground deals and rare merchandise.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {overviewMetrics.map((metric, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-2">
                <CardDescription>{metric.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">{metric.value}</div>
                  <div className={cn("text-sm font-medium flex items-center gap-1", metric.isPositive ? "text-success" : "text-destructive")}>
                    {metric.isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {metric.change}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Crypto Market</CardTitle>
            <CardDescription>Live token prices and trading volume</CardDescription>
          </CardHeader>
          <CardContent>
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
                {tokens.map((token) => {
                  const priceChange24h = token.price_history && token.price_history.length > 1
                    ? ((token.current_price - token.price_history[0].price) / token.price_history[0].price) * 100
                    : 0;
                  const isPositive = priceChange24h >= 0;

                  return (
                    <TableRow key={token.symbol} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedToken(token.symbol)}>
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

            {selectedToken && selectedTokenData && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{selectedTokenData.name} ({selectedTokenData.symbol})</h3>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedToken(null)}>Close</Button>
                </div>

                {chartData.length > 0 && (
                  <ChartContainer config={{ price: { label: "Price", color: "hsl(var(--primary))" } }} className="h-64">
                    <AreaChart data={chartData}>
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

                <Tabs defaultValue="buy">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="buy">Buy</TabsTrigger>
                    <TabsTrigger value="sell">Sell</TabsTrigger>
                  </TabsList>
                  <TabsContent value="buy" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="buy-quantity">Quantity</Label>
                        <Input id="buy-quantity" type="number" value={buyQuantity} onChange={(e) => setBuyQuantity(e.target.value)} placeholder="1" />
                      </div>
                      <div>
                        <Label htmlFor="buy-price">Price per token</Label>
                        <Input id="buy-price" type="number" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder={formatPrice(selectedTokenData.current_price)} />
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => handleTrade("buy")} disabled={placingOrder || !user}>
                      {user ? (placingOrder ? "Processing..." : "Place Buy Order") : "Sign in to trade"}
                    </Button>
                  </TabsContent>
                  <TabsContent value="sell" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="sell-quantity">Quantity</Label>
                        <Input id="sell-quantity" type="number" value={sellQuantity} onChange={(e) => setSellQuantity(e.target.value)} placeholder="1" />
                      </div>
                      <div>
                        <Label htmlFor="sell-price">Price per token</Label>
                        <Input id="sell-price" type="number" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder={formatPrice(selectedTokenData.current_price)} />
                      </div>
                    </div>
                    <Button className="w-full" variant="destructive" onClick={() => handleTrade("sell")} disabled={placingOrder || !user}>
                      {user ? (placingOrder ? "Processing..." : "Place Sell Order") : "Sign in to trade"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Holdings</CardTitle>
              <CardDescription>Track your positions across Underworld tokens</CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <p className="text-muted-foreground">Sign in to view and manage your holdings.</p>
              ) : holdingsLoading ? (
                <p className="text-muted-foreground">Loading holdings...</p>
              ) : holdings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Avg. Buy</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map((holding) => {
                      const currentPrice = holding.crypto_tokens?.current_price || 0;
                      const quantity = Number(holding.quantity || 0);
                      const totalValue = quantity * Number(currentPrice);

                      return (
                        <TableRow key={holding.id}>
                          <TableCell>
                            <div>
                              <div className="font-mono font-semibold">{holding.crypto_tokens?.symbol}</div>
                              <div className="text-sm text-muted-foreground">{holding.crypto_tokens?.name}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{quantity.toFixed(4)}</TableCell>
                          <TableCell className="text-right font-mono">${Number(holding.average_buy_price || 0).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">{formatPrice(totalValue)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">No holdings yet. Start trading to build your portfolio.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your latest moves inside the Underworld market</CardDescription>
            </CardHeader>
            <CardContent>
              {!user ? (
                <p className="text-muted-foreground">Sign in to review your trading activity.</p>
              ) : transactionsLoading ? (
                <p className="text-muted-foreground">Loading transactions...</p>
              ) : transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Token</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div className="font-mono font-semibold">{transaction.crypto_tokens?.symbol}</div>
                          <p className="text-sm text-muted-foreground">{transaction.crypto_tokens?.name}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={transaction.transaction_type === "buy" ? "default" : "secondary"}>{transaction.transaction_type.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{Number(transaction.quantity).toFixed(4)}</TableCell>
                        <TableCell className="text-right font-mono">${Number(transaction.price_per_token).toFixed(2)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{formatDateTime(transaction.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">No transactions yet. Your activity will appear here.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Curated Merchandise</CardTitle>
            <CardDescription>Rare items available for trade</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {mockMerchandise.map((item, idx) => (
                <Card key={idx} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <Badge className={rarityStyles[item.rarity].badge} variant={rarityStyles[item.rarity].variant}>
                        {item.rarity}
                      </Badge>
                    </div>
                    <CardDescription>{item.category}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Price</span>
                      <span className="font-mono font-semibold">{item.price}</span>
                    </div>
                    {item.availability && (
                      <Badge className={availabilityStyles[item.availability].badge} variant={availabilityStyles[item.availability].variant}>
                        {item.availability}
                      </Badge>
                    )}
                    <Button className="w-full" size="sm">Purchase</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Underworld;
