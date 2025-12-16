import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Radio, Music } from "lucide-react";

interface AirplaySong {
  id: string;
  title: string;
  artist: string;
  totalPlays: number;
  weeklyPlays: number;
  trend: "up" | "down" | "stable";
  trendChange: number;
  stations: number;
}

interface RadioAirplayChartProps {
  songs: AirplaySong[];
  title?: string;
}

export function RadioAirplayChart({ songs, title = "Airplay Chart" }: RadioAirplayChartProps) {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendBadge = (trend: string, change: number) => {
    if (trend === "up") {
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          +{change}
        </Badge>
      );
    }
    if (trend === "down") {
      return (
        <Badge variant="outline" className="text-red-600 border-red-600">
          -{change}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        —
      </Badge>
    );
  };

  if (songs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Track your songs' radio performance</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8 text-muted-foreground">
          <Radio className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No airplay data yet</p>
          <p className="text-sm">Submit songs to radio stations to start tracking</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Your songs ranked by airplay performance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {songs.map((song, index) => (
            <div
              key={song.id}
              className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
            >
              {/* Rank */}
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                {index + 1}
              </div>

              {/* Song Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Music className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">{song.title}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
              </div>

              {/* Stats */}
              <div className="text-right space-y-1">
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-sm font-medium">{song.totalPlays} plays</span>
                  {getTrendIcon(song.trend)}
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-xs text-muted-foreground">
                    {song.stations} stations
                  </span>
                  {getTrendBadge(song.trend, song.trendChange)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
