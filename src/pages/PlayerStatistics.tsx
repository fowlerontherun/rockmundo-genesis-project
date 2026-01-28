import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/use-auth-context';
import { useGameData } from '@/hooks/useGameData';
import { usePlayerLevel } from '@/hooks/usePlayerLevel';
import { TrendingUp, Award, Music, Users, Star, DollarSign } from 'lucide-react';
import { PlayerAchievements } from '@/components/player-stats/PlayerAchievements';
import { PerformanceHistory } from '@/components/player-stats/PerformanceHistory';

export default function PlayerStatistics() {
  const { user } = useAuth();
  const { profile, skills, attributes, xpWallet } = useGameData();
  
  const levelData = usePlayerLevel({
    xpWallet,
    skills,
    fame: profile?.fame ?? 0,
    attributeStars: 0,
  });

  if (!user || !profile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Please log in to view your statistics.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Player Statistics</h1>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-lg px-4 py-2 bg-primary/10 text-primary border-primary/30">
            <Star className="h-4 w-4 mr-1" />
            Level {levelData.level}
          </Badge>
          {levelData.level < 100 && (
            <div className="flex flex-col gap-1 min-w-[100px]">
              <Progress value={levelData.levelProgress} className="h-2" />
              <span className="text-[10px] text-muted-foreground text-right">
                {levelData.xpToNextLevel.toLocaleString()} XP to next
              </span>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Level</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{levelData.level}</div>
                <p className="text-xs text-muted-foreground">
                  {levelData.effectiveXp.toLocaleString()} effective XP
                </p>
                {levelData.level < 100 && (
                  <Progress value={levelData.levelProgress} className="h-1.5 mt-2" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cash</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${profile.cash?.toLocaleString() || '0'}</div>
                <p className="text-xs text-muted-foreground">
                  Available funds
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fame</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{profile.fame || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Fame points
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fans</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{profile.fans || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Total followers
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Profile Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">{profile.display_name || profile.username}</h3>
                  <p className="text-sm text-muted-foreground">{profile.bio || 'No bio available'}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Joined: {new Date(profile.created_at).toLocaleDateString()}</span>
                  <span>Last active: {new Date(profile.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="skills" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Musical Skills
              </CardTitle>
            </CardHeader>
            <CardContent>
              {skills ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.entries(skills).map(([skill, level]) => {
                    if (skill === 'id' || skill === 'user_id' || skill === 'created_at' || skill === 'updated_at') return null;
                    return (
                      <div key={skill} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium capitalize">{skill.replace('_', ' ')}</span>
                          <Badge variant="secondary">{level || 0}</Badge>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full transition-all" 
                            style={{ width: `${Math.min(100, ((level || 0) / 100) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">No skill data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-6">
          <PlayerAchievements userId={user?.id} />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <PerformanceHistory userId={user?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}