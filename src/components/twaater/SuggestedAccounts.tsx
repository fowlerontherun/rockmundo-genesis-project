import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TwaaterAccountCard } from "./TwaaterAccountCard";
import { Loader2 } from "lucide-react";

interface SuggestedAccountsProps {
  accountId: string;
}

export const SuggestedAccounts = ({ accountId }: SuggestedAccountsProps) => {
  const { data: suggestions, isLoading } = useQuery({
    queryKey: ["twaater-suggestions", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("twaater_suggested_follows")
        .select(`
          suggested_account_id,
          reason,
          score,
          account:twaater_accounts!twaater_suggested_follows_suggested_account_id_fkey(
            id,
            handle,
            display_name,
            owner_type,
            verified,
            fame_score,
            follower_count
          )
        `)
        .eq("account_id", accountId)
        .order("score", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!suggestions || suggestions.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Who to follow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((suggestion: any) => (
          <TwaaterAccountCard
            key={suggestion.suggested_account_id}
            account={suggestion.account}
            currentAccountId={accountId}
          />
        ))}
      </CardContent>
    </Card>
  );
};
