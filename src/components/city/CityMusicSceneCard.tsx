import { Music, Mic2, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface CityMusicSceneCardProps {
  musicScene: number;
  dominantGenre: string | null;
  localBonus: number | null;
  venueCount: number;
  playerCount: number;
}

const getSceneDescription = (score: number) => {
  if (score >= 90) return "World-renowned music capital";
  if (score >= 75) return "Thriving music hub";
  if (score >= 60) return "Active music scene";
  if (score >= 40) return "Growing music community";
  if (score >= 20) return "Emerging scene";
  return "Developing music culture";
};

const getSceneColor = (score: number) => {
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-muted-foreground";
};

export const CityMusicSceneCard = ({
  musicScene,
  dominantGenre,
  localBonus,
  venueCount,
  playerCount,
}: CityMusicSceneCardProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5 text-primary" />
          Local Music Scene
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Scene Rating</span>
            <span className={`font-bold text-lg ${getSceneColor(musicScene)}`}>
              {musicScene}%
            </span>
          </div>
          <Progress value={musicScene} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {getSceneDescription(musicScene)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {dominantGenre && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
              <Mic2 className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Dominant Genre</p>
                <p className="text-sm font-medium truncate">{dominantGenre}</p>
              </div>
            </div>
          )}

          {localBonus !== null && localBonus > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <div>
                <p className="text-xs text-muted-foreground">Local Bonus</p>
                <p className="text-sm font-medium text-green-600">+{localBonus}%</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
            <Music className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Venues</p>
              <p className="text-sm font-medium">{venueCount}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Players Here</p>
              <p className="text-sm font-medium">{playerCount}</p>
            </div>
          </div>
        </div>

        {musicScene >= 70 && (
          <Badge variant="secondary" className="w-full justify-center">
            🎸 Great place to build a fanbase!
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};
