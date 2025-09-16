import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Music, 
  Users, 
  Calendar, 
  TrendingUp, 
  Guitar, 
  Mic, 
  Headphones,
  DollarSign,
  Star,
  Play
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  const [playerStats, setPlayerStats] = useState({
    name: "Demo Player",
    level: 15,
    experience: 2450,
    experienceToNext: 3000,
    cash: 15420,
    fame: 342,
    skills: {
      vocals: 75,
      guitar: 82,
      bass: 45,
      drums: 38,
      songwriting: 68,
      performance: 71
    }
  });

  const [bandInfo, setBandInfo] = useState({
    name: "Electric Dreams",
    members: 4,
    genre: "Alternative Rock",
    popularity: 67,
    weeklyFans: 1234,
    upcomingGigs: 3
  });

  const [recentActivity, setRecentActivity] = useState([
    { type: "gig", message: "Performed at The Underground Club", time: "2 hours ago", earnings: 850 },
    { type: "skill", message: "Guitar skill increased to 82", time: "1 day ago" },
    { type: "fan", message: "Gained 45 new fans", time: "2 days ago" },
    { type: "song", message: "Completed 'Midnight Echo'", time: "3 days ago" }
  ]);

  const skillColor = (value: number) => {
    if (value >= 80) return "text-success";
    if (value >= 60) return "text-warning";
    return "text-muted-foreground";
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "gig": return <Play className="h-4 w-4" />;
      case "skill": return <TrendingUp className="h-4 w-4" />;
      case "fan": return <Users className="h-4 w-4" />;
      case "song": return <Music className="h-4 w-4" />;
      default: return <Star className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bebas tracking-wider bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              Welcome back, {playerStats.name}
            </h1>
            <p className="text-muted-foreground font-oswald">Ready to rock the world?</p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={() => navigate("/band")}
              className="bg-gradient-primary hover:shadow-electric"
            >
              <Users className="h-4 w-4 mr-2" />
              Band Manager
            </Button>
            <Button 
              onClick={() => navigate("/gigs")}
              variant="outline" 
              className="border-primary/20 hover:bg-primary/10"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Book Gigs
            </Button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Level</CardTitle>
              <Star className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{playerStats.level}</div>
              <Progress 
                value={(playerStats.experience / playerStats.experienceToNext) * 100} 
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {playerStats.experience}/{playerStats.experienceToNext} XP
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash</CardTitle>
              <DollarSign className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                ${playerStats.cash.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                From recent performances
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fame</CardTitle>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{playerStats.fame}</div>
              <p className="text-xs text-muted-foreground">
                +12 this week
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Band Popularity</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{bandInfo.popularity}%</div>
              <p className="text-xs text-muted-foreground">
                {bandInfo.weeklyFans} new fans this week
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skills */}
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Guitar className="h-5 w-5 text-primary" />
                Skills
              </CardTitle>
              <CardDescription>Your musical abilities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(playerStats.skills).map(([skill, value]) => (
                <div key={skill} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize font-medium">{skill}</span>
                    <span className={skillColor(value)}>{value}/100</span>
                  </div>
                  <Progress value={value} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Band Info & Activity */}
          <div className="space-y-4">
            {/* Band Info */}
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-accent" />
                  {bandInfo.name}
                </CardTitle>
                <CardDescription>{bandInfo.genre}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Members</p>
                    <p className="font-semibold">{bandInfo.members}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Upcoming Gigs</p>
                    <p className="font-semibold">{bandInfo.upcomingGigs}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="h-5 w-5 text-primary" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 p-2 rounded-lg bg-secondary/30">
                    <div className="text-primary mt-0.5">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                      {activity.earnings && (
                        <Badge variant="outline" className="mt-1 text-xs border-success text-success">
                          +${activity.earnings}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;