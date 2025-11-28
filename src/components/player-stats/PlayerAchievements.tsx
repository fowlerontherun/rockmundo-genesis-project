import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Award, Trophy, Star } from "lucide-react";

interface PlayerAchievementsProps {
  userId?: string;
}

export function PlayerAchievements({ userId }: PlayerAchievementsProps) {
  const { data: achievements, isLoading } = useQuery({
    queryKey: ["player-achievements", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("player_achievements")
        .select("*, achievement:achievements(*)")
        .eq("user_id", userId);

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: allAchievements } = useQuery({
    queryKey: ["all-achievements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .order("rarity", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Loading achievements...</p>
        </CardContent>
      </Card>
    );
  }

  const earnedIds = new Set(achievements?.map(a => a.achievement_id));
  const earnedAchievements = allAchievements?.filter(a => earnedIds.has(a.id)) || [];
  const lockedAchievements = allAchievements?.filter(a => !earnedIds.has(a.id)) || [];

  const rarityColor = (rarity: string | null) => {
    switch (rarity) {
      case "legendary": return "text-yellow-500";
      case "epic": return "text-purple-500";
      case "rare": return "text-blue-500";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Earned Achievements
            </CardTitle>
            <Badge variant="outline">{earnedAchievements.length} / {allAchievements?.length || 0}</Badge>
          </div>
          <Progress value={(earnedAchievements.length / (allAchievements?.length || 1)) * 100} className="mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {earnedAchievements.length > 0 ? (
            earnedAchievements.map((achievement) => (
              <div key={achievement.id} className="flex items-start gap-4 p-4 bg-accent/50 rounded-lg">
                <Award className={`h-8 w-8 ${rarityColor(achievement.rarity)}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{achievement.name}</h3>
                    {achievement.rarity && (
                      <Badge variant="secondary" className={rarityColor(achievement.rarity)}>
                        {achievement.rarity}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{achievement.description}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-8">No achievements earned yet. Keep playing!</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Locked Achievements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lockedAchievements.slice(0, 10).map((achievement) => (
            <div key={achievement.id} className="flex items-start gap-4 p-4 border rounded-lg opacity-60">
              <Award className="h-8 w-8 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{achievement.name}</h3>
                  {achievement.rarity && (
                    <Badge variant="outline">{achievement.rarity}</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{achievement.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
