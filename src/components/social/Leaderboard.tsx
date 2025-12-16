import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Music, Users } from "lucide-react";
import { ListItemSkeleton } from "@/components/ui/loading-skeletons";

interface LeaderboardEntry {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  fame: number;
  level: number;
}

const LeaderboardItem = ({ entry, rank }: { entry: LeaderboardEntry; rank: number }) => {
  const getRankIcon = () => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Trophy className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Trophy className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-mono w-5 text-center">{rank}</span>;
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="w-8 flex justify-center">{getRankIcon()}</div>
      <Avatar className="h-10 w-10">
        <AvatarImage src={entry.avatar_url || undefined} />
        <AvatarFallback>{(entry.display_name || entry.username)?.[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{entry.display_name || entry.username}</p>
        <p className="text-xs text-muted-foreground">Level {entry.level}</p>
      </div>
      <Badge variant="secondary" className="flex items-center gap-1">
        <Star className="h-3 w-3" />
        {entry.fame.toLocaleString()}
      </Badge>
    </div>
  );
};

export const Leaderboard = () => {
  const { data: fameLeaders, isLoading: loadingFame } = useQuery({
    queryKey: ["leaderboard", "fame"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, fame, level")
        .order("fame", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as LeaderboardEntry[];
    },
  });

  const { data: levelLeaders, isLoading: loadingLevel } = useQuery({
    queryKey: ["leaderboard", "level"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, fame, level")
        .order("level", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as LeaderboardEntry[];
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Leaderboards
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="fame">
          <TabsList className="w-full">
            <TabsTrigger value="fame" className="flex-1">
              <Star className="h-4 w-4 mr-1" />
              Fame
            </TabsTrigger>
            <TabsTrigger value="level" className="flex-1">
              <Music className="h-4 w-4 mr-1" />
              Level
            </TabsTrigger>
          </TabsList>
          <TabsContent value="fame" className="mt-4 space-y-1">
            {loadingFame ? (
              Array(5).fill(0).map((_, i) => <ListItemSkeleton key={i} />)
            ) : (
              fameLeaders?.map((entry, index) => (
                <LeaderboardItem key={entry.id} entry={entry} rank={index + 1} />
              ))
            )}
          </TabsContent>
          <TabsContent value="level" className="mt-4 space-y-1">
            {loadingLevel ? (
              Array(5).fill(0).map((_, i) => <ListItemSkeleton key={i} />)
            ) : (
              levelLeaders?.map((entry, index) => (
                <LeaderboardItem key={entry.id} entry={entry} rank={index + 1} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
