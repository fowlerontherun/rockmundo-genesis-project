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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Users, Search } from "lucide-react";
import { format } from "date-fns";

export default function PlayerManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: players = [], isLoading } = useQuery({
    queryKey: ["admin-players"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          band_members!inner(
            bands(name, genre)
          )
        `)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const updatePlayerMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: any }) => {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-players"] });
      toast({ title: "Player updated successfully" });
      setIsDialogOpen(false);
    },
  });

  const grantCashMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const player = players.find(p => p.user_id === userId);
      if (!player) throw new Error("Player not found");
      
      const { error } = await supabase
        .from("profiles")
        .update({ cash: (player.cash || 0) + amount })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-players"] });
      toast({ title: "Cash granted successfully" });
    },
  });

  const filteredPlayers = players.filter(player =>
    player.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.user_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGrantCash = (userId: string) => {
    const amount = prompt("Enter amount to grant:");
    if (amount && !isNaN(Number(amount))) {
      grantCashMutation.mutate({ userId, amount: Number(amount) });
    }
  };

  const handleUpdatePlayer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPlayer) return;

    const formData = new FormData(e.currentTarget);
    const updates = {
      cash: Number(formData.get("cash")),
      fame: Number(formData.get("fame")),
      level: Number(formData.get("level")),
      experience: Number(formData.get("experience")),
    };

    updatePlayerMutation.mutate({ userId: selectedPlayer.user_id, updates });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Player Management
          </h1>
          <p className="text-muted-foreground">View and manage player accounts</p>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Players</CardTitle>
          <CardDescription>{filteredPlayers.length} players found</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Cash</TableHead>
                <TableHead>Fame</TableHead>
                <TableHead>Band</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPlayers.map((player) => (
                <TableRow key={player.user_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{player.display_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{player.user_id}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge>Lvl {player.level || 1}</Badge>
                  </TableCell>
                  <TableCell>${player.cash || 0}</TableCell>
                  <TableCell>{player.fame || 0}</TableCell>
                  <TableCell>
                    {(player.band_members as any)?.[0]?.bands?.name || "No band"}
                  </TableCell>
                  <TableCell>
                    {player.created_at ? format(new Date(player.created_at), "MMM d, yyyy") : "N/A"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedPlayer(player);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleGrantCash(player.user_id)}
                      >
                        Grant Cash
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
            <DialogDescription>
              Modify player stats and resources
            </DialogDescription>
          </DialogHeader>

          {selectedPlayer && (
            <form onSubmit={handleUpdatePlayer} className="space-y-4">
              <div className="space-y-2">
                <Label>Player: {selectedPlayer.display_name}</Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cash">Cash</Label>
                  <Input
                    id="cash"
                    name="cash"
                    type="number"
                    defaultValue={selectedPlayer.cash || 0}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fame">Fame</Label>
                  <Input
                    id="fame"
                    name="fame"
                    type="number"
                    defaultValue={selectedPlayer.fame || 0}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="level">Level</Label>
                  <Input
                    id="level"
                    name="level"
                    type="number"
                    defaultValue={selectedPlayer.level || 1}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience">Experience</Label>
                  <Input
                    id="experience"
                    name="experience"
                    type="number"
                    defaultValue={selectedPlayer.experience || 0}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Player</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
