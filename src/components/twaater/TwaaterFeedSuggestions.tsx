import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, UserPlus, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface TwaaterFeedSuggestionsProps {
  currentAccountId: string;
  onDismiss?: () => void;
}

export const TwaaterFeedSuggestions = ({ currentAccountId, onDismiss }: TwaaterFeedSuggestionsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch suggested accounts to follow
  const { data: suggestions } = useQuery({
    queryKey: ["twaater-feed-suggestions", currentAccountId],
    queryFn: async () => {
      // Get accounts the user already follows
      const { data: following } = await supabase
        .from("twaater_follows")
        .select("followed_account_id")
        .eq("follower_account_id", currentAccountId);

      const followingIds = following?.map(f => f.followed_account_id) || [];
      followingIds.push(currentAccountId); // Exclude self

      // Get popular accounts not already followed
      const { data: accounts, error } = await supabase
        .from("twaater_accounts")
        .select("id, handle, display_name, verified, owner_type, fame_score")
        .not("id", "in", `(${followingIds.join(",")})`)
        .order("fame_score", { ascending: false })
        .limit(5);

      if (error) throw error;
      return accounts || [];
    },
    enabled: !!currentAccountId,
    staleTime: 5 * 60 * 1000,
  });

  const followMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from("twaater_follows")
        .insert({
          follower_account_id: currentAccountId,
          followed_account_id: accountId,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["twaater-feed-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["twaater-follower-count"] });
      toast({ title: "Followed!", description: "You're now following this account." });
    },
  });

  if (!suggestions?.length) return null;

  return (
    <Card className="my-4 mx-2" style={{ backgroundColor: "hsl(var(--twaater-card))", borderColor: "hsl(var(--twaater-border))" }}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[hsl(var(--twaater-purple))]" />
          Suggested for you
        </CardTitle>
        {onDismiss && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDismiss}>
            <X className="h-3 w-3" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {suggestions.slice(0, 3).map((account) => (
          <div key={account.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]">
                  {account.display_name?.charAt(0)?.toUpperCase() || "@"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium truncate">{account.display_name}</span>
                  {account.verified && (
                    <CheckCircle2 className="h-3 w-3 text-[hsl(var(--twaater-purple))] flex-shrink-0" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">@{account.handle}</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => followMutation.mutate(account.id)}
              disabled={followMutation.isPending}
              className="border-[hsl(var(--twaater-purple))] text-[hsl(var(--twaater-purple))] hover:bg-[hsl(var(--twaater-purple)_/_0.1)] text-xs px-2 h-7"
            >
              Follow
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
