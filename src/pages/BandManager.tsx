import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Users, 
  Music, 
  Guitar, 
  Mic, 
  Drum,
  TrendingUp,
  UserPlus,
  Settings,
  Star
} from "lucide-react";

const BandManager = () => {
  const [band] = useState({
    name: "Electric Dreams",
    genre: "Alternative Rock",
    level: 8,
    popularity: 67,
    weeklyGrowth: 15,
    totalFans: 12400,
    members: [
      {
        id: 1,
        name: "You",
        role: "Lead Vocals",
        skills: { vocals: 82, performance: 78, songwriting: 71 },
        avatar: "",
        isPlayer: true
      },
      {
        id: 2,
        name: "Jake Morrison",
        role: "Lead Guitar",
        skills: { guitar: 89, performance: 76, songwriting: 45 },
        avatar: "",
        salary: 800
      },
      {
        id: 3,
        name: "Sarah Chen",
        role: "Bass Guitar",
        skills: { bass: 73, performance: 68, vocals: 52 },
        avatar: "",
        salary: 750
      },
      {
        id: 4,
        name: "Mike Thunder",
        role: "Drums",
        skills: { drums: 85, performance: 82, vocals: 38 },
        avatar: "",
        salary: 850
      }
    ],
    stats: {
      songsWritten: 24,
      albumsReleased: 2,
      gigsPlayed: 67,
      chartPosition: 15
    }
  });

  const getRoleIcon = (role: string) => {
    if (role.includes("Vocal")) return <Mic className="h-4 w-4" />;
    if (role.includes("Guitar")) return <Guitar className="h-4 w-4" />;
    if (role.includes("Drum")) return <Drum className="h-4 w-4" />;
    return <Music className="h-4 w-4" />;
  };

  const getSkillColor = (value: number) => {
    if (value >= 80) return "text-success";
    if (value >= 60) return "text-warning";
    return "text-muted-foreground";
  };

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              {band.name}
            </h1>
            <p className="text-muted-foreground">{band.genre} • Level {band.level}</p>
          </div>
          <div className="flex gap-2">
            <Button className="bg-gradient-primary hover:shadow-electric">
              <UserPlus className="h-4 w-4 mr-2" />
              Recruit Member
            </Button>
            <Button variant="outline" className="border-primary/20 hover:bg-primary/10">
              <Settings className="h-4 w-4 mr-2" />
              Band Settings
            </Button>
          </div>
        </div>

        {/* Band Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Popularity</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{band.popularity}%</div>
              <Progress value={band.popularity} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">
                +{band.weeklyGrowth}% this week
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Fans</CardTitle>
              <Users className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">
                {band.totalFans.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Growing steadily
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chart Position</CardTitle>
              <Star className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">#{band.stats.chartPosition}</div>
              <p className="text-xs text-muted-foreground">
                Alternative Rock charts
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gigs Played</CardTitle>
              <Music className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{band.stats.gigsPlayed}</div>
              <p className="text-xs text-muted-foreground">
                Total performances
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Band Members */}
        <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Band Members
            </CardTitle>
            <CardDescription>
              Your musical collaborators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {band.members.map((member) => (
                <div key={member.id} className="p-4 rounded-lg bg-secondary/30 border border-primary/10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={member.avatar} />
                        <AvatarFallback className="bg-gradient-primary text-primary-foreground">
                          {member.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          {member.name}
                          {member.isPlayer && (
                            <Badge variant="outline" className="text-xs border-primary text-primary">
                              You
                            </Badge>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          {getRoleIcon(member.role)}
                          {member.role}
                        </p>
                      </div>
                    </div>
                    {member.salary && (
                      <Badge variant="outline" className="text-xs border-success text-success">
                        ${member.salary}/week
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Skills</h4>
                    {Object.entries(member.skills).map(([skill, value]) => (
                      <div key={skill} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{skill}</span>
                          <span className={getSkillColor(value)}>{value}/100</span>
                        </div>
                        <Progress value={value} className="h-1.5" />
                      </div>
                    ))}
                  </div>

                  {!member.isPlayer && (
                    <div className="mt-4 pt-3 border-t border-primary/10">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-xs">
                          View Profile
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs text-destructive border-destructive/20">
                          Replace
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Band Achievements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle>Achievements</CardTitle>
              <CardDescription>Your band's milestones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                <div className="flex items-center gap-3">
                  <Music className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Songs Written</p>
                    <p className="text-sm text-muted-foreground">Creative output</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-primary">{band.stats.songsWritten}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/10">
                <div className="flex items-center gap-3">
                  <Star className="h-5 w-5 text-accent" />
                  <div>
                    <p className="font-medium">Albums Released</p>
                    <p className="text-sm text-muted-foreground">Studio recordings</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-accent">{band.stats.albumsReleased}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>Upcoming band activities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-secondary/30 border border-primary/10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Band Practice</p>
                    <p className="text-sm text-muted-foreground">Studio rehearsal</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Today</Badge>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-secondary/30 border border-primary/10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Recording Session</p>
                    <p className="text-sm text-muted-foreground">New single</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Tomorrow</Badge>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-secondary/30 border border-primary/10">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">Live Gig</p>
                    <p className="text-sm text-muted-foreground">The Underground Club</p>
                  </div>
                  <Badge variant="outline" className="text-xs">Saturday</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BandManager;