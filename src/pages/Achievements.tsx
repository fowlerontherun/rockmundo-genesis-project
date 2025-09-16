import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Trophy, 
  Star, 
  Music, 
  Users, 
  Guitar,
  Mic,
  Calendar,
  TrendingUp,
  Award,
  Crown,
  Target,
  Zap
} from "lucide-react";

const Achievements = () => {
  const [achievements] = useState([
    {
      id: "first-gig",
      title: "Stage Debut",
      description: "Perform your first gig",
      icon: <Music className="h-6 w-6" />,
      unlocked: true,
      rarity: "common",
      reward: "$100 + 50 XP",
      unlockedDate: "2024-01-15"
    },
    {
      id: "guitar-master",
      title: "Guitar Hero",
      description: "Reach 80+ guitar skill",
      icon: <Guitar className="h-6 w-6" />,
      unlocked: true,
      rarity: "rare",
      reward: "$500 + 200 XP",
      unlockedDate: "2024-02-20"
    },
    {
      id: "fan-favorite",
      title: "Fan Favorite",
      description: "Gain 10,000 fans",
      icon: <Users className="h-6 w-6" />,
      unlocked: true,
      rarity: "epic",
      reward: "$1000 + 300 XP",
      unlockedDate: "2024-03-10"
    },
    {
      id: "chart-topper",
      title: "Chart Topper",
      description: "Reach #1 on World Pulse Charts",
      icon: <TrendingUp className="h-6 w-6" />,
      unlocked: false,
      rarity: "legendary",
      reward: "$5000 + 1000 XP",
      progress: 75
    },
    {
      id: "songwriter-pro",
      title: "Songwriter Pro",
      description: "Write 50 songs",
      icon: <Mic className="h-6 w-6" />,
      unlocked: false,
      rarity: "rare",
      reward: "$800 + 400 XP",
      progress: 34
    },
    {
      id: "touring-machine",
      title: "Touring Machine",
      description: "Complete 100 gigs",
      icon: <Calendar className="h-6 w-6" />,
      unlocked: false,
      rarity: "epic",
      reward: "$2000 + 500 XP",
      progress: 67
    }
  ]);

  const [milestones] = useState([
    { title: "First Performance", description: "Performed at The Underground Club", completed: true, reward: "50 XP" },
    { title: "Skill Specialist", description: "Master one instrument (80+ skill)", completed: true, reward: "200 XP" },
    { title: "Rising Star", description: "Gain 5,000 fans", completed: true, reward: "300 XP" },
    { title: "Studio Session", description: "Record 10 songs", completed: false, progress: 60, reward: "400 XP" },
    { title: "Chart Success", description: "Get a song to Top 10", completed: false, progress: 25, reward: "600 XP" },
    { title: "World Tour", description: "Perform in 5 different venues", completed: false, progress: 40, reward: "800 XP" }
  ]);

  const [playerStats] = useState({
    totalAchievements: 15,
    unlockedAchievements: 6,
    totalXP: 2450,
    currentStreak: 7,
    rank: "Rising Star"
  });

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "common": return "bg-secondary text-secondary-foreground border-secondary";
      case "rare": return "bg-primary text-primary-foreground border-primary";
      case "epic": return "bg-accent text-accent-foreground border-accent";
      case "legendary": return "bg-gradient-primary text-white border-warning";
      default: return "bg-secondary text-secondary-foreground border-secondary";
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case "legendary": return "shadow-electric";
      case "epic": return "shadow-lg shadow-accent/20";
      case "rare": return "shadow-lg shadow-primary/20";
      default: return "";
    }
  };

  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const lockedAchievements = achievements.filter(a => !a.unlocked);

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Achievements
            </h1>
            <p className="text-muted-foreground">Track your rock star journey and unlock rewards</p>
          </div>
        </div>

        {/* Achievement Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unlocked</CardTitle>
              <Trophy className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {playerStats.unlockedAchievements}/{playerStats.totalAchievements}
              </div>
              <Progress 
                value={(playerStats.unlockedAchievements / playerStats.totalAchievements) * 100} 
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total XP</CardTitle>
              <Star className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{playerStats.totalXP.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Experience Points</p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
              <Zap className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{playerStats.currentStreak}</div>
              <p className="text-xs text-muted-foreground">Days active</p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rank</CardTitle>
              <Crown className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-success">{playerStats.rank}</div>
              <p className="text-xs text-muted-foreground">Current Title</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="achievements" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
            <TabsTrigger value="achievements" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="milestones" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Milestones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="achievements" className="mt-6 space-y-6">
            {/* Unlocked Achievements */}
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Award className="h-5 w-5 text-warning" />
                Unlocked Achievements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unlockedAchievements.map((achievement) => (
                  <Card key={achievement.id} className={`bg-card/80 backdrop-blur-sm border-2 ${getRarityColor(achievement.rarity)} ${getRarityGlow(achievement.rarity)}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-current">{achievement.icon}</div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{achievement.title}</CardTitle>
                          <Badge className={getRarityColor(achievement.rarity)}>
                            {achievement.rarity}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>{achievement.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-success">
                          Reward: {achievement.reward}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Unlocked: {achievement.unlockedDate}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Locked Achievements */}
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-muted-foreground" />
                In Progress
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lockedAchievements.map((achievement) => (
                  <Card key={achievement.id} className="bg-card/80 backdrop-blur-sm border-muted/50 opacity-75">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-muted-foreground">{achievement.icon}</div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{achievement.title}</CardTitle>
                          <Badge variant="outline" className={getRarityColor(achievement.rarity)}>
                            {achievement.rarity}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>{achievement.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {achievement.progress && (
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Progress</span>
                              <span>{achievement.progress}%</span>
                            </div>
                            <Progress value={achievement.progress} className="h-2" />
                          </div>
                        )}
                        <div className="text-sm font-medium text-muted-foreground">
                          Reward: {achievement.reward}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="milestones" className="mt-6">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Career Milestones
              </h3>
              {milestones.map((milestone, index) => (
                <Card key={index} className={`bg-card/80 backdrop-blur-sm ${milestone.completed ? 'border-success/50' : 'border-primary/20'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${milestone.completed ? 'bg-success text-success-foreground' : 'bg-primary/20'}`}>
                          {milestone.completed ? (
                            <Trophy className="h-4 w-4" />
                          ) : (
                            <Target className="h-4 w-4" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold">{milestone.title}</h4>
                          <p className="text-sm text-muted-foreground">{milestone.description}</p>
                          {!milestone.completed && milestone.progress && (
                            <div className="mt-2 w-48">
                              <div className="flex justify-between text-xs mb-1">
                                <span>Progress</span>
                                <span>{milestone.progress}%</span>
                              </div>
                              <Progress value={milestone.progress} className="h-1" />
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge variant={milestone.completed ? "default" : "outline"} className="text-xs">
                        {milestone.reward}
                      </Badge>
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

export default Achievements;