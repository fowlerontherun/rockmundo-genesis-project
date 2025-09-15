import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  Trophy, 
  Music, 
  Users, 
  Calendar,
  Star,
  Play,
  Crown,
  Award,
  Zap
} from "lucide-react";

interface ChartEntry {
  rank: number;
  title: string;
  artist: string;
  band: string;
  genre: string;
  plays: number;
  popularity: number;
  trend: 'up' | 'down' | 'same';
  trendChange: number;
  weeksOnChart: number;
}

interface GenreStats {
  genre: string;
  totalPlays: number;
  totalSongs: number;
  avgPopularity: number;
  topSong: string;
  growth: number;
}

const WorldPulse = () => {
  const [dailyChart, setDailyChart] = useState<ChartEntry[]>([]);
  const [weeklyChart, setWeeklyChart] = useState<ChartEntry[]>([]);
  const [genreStats, setGenreStats] = useState<GenreStats[]>([]);
  const [currentWeek, setCurrentWeek] = useState("Week 23, 2024");

  useEffect(() => {
    loadChartData();
  }, []);

  const loadChartData = async () => {
    try {
      // Simulated chart data
      const mockDailyChart: ChartEntry[] = [
        {
          rank: 1,
          title: "Electric Storm",
          artist: "Nova Thunder",
          band: "Storm Riders",
          genre: "Rock",
          plays: 45789,
          popularity: 95,
          trend: "up",
          trendChange: 3,
          weeksOnChart: 2
        },
        {
          rank: 2,
          title: "Midnight Rebellion",
          artist: "Shadow Phoenix",
          band: "Dark Angels",
          genre: "Metal",
          plays: 42156,
          popularity: 92,
          trend: "down",
          trendChange: -1,
          weeksOnChart: 5
        },
        {
          rank: 3,
          title: "Digital Dreams",
          artist: "Cyber Queen",
          band: "Neon Knights",
          genre: "Electronic",
          plays: 38942,
          popularity: 89,
          trend: "up",
          trendChange: 2,
          weeksOnChart: 1
        },
        {
          rank: 4,
          title: "Broken Wings",
          artist: "Angel Dust",
          band: "Fallen Angels",
          genre: "Alternative",
          plays: 35678,
          popularity: 85,
          trend: "same",
          trendChange: 0,
          weeksOnChart: 3
        },
        {
          rank: 5,
          title: "Fire in the Sky",
          artist: "Blaze",
          band: "Phoenix Rising",
          genre: "Punk",
          plays: 32145,
          popularity: 82,
          trend: "up",
          trendChange: 1,
          weeksOnChart: 4
        },
        {
          rank: 6,
          title: "Whispers in the Dark",
          artist: "Midnight",
          band: "Shadow Band",
          genre: "Gothic",
          plays: 29876,
          popularity: 78,
          trend: "down",
          trendChange: -2,
          weeksOnChart: 6
        },
        {
          rank: 7,
          title: "Thunder Road",
          artist: "Lightning",
          band: "Storm Chasers",
          genre: "Rock",
          plays: 27543,
          popularity: 75,
          trend: "up",
          trendChange: 4,
          weeksOnChart: 1
        },
        {
          rank: 8,
          title: "Crystal Vision",
          artist: "Mystic",
          band: "Dream Weavers",
          genre: "Progressive",
          plays: 25421,
          popularity: 72,
          trend: "same",
          trendChange: 0,
          weeksOnChart: 8
        },
        {
          rank: 9,
          title: "Neon Nights",
          artist: "Synthwave",
          band: "Retro Future",
          genre: "Electronic",
          plays: 23198,
          popularity: 69,
          trend: "up",
          trendChange: 2,
          weeksOnChart: 2
        },
        {
          rank: 10,
          title: "Wild Heart",
          artist: "Rebel",
          band: "Free Spirits",
          genre: "Folk Rock",
          plays: 21087,
          popularity: 66,
          trend: "down",
          trendChange: -3,
          weeksOnChart: 7
        }
      ];

      const mockGenreStats: GenreStats[] = [
        {
          genre: "Rock",
          totalPlays: 156789,
          totalSongs: 45,
          avgPopularity: 78,
          topSong: "Electric Storm",
          growth: 12.5
        },
        {
          genre: "Metal",
          totalPlays: 134567,
          totalSongs: 38,
          avgPopularity: 82,
          topSong: "Midnight Rebellion",
          growth: 8.3
        },
        {
          genre: "Electronic",
          totalPlays: 98432,
          totalSongs: 52,
          avgPopularity: 75,
          topSong: "Digital Dreams",
          growth: 15.7
        },
        {
          genre: "Alternative",
          totalPlays: 87654,
          totalSongs: 41,
          avgPopularity: 73,
          topSong: "Broken Wings",
          growth: 6.2
        },
        {
          genre: "Punk",
          totalPlays: 76543,
          totalSongs: 35,
          avgPopularity: 71,
          topSong: "Fire in the Sky",
          growth: 9.8
        }
      ];

      setDailyChart(mockDailyChart);
      setWeeklyChart(mockDailyChart); // Using same data for demo
      setGenreStats(mockGenreStats);
    } catch (error) {
      console.error("Failed to load chart data:", error);
    }
  };

  const getTrendIcon = (trend: string, change: number) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-success" />;
    if (trend === 'down') return <TrendingUp className="h-4 w-4 text-destructive rotate-180" />;
    return <span className="h-4 w-4 text-muted-foreground">-</span>;
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-success';
      case 'down': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Crown className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Award className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Award className="h-4 w-4 text-amber-600" />;
    return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              World Pulse Charts
            </h1>
            <p className="text-muted-foreground">Global music trends and rankings</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/20">
              <Calendar className="h-3 w-3 mr-1" />
              {currentWeek}
            </Badge>
            <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
              <Zap className="h-4 w-4 mr-2" />
              Refresh Charts
            </Button>
          </div>
        </div>

        <Tabs defaultValue="daily" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="daily">Daily Top 10</TabsTrigger>
            <TabsTrigger value="weekly">Weekly Top 10</TabsTrigger>
            <TabsTrigger value="genres">Genre Stats</TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Daily Chart - Top 10
                </CardTitle>
                <CardDescription>Most popular songs today</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dailyChart.map((entry) => (
                    <div 
                      key={entry.rank}
                      className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center justify-center w-12">
                        {getRankBadge(entry.rank)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg truncate">{entry.title}</h3>
                          <Badge variant="outline" className="text-xs">
                            {entry.genre}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.artist} • {entry.band}
                        </p>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-2">
                          <Play className="h-3 w-3" />
                          <span className="font-mono text-sm">{entry.plays.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getTrendIcon(entry.trend, entry.trendChange)}
                          <span className={`text-sm ${getTrendColor(entry.trend)}`}>
                            {entry.trend === 'same' ? '—' : `${entry.trendChange > 0 ? '+' : ''}${entry.trendChange}`}
                          </span>
                        </div>
                      </div>

                      <div className="w-24">
                        <div className="text-xs text-muted-foreground mb-1">Popularity</div>
                        <Progress value={entry.popularity} className="h-2" />
                        <div className="text-xs text-right mt-1">{entry.popularity}%</div>
                      </div>

                      <div className="text-center text-xs text-muted-foreground">
                        <div>{entry.weeksOnChart}</div>
                        <div>weeks</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="weekly">
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-accent" />
                  Weekly Chart - Top 10
                </CardTitle>
                <CardDescription>Most popular songs this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {weeklyChart.map((entry) => (
                    <div 
                      key={entry.rank}
                      className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center justify-center w-12">
                        {getRankBadge(entry.rank)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg truncate">{entry.title}</h3>
                          <Badge variant="outline" className="text-xs">
                            {entry.genre}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {entry.artist} • {entry.band}
                        </p>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="flex items-center gap-2">
                          <Play className="h-3 w-3" />
                          <span className="font-mono text-sm">{entry.plays.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getTrendIcon(entry.trend, entry.trendChange)}
                          <span className={`text-sm ${getTrendColor(entry.trend)}`}>
                            {entry.trend === 'same' ? '—' : `${entry.trendChange > 0 ? '+' : ''}${entry.trendChange}`}
                          </span>
                        </div>
                      </div>

                      <div className="w-24">
                        <div className="text-xs text-muted-foreground mb-1">Popularity</div>
                        <Progress value={entry.popularity} className="h-2" />
                        <div className="text-xs text-right mt-1">{entry.popularity}%</div>
                      </div>

                      <div className="text-center text-xs text-muted-foreground">
                        <div>{entry.weeksOnChart}</div>
                        <div>weeks</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="genres">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {genreStats.map((genre) => (
                <Card key={genre.genre} className="bg-card/80 backdrop-blur-sm border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{genre.genre}</span>
                      <Badge 
                        variant={genre.growth > 10 ? "default" : "secondary"}
                        className={genre.growth > 10 ? "bg-gradient-primary" : ""}
                      >
                        {genre.growth > 0 ? '+' : ''}{genre.growth.toFixed(1)}%
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-primary">
                          {genre.totalPlays.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Plays</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-accent">
                          {genre.totalSongs}
                        </div>
                        <div className="text-xs text-muted-foreground">Songs</div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Avg Popularity</span>
                        <span>{genre.avgPopularity}%</span>
                      </div>
                      <Progress value={genre.avgPopularity} className="h-2" />
                    </div>

                    <div className="pt-2 border-t border-border/50">
                      <div className="text-xs text-muted-foreground mb-1">Top Song</div>
                      <div className="font-medium text-sm">{genre.topSong}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WorldPulse;