import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Users, AtSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TwaaterAccountCard } from "./TwaaterAccountCard";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface TwaaterSearchProps {
  currentAccountId: string;
}

export const TwaaterSearch = ({ currentAccountId }: TwaaterSearchProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Search Twaater accounts
  const { data: accountResults, isLoading: accountsLoading } = useQuery({
    queryKey: ["twaater-search-accounts", searchQuery],
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

  // Search Players (profiles)
  const { data: playerResults, isLoading: playersLoading } = useQuery({
    queryKey: ["twaater-search-players", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const query = searchQuery.toLowerCase();
      
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, username, display_name, avatar_url, fame, level")
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .order('fame', { ascending: false })
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
          placeholder="Search accounts or players..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          style={{ backgroundColor: "hsl(var(--twaater-card))", borderColor: "hsl(var(--twaater-border))" }}
        />
      </div>

      {searchQuery.length >= 2 && (
        <Tabs defaultValue="accounts" className="w-full">
          <TabsList className="grid w-full grid-cols-2" style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
            <TabsTrigger value="accounts" className="gap-1 data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">
              <AtSign className="h-4 w-4" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="players" className="gap-1 data-[state=active]:bg-[hsl(var(--twaater-purple)_/_0.2)] data-[state=active]:text-[hsl(var(--twaater-purple))]">
              <Users className="h-4 w-4" />
              Players
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts">
            <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
              <CardContent className="p-4">
                {accountsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--twaater-purple))]" />
                  </div>
                ) : accountResults && accountResults.length > 0 ? (
                  <div className="space-y-3">
                    {accountResults.map((account) => (
                      <TwaaterAccountCard
                        key={account.id}
                        account={account}
                        currentAccountId={currentAccountId}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No accounts found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="players">
            <Card style={{ backgroundColor: "hsl(var(--twaater-card))" }}>
              <CardContent className="p-4">
                {playersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--twaater-purple))]" />
                  </div>
                ) : playerResults && playerResults.length > 0 ? (
                  <div className="space-y-3">
                    {playerResults.map((player) => (
                      <div
                        key={player.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-[hsl(var(--twaater-purple)_/_0.1)] cursor-pointer transition-colors"
                        onClick={() => navigate(`/player/${player.username}`)}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={player.avatar_url || undefined} />
                          <AvatarFallback className="bg-[hsl(var(--twaater-purple)_/_0.2)] text-[hsl(var(--twaater-purple))]">
                            {player.display_name?.[0] || player.username?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{player.display_name || player.username}</span>
                            {player.level && player.level > 10 && (
                              <Badge variant="outline" className="text-xs border-[hsl(var(--twaater-purple))] text-[hsl(var(--twaater-purple))]">
                                Lv.{player.level}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">@{player.username}</p>
                        </div>
                        {player.fame > 0 && (
                          <span className="text-xs text-muted-foreground">{player.fame.toLocaleString()} fame</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No players found</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};
