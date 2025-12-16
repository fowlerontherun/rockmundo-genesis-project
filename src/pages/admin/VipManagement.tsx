import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Crown, Gift, Search, UserPlus, Trash2, Clock } from "lucide-react";
import { format } from "date-fns";
import { AdminRoute } from "@/components/AdminRoute";

interface VipSubscription {
  id: string;
  user_id: string;
  status: string;
  subscription_type: string;
  starts_at: string;
  expires_at: string;
  gift_message: string | null;
  created_at: string;
  player_username?: string | null;
  player_display_name?: string | null;
}

interface PlayerSearchResult {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
}

const VipManagement = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerSearchResult | null>(null);
  const [duration, setDuration] = useState("1");
  const [giftMessage, setGiftMessage] = useState("");

  // Fetch all VIP subscriptions with player info
  const { data: vipSubscriptions, isLoading: loadingSubscriptions } = useQuery({
    queryKey: ["admin-vip-subscriptions"],
    queryFn: async () => {
      // First get all VIP subscriptions
      const { data: subs, error: subsError } = await supabase
        .from("vip_subscriptions")
        .select("*")
        .order("created_at", { ascending: false });

      if (subsError) throw subsError;
      if (!subs) return [];

      // Get unique user IDs and fetch their profiles
      const userIds = [...new Set(subs.map(s => s.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, display_name")
        .in("user_id", userIds);

      // Map profiles to subscriptions
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return subs.map(sub => ({
        ...sub,
        player_username: profileMap.get(sub.user_id)?.username || null,
        player_display_name: profileMap.get(sub.user_id)?.display_name || null,
      })) as VipSubscription[];
    },
  });

  // Search players
  const { data: searchResults } = useQuery({
    queryKey: ["player-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, username, display_name")
        .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      return data as PlayerSearchResult[];
    },
    enabled: searchQuery.length >= 2,
  });

  // Grant VIP mutation
  const grantVipMutation = useMutation({
    mutationFn: async ({ userId, months, message }: { userId: string; months: number; message: string }) => {
      const startsAt = new Date();
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + months);

      const { error } = await supabase
        .from("vip_subscriptions")
        .insert({
          user_id: userId,
          status: "active",
          subscription_type: "gifted",
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          gift_message: message || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("VIP subscription granted successfully!");
      queryClient.invalidateQueries({ queryKey: ["admin-vip-subscriptions"] });
      setSelectedPlayer(null);
      setGiftMessage("");
      setDuration("1");
    },
    onError: (error) => {
      toast.error(`Failed to grant VIP: ${error.message}`);
    },
  });

  // Revoke VIP mutation
  const revokeVipMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const { error } = await supabase
        .from("vip_subscriptions")
        .update({ status: "cancelled" })
        .eq("id", subscriptionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("VIP subscription revoked");
      queryClient.invalidateQueries({ queryKey: ["admin-vip-subscriptions"] });
    },
    onError: (error) => {
      toast.error(`Failed to revoke VIP: ${error.message}`);
    },
  });

  const handleGrantVip = () => {
    if (!selectedPlayer) {
      toast.error("Please select a player");
      return;
    }
    grantVipMutation.mutate({
      userId: selectedPlayer.user_id,
      months: parseInt(duration),
      message: giftMessage,
    });
  };

  const activeSubscriptions = vipSubscriptions?.filter(s => s.status === "active") || [];
  const expiredSubscriptions = vipSubscriptions?.filter(s => s.status !== "active") || [];

  return (
    <AdminRoute>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8 text-yellow-500" />
          <div>
            <h1 className="text-3xl font-bold">VIP Management</h1>
            <p className="text-muted-foreground">Grant and manage VIP subscriptions</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active VIP Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeSubscriptions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Gifted Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {vipSubscriptions?.filter(s => s.subscription_type === "gifted").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Trial Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {vipSubscriptions?.filter(s => s.subscription_type === "trial").length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grant VIP Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Gift VIP Subscription
            </CardTitle>
            <CardDescription>Grant VIP status to a player</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Search Player</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {searchResults && searchResults.length > 0 && (
                  <div className="border rounded-md max-h-40 overflow-y-auto">
                    {searchResults.map((player) => (
                      <button
                        key={player.id}
                        className="w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between"
                        onClick={() => {
                          setSelectedPlayer(player);
                          setSearchQuery("");
                        }}
                      >
                        <span>{player.display_name || player.username || "Unknown"}</span>
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
                {selectedPlayer && (
                  <div className="flex items-center gap-2 p-2 bg-accent rounded-md">
                    <Crown className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">
                      {selectedPlayer.display_name || selectedPlayer.username}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPlayer(null)}
                      className="ml-auto h-6 w-6 p-0"
                    >
                      ×
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Month</SelectItem>
                    <SelectItem value="3">3 Months</SelectItem>
                    <SelectItem value="6">6 Months</SelectItem>
                    <SelectItem value="12">1 Year</SelectItem>
                    <SelectItem value="120">Lifetime (10 years)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Gift Message (optional)</Label>
              <Textarea
                placeholder="Add a personal message for the player..."
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                rows={2}
              />
            </div>

            <Button
              onClick={handleGrantVip}
              disabled={!selectedPlayer || grantVipMutation.isPending}
              className="w-full md:w-auto"
            >
              <Gift className="h-4 w-4 mr-2" />
              Grant VIP Subscription
            </Button>
          </CardContent>
        </Card>

        {/* Active Subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle>Active VIP Subscriptions</CardTitle>
            <CardDescription>Currently active VIP members</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSubscriptions ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : activeSubscriptions.length === 0 ? (
              <p className="text-muted-foreground">No active VIP subscriptions</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSubscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">
                        {sub.player_display_name || sub.player_username || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sub.subscription_type === "paid" ? "default" : "secondary"}>
                          {sub.subscription_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(sub.expires_at), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {sub.gift_message || "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeVipMutation.mutate(sub.id)}
                          disabled={revokeVipMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Expired/Cancelled Subscriptions */}
        {expiredSubscriptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Expired/Cancelled Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expired</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiredSubscriptions.slice(0, 10).map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">
                        {sub.player_display_name || sub.player_username || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sub.subscription_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{sub.status}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(sub.expires_at), "MMM d, yyyy")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminRoute>
  );
};

export default VipManagement;
