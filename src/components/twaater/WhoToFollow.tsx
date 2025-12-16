import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, BadgeCheck, Users } from "lucide-react";

interface WhoToFollowProps {
  currentAccountId: string;
}

export const WhoToFollow = ({ currentAccountId }: WhoToFollowProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch suggested accounts to follow
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["twaater-suggestions", currentAccountId],
    queryFn: async () => {
      // Get accounts we're already following
      const { data: following } = await supabase
        .from("twaater_follows")
        .select("followed_account_id")
        .eq("follower_account_id", currentAccountId);

      const followedIds = following?.map(f => f.followed_account_id) || [];

      // Get popular accounts we're not following
      const { data: accounts, error } = await supabase
        .from("twaater_accounts")
        .select("id, handle, display_name, verified, follower_count")
        .neq("id", currentAccountId)
        .order("follower_count", { ascending: false })
        .limit(10);

      if (error) throw error;
      
      // Filter out already followed accounts client-side
      return accounts?.filter(a => !followedIds.includes(a.id)).slice(0, 5) || [];
    },
    enabled: !!currentAccountId,
  });

  const followMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase.from("twaater_follows").insert({
        follower_account_id: currentAccountId,
        followed_account_id: accountId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-feed"] });
      toast({ title: "Followed!" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to follow", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Who to Follow
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!suggestions?.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Who to Follow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((account) => (
          <div key={account.id} className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{(account.display_name || account.handle)?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-medium text-sm truncate">{account.display_name || account.handle}</span>
                {account.verified && (
                  <BadgeCheck className="h-3 w-3 text-[hsl(var(--twaater-purple))]" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">@{account.handle}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => followMutation.mutate(account.id)}
              disabled={followMutation.isPending}
            >
              <UserPlus className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
