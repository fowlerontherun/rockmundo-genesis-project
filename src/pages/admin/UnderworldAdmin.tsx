import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Coins, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

const UnderworldAdmin = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newToken, setNewToken] = useState({
    symbol: "",
    name: "",
    current_price: 100,
    volume_24h: 100000,
    market_cap: 1000000,
    description: "",
  });

  const { data: tokens = [] } = useQuery({
    queryKey: ["admin-crypto-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crypto_tokens")
        .select("*")
        .order("market_cap", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createToken = useMutation({
    mutationFn: async (tokenData: typeof newToken) => {
      const { data, error } = await supabase
        .from("crypto_tokens")
        .insert([{
          ...tokenData,
          price_history: [],
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-crypto-tokens"] });
      toast({ title: "Crypto Token Created" });
      setDialogOpen(false);
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Coins className="h-8 w-8" />
            Underworld Administration
          </h1>
          <p className="text-muted-foreground">Manage crypto tokens and marketplace</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                  placeholder="e.g., BTC"
                  maxLength={5}
                />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={newToken.name}
                  onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                  placeholder="e.g., Bitcoin"
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

      <Tabs defaultValue="tokens">
        <TabsList>
          <TabsTrigger value="tokens">Crypto Tokens</TabsTrigger>
          <TabsTrigger value="stats">Market Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="tokens">
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
                  {tokens.map((token: any) => (
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid gap-4 md:grid-cols-3">
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
                <CardTitle className="text-sm">Total Market Cap</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  ${tokens.reduce((sum: number, t: any) => sum + (t.market_cap || 0), 0).toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">24h Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  ${tokens.reduce((sum: number, t: any) => sum + (t.volume_24h || 0), 0).toLocaleString()}
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
