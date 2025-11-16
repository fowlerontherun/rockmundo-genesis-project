import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth-context";
import { useAchievements } from "@/hooks/useAchievements";
import { usePlayerStatistics } from "@/hooks/usePlayerStatistics";
import { Trophy, Music, TrendingUp, Star, Award, Target } from "lucide-react";

const PlayerStatistics = () => {
  const { user } = useAuth();
  const {
    allAchievements,
    unlockedAchievements,
    lockedAchievements,
    progressByCategory,
    completionPercentage,
    isLoading: isLoadingAchievements,
  } = useAchievements(user?.id);

  const { performanceStats, songwritingStats, isLoading: isLoadingStats } = usePlayerStatistics(user?.id);

  if (isLoadingAchievements || isLoadingStats) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-muted-foreground">Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Trophy className="h-8 w-8" />
          Player Statistics
        </h1>
        <p className="text-muted-foreground">Track your progress and achievements</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Achievements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unlockedAchievements.length}/{allAchievements.length}</div>
            <Progress value={completionPercentage} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Gigs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceStats?.totalGigs || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Songs Written</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{songwritingStats?.totalSongs || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Streams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{songwritingStats?.totalStreams?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="achievements">
        <TabsList>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="songwriting">Songwriting</TabsTrigger>
        </TabsList>

        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Achievement Progress</CardTitle>
              <CardDescription>{completionPercentage}% complete</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(progressByCategory).map(([category, progress]) => (
                <div key={category}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{category}</span>
                    <span className="text-sm text-muted-foreground">{progress.unlocked}/{progress.total}</span>
                  </div>
                  <Progress value={(progress.unlocked / progress.total) * 100} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Unlocked ({unlockedAchievements.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {unlockedAchievements.map((achievement) => (
                  <div key={achievement.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium">{achievement.name}</p>
                        <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      </div>
                      <Badge variant="outline">{achievement.rarity}</Badge>
                    </div>
                  </div>
                ))}
                {unlockedAchievements.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No achievements unlocked yet</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Locked ({lockedAchievements.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lockedAchievements.slice(0, 5).map((achievement) => (
                  <div key={achievement.id} className="p-3 border rounded-lg opacity-60">
                    <p className="font-medium">???</p>
                    <p className="text-sm text-muted-foreground">Complete tasks to unlock</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${performanceStats?.totalRevenue?.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold flex items-center gap-1">
                  {performanceStats?.averageRating || 0}
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{performanceStats?.totalAttendance?.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
          </div>

          {performanceStats?.bestPerformance && (
            <Card>
              <CardHeader>
                <CardTitle>Best Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><span className="font-medium">Venue:</span> {performanceStats.bestPerformance.venue}</p>
                  <p><span className="font-medium">Rating:</span> {performanceStats.bestPerformance.rating}/5</p>
                  <p><span className="font-medium">Date:</span> {new Date(performanceStats.bestPerformance.date).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="songwriting" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Average Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{songwritingStats?.averageQuality?.toFixed(1) || 0}/100</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Song Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${songwritingStats?.totalRevenue?.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
          </div>

          {songwritingStats?.topSong && (
            <Card>
              <CardHeader>
                <CardTitle>Top Song</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><span className="font-medium">Title:</span> {songwritingStats.topSong.title}</p>
                  <p><span className="font-medium">Streams:</span> {songwritingStats.topSong.streams.toLocaleString()}</p>
                  <p><span className="font-medium">Quality:</span> {songwritingStats.topSong.quality}/100</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlayerStatistics;
