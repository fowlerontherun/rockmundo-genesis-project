import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TwaaterAccountCard } from "./TwaaterAccountCard";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface TwaaterSearchProps {
  currentAccountId: string;
}

export const TwaaterSearch = ({ currentAccountId }: TwaaterSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: results, isLoading } = useQuery({
    queryKey: ["twaater-search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];

      const query = searchQuery.toLowerCase().replace('@', '');
      
      const { data, error } = await supabase
        .from("twaater_accounts")
        .select("*")
        .or(`handle.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq('id', currentAccountId)
        .order('fame_score', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: searchQuery.length >= 2,
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search @handle or display name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {searchQuery.length >= 2 && (
        <Card>
          <CardContent className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : results && results.length > 0 ? (
              <div className="space-y-3">
                {results.map((account) => (
                  <TwaaterAccountCard
                    key={account.id}
                    account={account}
                    currentAccountId={currentAccountId}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No accounts found
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
