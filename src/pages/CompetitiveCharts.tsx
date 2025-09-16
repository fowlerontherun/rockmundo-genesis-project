import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGameData } from '@/hooks/useGameData';
import { toast } from 'sonner';
import { Trophy, TrendingUp, Users, Crown, Star, Music, Target, Award, Zap, Calendar } from 'lucide-react';

interface PlayerRanking {
  id: string;
  username: string;
  display_name: string;
  level: number;
  fame: number;
  total_plays: number;
  hit_songs: number;
  rank: number;
  trend: 'up' | 'down' | 'same';
  avatar_url?: string;
}

interface Competition {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  prize_pool: number;
  entry_fee: number;
  participants: number;
  max_participants: number;
  category: string;
  requirements: Record<string, number>;
  is_active: boolean;
  user_registered: boolean;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  category: string;
  progress?: number;
  unlocked?: boolean;
}

const CompetitiveCharts: React.FC = () => {
  const { user } = useAuth();
  const { profile, skills } = useGameData();
  const [playerRankings, setPlayerRankings] = useState<PlayerRanking[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userRank, setUserRank] = useState<PlayerRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [registeredCompetitions, setRegisteredCompetitions] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadCompetitiveData();
    }
  }, [user]);

  const loadCompetitiveData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load global rankings (simulated)
      const rankings = generateGlobalRankings();
      setPlayerRankings(rankings);
      
      // Find user's rank
      const userRanking = rankings.find(r => r.id === user.id);
      setUserRank(userRanking || null);

      // Load competitions (simulated)
      const competitionsData = generateCompetitions();
      setCompetitions(competitionsData);

      // Load achievements
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('achievements')
        .select('*')
        .order('rarity', { ascending: false });

      if (achievementsError) throw achievementsError;
      setAchievements(achievementsData || []);

    } catch (error: any) {
      console.error('Error loading competitive data:', error);
      toast.error('Failed to load competitive data');
    } finally {
      setLoading(false);
    }
  };

  const generateGlobalRankings = (): PlayerRanking[] => {
    const baseRankings = [
      { username: 'RockLegend', display_name: 'The Rock Legend', level: 25, fame: 15000, total_plays: 500000, hit_songs: 8 },
      { username: 'MelodyMaster', display_name: 'Melody Master', level: 23, fame: 12000, total_plays: 400000, hit_songs: 6 },
      { username: 'BassDropper', display_name: 'Bass Dropper', level: 22, fame: 11000, total_plays: 350000, hit_songs: 5 },
      { username: 'DrumSolo99', display_name: 'Drum Solo', level: 21, fame: 10000, total_plays: 300000, hit_songs: 4 },
      { username: 'VocalVirtuoso', display_name: 'Vocal Virtuoso', level: 20, fame: 9500, total_plays: 280000, hit_songs: 5 },
    ];

    // Add user if they exist
    if (profile) {
      baseRankings.push({
        username: profile.username,
        display_name: profile.display_name || profile.username,
        level: profile.level,
        fame: profile.fame,
        total_plays: Math.floor(Math.random() * 100000),
        hit_songs: Math.floor(Math.random() * 3)
      });
    }

    // Add more random players
    for (let i = 0; i < 15; i++) {
      baseRankings.push({
        username: `Player${i + 6}`,
        display_name: `Player ${i + 6}`,
        level: Math.floor(Math.random() * 15) + 5,
        fame: Math.floor(Math.random() * 5000) + 1000,
        total_plays: Math.floor(Math.random() * 200000) + 10000,
        hit_songs: Math.floor(Math.random() * 3)
      });
    }

    // Sort by fame and assign ranks
    return baseRankings
      .sort((a, b) => b.fame - a.fame)
      .map((player, index) => ({
        ...player,
        id: user?.id && player.username === profile?.username ? user.id : `player-${index}`,
        rank: index + 1,
        trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'same'
      }));
  };

  const generateCompetitions = (): Competition[] => {
    const now = new Date();
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    
    return [
      {
        id: 'battle-of-bands',
        name: 'Battle of the Bands',
        description: 'Compete against other bands in weekly performances',
        start_date: new Date(now.getTime() - oneWeek).toISOString(),
        end_date: new Date(now.getTime() + oneWeek).toISOString(),
        prize_pool: 50000,
        entry_fee: 1000,
        participants: 87,
        max_participants: 100,
        category: 'performance',
        requirements: { performance: 50, fame: 1000 },
        is_active: true,
        user_registered: false
      },
      {
        id: 'songwriting-contest',
        name: 'Songwriting Contest',
        description: 'Create the most popular song of the month',
        start_date: new Date(now.getTime() - oneWeek * 2).toISOString(),
        end_date: new Date(now.getTime() + oneWeek * 2).toISOString(),
        prize_pool: 30000,
        entry_fee: 500,
        participants: 156,
        max_participants: 200,
        category: 'songwriting',
        requirements: { songwriting: 40, level: 10 },
        is_active: true,
        user_registered: false
      },
      {
        id: 'viral-challenge',
        name: 'Viral Challenge',
        description: 'Get the most streams in 48 hours',
        start_date: new Date(now.getTime() + oneWeek).toISOString(),
        end_date: new Date(now.getTime() + oneWeek + 2 * 24 * 60 * 60 * 1000).toISOString(),
        prize_pool: 75000,
        entry_fee: 2000,
        participants: 23,
        max_participants: 50,
        category: 'streaming',
        requirements: { fame: 5000, level: 15 },
        is_active: false,
        user_registered: false
      }
    ];
  };

  const registerForCompetition = async (competitionId: string) => {
    if (!profile || !user) return;

    const competition = competitions.find(c => c.id === competitionId);
    if (!competition) return;

    // Check requirements
    const meetsRequirements = Object.entries(competition.requirements).every(([key, value]) => {
      if (key === 'level') return profile.level >= value;
      if (key === 'fame') return profile.fame >= value;
      if (skills && key in skills) return (skills as any)[key] >= value;
      return true;
    });

    if (!meetsRequirements) {
      toast.error('You don\'t meet the requirements for this competition');
      return;
    }

    if (profile.cash < competition.entry_fee) {
      toast.error('Insufficient funds for entry fee');
      return;
    }

    try {
      // In a real implementation, this would be stored in the database
      setRegisteredCompetitions(prev => new Set([...prev, competitionId]));
      setCompetitions(prev => prev.map(c => 
        c.id === competitionId 
          ? { ...c, participants: c.participants + 1, user_registered: true }
          : c
      ));
      
      toast.success(`Registered for ${competition.name}!`);
    } catch (error: any) {
      console.error('Error registering for competition:', error);
      toast.error('Failed to register for competition');
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down': return <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />;
      default: return <div className="w-4 h-4" />;
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Award className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />;
    return <span className="text-lg font-bold">#{rank}</span>;
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'bg-gradient-to-r from-purple-500 to-pink-500';
      case 'epic': return 'bg-gradient-to-r from-purple-400 to-blue-500';
      case 'rare': return 'bg-gradient-to-r from-blue-400 to-green-500';
      case 'uncommon': return 'bg-gradient-to-r from-green-400 to-yellow-500';
      default: return 'bg-gradient-to-r from-gray-400 to-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          World Competition Hub
        </h1>
        <p className="text-muted-foreground">
          Compete globally, climb the rankings, and prove your musical dominance
        </p>
      </div>

      {userRank && (
        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {getRankBadge(userRank.rank)}
                  <div>
                    <div className="font-semibold">{userRank.display_name}</div>
                    <div className="text-sm text-muted-foreground">Level {userRank.level}</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-2xl font-bold text-primary">{userRank.fame.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Fame</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-500">{userRank.total_plays.toLocaleString()}</div>
                  <div className="text-sm text-muted-foreground">Total Plays</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-500">{userRank.hit_songs}</div>
                  <div className="text-sm text-muted-foreground">Hit Songs</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="rankings" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rankings">Global Rankings</TabsTrigger>
          <TabsTrigger value="competitions">Live Competitions</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="leaderboards">Leaderboards</TabsTrigger>
        </TabsList>

        <TabsContent value="rankings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-6 h-6" />
                Global Fame Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {playerRankings.slice(0, 20).map((player) => (
                  <div 
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      player.id === user?.id ? 'bg-primary/10 border-primary/30' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 min-w-[60px]">
                        {getRankBadge(player.rank)}
                        {getTrendIcon(player.trend)}
                      </div>
                      <div>
                        <div className="font-medium">{player.display_name}</div>
                        <div className="text-sm text-muted-foreground">@{player.username}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-right">
                      <div>
                        <div className="font-medium">Level {player.level}</div>
                      </div>
                      <div>
                        <div className="font-medium">{player.fame.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Fame</div>
                      </div>
                      <div>
                        <div className="font-medium">{player.total_plays.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Plays</div>
                      </div>
                      <div>
                        <div className="font-medium">{player.hit_songs}</div>
                        <div className="text-xs text-muted-foreground">Hits</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competitions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {competitions.map((competition) => (
              <Card key={competition.id} className={`${competition.is_active ? 'border-green-500/30' : 'border-orange-500/30'}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{competition.name}</CardTitle>
                    <Badge variant={competition.is_active ? "default" : "secondary"}>
                      {competition.is_active ? 'Active' : 'Starting Soon'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{competition.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Prize Pool</div>
                      <div className="font-bold text-green-500">${competition.prize_pool.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Entry Fee</div>
                      <div className="font-bold">${competition.entry_fee}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Participants</div>
                      <div className="font-bold">{competition.participants}/{competition.max_participants}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Category</div>
                      <div className="font-bold capitalize">{competition.category}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-2">Requirements:</div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(competition.requirements).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}: {value}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Progress 
                    value={(competition.participants / competition.max_participants) * 100} 
                    className="h-2"
                  />

                  <Button 
                    onClick={() => registerForCompetition(competition.id)}
                    disabled={!competition.is_active || competition.user_registered}
                    className="w-full"
                  >
                    {competition.user_registered ? 'Registered' : 'Register'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <Card key={achievement.id} className="relative overflow-hidden">
                <div className={`absolute inset-0 opacity-10 ${getRarityColor(achievement.rarity)}`} />
                <CardContent className="p-4 relative">
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-2xl">{achievement.icon}</div>
                    <Badge 
                      variant="outline" 
                      className={`capitalize ${achievement.rarity === 'legendary' ? 'border-purple-500 text-purple-700' : ''}`}
                    >
                      {achievement.rarity}
                    </Badge>
                  </div>
                  <h3 className="font-semibold mb-1">{achievement.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{achievement.description}</p>
                  {achievement.progress !== undefined && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Progress</span>
                        <span>{achievement.progress}%</span>
                      </div>
                      <Progress value={achievement.progress} className="h-1" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="leaderboards" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Music className="w-5 h-5" />
                  Top Songs This Week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { title: "Electric Dreams", artist: "RockLegend", plays: 125000 },
                    { title: "Midnight Symphony", artist: "MelodyMaster", plays: 98000 },
                    { title: "Bass Revolution", artist: "BassDropper", plays: 87000 },
                    { title: "Drum Thunder", artist: "DrumSolo99", plays: 76000 },
                    { title: "Vocal Paradise", artist: "VocalVirtuoso", plays: 65000 },
                  ].map((song, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg">#{index + 1}</span>
                        <div>
                          <div className="font-medium">{song.title}</div>
                          <div className="text-sm text-muted-foreground">{song.artist}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{song.plays.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">plays</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Rising Stars
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "NewWaveArtist", growth: "+450%", followers: 15000 },
                    { name: "IndieDreamer", growth: "+320%", followers: 12000 },
                    { name: "SynthWizard", growth: "+280%", followers: 9500 },
                    { name: "RockRebel", growth: "+240%", followers: 8200 },
                    { name: "PopSensation", growth: "+190%", followers: 7800 },
                  ].map((artist, index) => (
                    <div key={index} className="flex items-center justify-between p-2 rounded">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg">#{index + 1}</span>
                        <div>
                          <div className="font-medium">{artist.name}</div>
                          <div className="text-sm text-green-500">{artist.growth}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{artist.followers.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">followers</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CompetitiveCharts;