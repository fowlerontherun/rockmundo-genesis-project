import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AdminRoute } from "@/components/AdminRoute";
import { Star, Users, Search, Gift, Music, User, DollarSign } from "lucide-react";

export default function FameFansGifting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [bandSearch, setBandSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedBand, setSelectedBand] = useState<any>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [giftType, setGiftType] = useState<"band" | "player">("band");

  // Fetch bands
  const { data: bands = [], isLoading: bandsLoading } = useQuery({
    queryKey: ["admin-bands-fame"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bands")
        .select("id, name, genre, fame, total_fans, casual_fans, dedicated_fans, superfans, band_balance, status")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch players
  const { data: players = [], isLoading: playersLoading } = useQuery({
    queryKey: ["admin-players-fame"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, display_name, username, fame, fans, level")
        .order("display_name");
      if (error) throw error;
      return data;
    },
  });

  // Grant fame/fans to band
  const grantToBandMutation = useMutation({
    mutationFn: async ({ bandId, fame, fans, money, reason }: { bandId: string; fame: number; fans: number; money: number; reason: string }) => {
      const band = bands.find(b => b.id === bandId);
      if (!band) throw new Error("Band not found");

      const updates: any = {};
      if (fame > 0) updates.fame = (band.fame || 0) + fame;
      if (fans > 0) {
        updates.total_fans = (band.total_fans || 0) + fans;
        updates.casual_fans = (band.casual_fans || 0) + Math.floor(fans * 0.6);
        updates.dedicated_fans = (band.dedicated_fans || 0) + Math.floor(fans * 0.3);
        updates.superfans = (band.superfans || 0) + Math.floor(fans * 0.1);
      }
      if (money > 0) updates.band_balance = (band.band_balance || 0) + money;

      const { error } = await supabase.from("bands").update(updates).eq("id", bandId);
      if (error) throw error;

      // Log the gift in band_fame_events
      if (fame > 0) {
        await supabase.from("band_fame_events").insert({
          band_id: bandId,
          event_type: "admin_grant",
          fame_gained: fame,
          event_data: { reason, fans_granted: fans, money_granted: money },
        });
      }

      // Log money gift as band_earnings
      if (money > 0) {
        await supabase.from("band_earnings").insert({
          band_id: bandId,
          amount: money,
          source: "leader_deposit",
          description: `Admin grant: ${reason}`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-bands-fame"] });
      toast({ title: "Fame/Fans/Money granted to band successfully" });
      setGiftDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to grant", description: error.message, variant: "destructive" });
    },
  });

  // Grant fame/fans to player
  const grantToPlayerMutation = useMutation({
    mutationFn: async ({ userId, fame, fans, reason }: { userId: string; fame: number; fans: number; reason: string }) => {
      const player = players.find(p => p.user_id === userId);
      if (!player) throw new Error("Player not found");

      const updates: any = {};
      if (fame > 0) updates.fame = (player.fame || 0) + fame;
      if (fans > 0) updates.fans = (player.fans || 0) + fans;

      const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-players-fame"] });
      toast({ title: "Fame/Fans granted to player successfully" });
      setGiftDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to grant", description: error.message, variant: "destructive" });
    },
  });

  const filteredBands = bands.filter(band =>
    band.name?.toLowerCase().includes(bandSearch.toLowerCase())
  );

  const filteredPlayers = players.filter(player =>
    player.display_name?.toLowerCase().includes(playerSearch.toLowerCase()) ||
    player.username?.toLowerCase().includes(playerSearch.toLowerCase())
  );

  const handleGiftSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const fame = Number(formData.get("fame")) || 0;
    const fans = Number(formData.get("fans")) || 0;
    const money = Number(formData.get("money")) || 0;
    const reason = formData.get("reason") as string || "Admin grant";

    if (fame === 0 && fans === 0 && money === 0) {
      toast({ title: "Please enter at least one value", variant: "destructive" });
      return;
    }

    if (giftType === "band" && selectedBand) {
      grantToBandMutation.mutate({ bandId: selectedBand.id, fame, fans, money, reason });
    } else if (giftType === "player" && selectedPlayer) {
      grantToPlayerMutation.mutate({ userId: selectedPlayer.user_id, fame, fans, reason });
    }
  };

  return (
    <AdminRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Star className="h-8 w-8" />
              Fame & Fans Gifting
            </h1>
            <p className="text-muted-foreground">Gift fame and fans to bands or players</p>
          </div>
        </div>

        <Tabs defaultValue="bands" className="space-y-4">
          <TabsList>
            <TabsTrigger value="bands" className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              Bands
            </TabsTrigger>
            <TabsTrigger value="players" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Players
            </TabsTrigger>
          </TabsList>

          {/* Bands Tab */}
          <TabsContent value="bands" className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search bands..."
                  value={bandSearch}
                  onChange={(e) => setBandSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Bands</CardTitle>
                <CardDescription>{filteredBands.length} bands found</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Band</TableHead>
                      <TableHead>Genre</TableHead>
                      <TableHead>Fame</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Total Fans</TableHead>
                      <TableHead>Fan Breakdown</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBands.map((band) => (
                      <TableRow key={band.id}>
                        <TableCell className="font-medium">{band.name}</TableCell>
                        <TableCell>{band.genre || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{band.fame || 0}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">${(band.band_balance || 0).toLocaleString()}</Badge>
                        </TableCell>
                        <TableCell>{band.total_fans || 0}</TableCell>
                        <TableCell>
                          <div className="text-xs text-muted-foreground">
                            C: {band.casual_fans || 0} | D: {band.dedicated_fans || 0} | S: {band.superfans || 0}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={band.status === "active" ? "default" : "outline"}>
                            {band.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedBand(band);
                              setGiftType("band");
                              setGiftDialogOpen(true);
                            }}
                          >
                            <Gift className="h-4 w-4 mr-1" />
                            Gift
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Players Tab */}
          <TabsContent value="players" className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players..."
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Players</CardTitle>
                <CardDescription>{filteredPlayers.length} players found</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Fame</TableHead>
                      <TableHead>Fans</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlayers.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{player.display_name || player.username || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">@{player.username}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge>Lvl {player.level || 1}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{player.fame || 0}</Badge>
                        </TableCell>
                        <TableCell>{player.fans || 0}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedPlayer(player);
                              setGiftType("player");
                              setGiftDialogOpen(true);
                            }}
                          >
                            <Gift className="h-4 w-4 mr-1" />
                            Gift
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Gift Dialog */}
        <Dialog open={giftDialogOpen} onOpenChange={setGiftDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Gift to {giftType === "band" ? selectedBand?.name : selectedPlayer?.display_name}
              </DialogTitle>
              <DialogDescription>
                Enter the amount of fame, fans{giftType === "band" ? ", and/or money" : ""} to grant
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleGiftSubmit} className="space-y-4">
              <div className={`grid gap-4 ${giftType === "band" ? "grid-cols-3" : "grid-cols-2"}`}>
                <div className="space-y-2">
                  <Label htmlFor="fame">Fame</Label>
                  <Input
                    id="fame"
                    name="fame"
                    type="number"
                    min="0"
                    placeholder="0"
                    defaultValue=""
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fans">Fans</Label>
                  <Input
                    id="fans"
                    name="fans"
                    type="number"
                    min="0"
                    placeholder="0"
                    defaultValue=""
                  />
                </div>
                {giftType === "band" && (
                  <div className="space-y-2">
                    <Label htmlFor="money">Money ($)</Label>
                    <Input
                      id="money"
                      name="money"
                      type="number"
                      min="0"
                      placeholder="0"
                      defaultValue=""
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  placeholder="Admin grant, promotional event, etc."
                  rows={2}
                />
              </div>

              {giftType === "band" && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium mb-1">Fan Distribution</p>
                  <p className="text-muted-foreground">
                    Fans will be distributed as: 60% Casual, 30% Dedicated, 10% Superfans
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setGiftDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={grantToBandMutation.isPending || grantToPlayerMutation.isPending}>
                  <Gift className="h-4 w-4 mr-2" />
                  Grant
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminRoute>
  );
}
