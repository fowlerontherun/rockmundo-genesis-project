import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGameData } from '@/hooks/useGameData';
import { toast } from 'sonner';
import { Trophy, TrendingUp, Crown, Award, Music, Zap } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

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

type ProfileSummary = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'id' | 'user_id' | 'username' | 'display_name' | 'level' | 'fame' | 'avatar_url'
>;
type SongSummary = Pick<Database['public']['Tables']['songs']['Row'], 'artist_id' | 'plays' | 'popularity'>;
type EventParticipantSummary = Pick<Database['public']['Tables']['event_participants']['Row'], 'event_id' | 'user_id'>;

const CompetitiveCharts: React.FC = () => {
  const { user } = useAuth();
  const { profile, skills } = useGameData();
  const [playerRankings, setPlayerRankings] = useState<PlayerRanking[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userRank, setUserRank] = useState<PlayerRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [registeredCompetitions, setRegisteredCompetitions] = useState<Set<string>>(() => new Set());

  const previousRankingsRef = useRef<Map<string, number>>(new Map());

  const fetchAchievements = useCallback(async () => {
    const { data, error } = await supabase
      .from('achievements')
      .select('*')
      .order('rarity', { ascending: false });

    if (error) throw error;
    setAchievements(data ?? []);
  }, []);

  const fetchRankings = useCallback(async () => {
    if (!user) {
      setPlayerRankings([]);
      setUserRank(null);
      previousRankingsRef.current = new Map();
      return;
    }

    const previousRanks = previousRankingsRef.current;

    const { data: topProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id, username, display_name, level, fame, avatar_url')
      .order('fame', { ascending: false })
      .limit(50);

    if (profilesError) throw profilesError;

    let profilesList: ProfileSummary[] = (topProfiles ?? []) as ProfileSummary[];
    let userProfileRecord = profilesList.find((item) => item.user_id === user.id);

    if (!userProfileRecord) {
      const { data: currentUserProfile, error: userProfileError } = await supabase
        .from('profiles')
        .select('id, user_id, username, display_name, level, fame, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (userProfileError) throw userProfileError;

      if (currentUserProfile) {
        profilesList = [...profilesList, currentUserProfile as ProfileSummary];
        userProfileRecord = currentUserProfile as ProfileSummary;
      } else if (profile) {
        const fallbackProfile: ProfileSummary = {
          id: profile.id,
          user_id: user.id,
          username: profile.username,
          display_name: profile.display_name,
          level: profile.level,
          fame: profile.fame,
          avatar_url: profile.avatar_url ?? null,
        };
        profilesList = [...profilesList, fallbackProfile];
        userProfileRecord = fallbackProfile;
      }
    }

    if (profilesList.length === 0) {
      setPlayerRankings([]);
      setUserRank(null);
      previousRankingsRef.current = new Map();
      return;
    }

    const artistIds = Array.from(
      new Set(profilesList.map((item) => item.user_id).filter((id): id is string => Boolean(id)))
    );

    let songsData: SongSummary[] = [];
    if (artistIds.length > 0) {
      const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('artist_id, plays, popularity')
        .in('artist_id', artistIds);

      if (songsError) throw songsError;
      songsData = (songs ?? []) as SongSummary[];
    }

    const statsByArtist = new Map<string, { totalPlays: number; hitSongs: number }>();

    songsData.forEach((song) => {
      if (!song.artist_id) return;
      const stats = statsByArtist.get(song.artist_id) ?? { totalPlays: 0, hitSongs: 0 };
      const plays = typeof song.plays === 'number' ? song.plays : 0;
      const popularity = typeof song.popularity === 'number' ? song.popularity : 0;
      stats.totalPlays += plays;
      if (popularity >= 80 || plays >= 100000) {
        stats.hitSongs += 1;
      }
      statsByArtist.set(song.artist_id, stats);
    });

    let higherRankCount: number | null = null;
    if (userProfileRecord) {
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .gt('fame', userProfileRecord.fame ?? 0);

      if (countError) {
        console.error('Error calculating user rank position:', countError);
      } else if (typeof count === 'number') {
        higherRankCount = count;
      }
    }

    const ranked = profilesList
      .map((profileRow) => {
        const stats = statsByArtist.get(profileRow.user_id) ?? { totalPlays: 0, hitSongs: 0 };
        const playerId = profileRow.user_id ?? profileRow.id;
        return {
          id: playerId,
          username: profileRow.username || 'player',
          display_name: profileRow.display_name || profileRow.username || 'Unknown Artist',
          level: profileRow.level ?? 1,
          fame: profileRow.fame ?? 0,
          total_plays: stats.totalPlays,
          hit_songs: stats.hitSongs,
          rank: 0,
          trend: 'same' as PlayerRanking['trend'],
          avatar_url: profileRow.avatar_url ?? undefined,
        };
      })
      .sort((a, b) => b.fame - a.fame);

    const updatedRankings: PlayerRanking[] = [];
    const nextPreviousRanks = new Map<string, number>();
    let computedUserRank: PlayerRanking | null = null;

    ranked.forEach((player, index) => {
      let rank = index + 1;
      if (player.id === user.id && higherRankCount != null) {
        rank = higherRankCount + 1;
      }
      const previousRank = previousRanks.get(player.id);
      let trend: PlayerRanking['trend'] = 'same';
      if (previousRank && previousRank !== rank) {
        trend = previousRank > rank ? 'up' : 'down';
      }
      const playerWithRank: PlayerRanking = { ...player, rank, trend };
      updatedRankings.push(playerWithRank);
      nextPreviousRanks.set(player.id, rank);
      if (player.id === user.id) {
        computedUserRank = playerWithRank;
      }
    });

    previousRankingsRef.current = nextPreviousRanks;
    setPlayerRankings(updatedRankings);
    setUserRank(computedUserRank);
  }, [user, profile]);

  const fetchCompetitions = useCallback(async () => {
    if (!user) {
      setCompetitions([]);
      setRegisteredCompetitions(new Set());
      return;
    }

    const { data: eventsData, error: eventsError } = await supabase
      .from('game_events')
      .select(
        'id, title, description, start_date, end_date, rewards, requirements, max_participants, current_participants, event_type, is_active'
      )
      .order('start_date', { ascending: true });

    if (eventsError) throw eventsError;

    const eventIds = (eventsData ?? []).map((event) => event.id).filter((id): id is string => Boolean(id));

    let participants: EventParticipantSummary[] = [];
    if (eventIds.length > 0) {
      const { data: participantsData, error: participantsError } = await supabase
        .from('event_participants')
        .select('event_id, user_id')
        .in('event_id', eventIds);

      if (participantsError) throw participantsError;
      participants = (participantsData ?? []) as EventParticipantSummary[];
    }

    const participantCounts = new Map<string, number>();
    const registeredSet = new Set<string>();

    participants.forEach((entry) => {
      participantCounts.set(entry.event_id, (participantCounts.get(entry.event_id) ?? 0) + 1);
      if (entry.user_id === user.id) {
        registeredSet.add(entry.event_id);
      }
    });

    const now = new Date();
    const competitionsData: Competition[] = (eventsData ?? []).map((event) => {
      const requirementEntries = Object.entries((event.requirements ?? {}) as Record<string, unknown>);
      const rewardEntries = Object.entries((event.rewards ?? {}) as Record<string, unknown>);

      const normalizedRequirements: Record<string, number> = {};
      let entryFee = 0;

      requirementEntries.forEach(([key, value]) => {
        if (key === 'entry_fee' || key === 'entryFee') {
          if (typeof value === 'number') {
            entryFee = value;
          } else if (typeof value === 'string') {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) {
              entryFee = parsed;
            }
          }
        } else if (typeof value === 'number') {
          normalizedRequirements[key] = value;
        } else if (typeof value === 'string') {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) {
            normalizedRequirements[key] = parsed;
          }
        }
      });

      let prizePool = 0;
      rewardEntries.forEach(([key, value]) => {
        if (key === 'prize_pool' || key === 'prizePool' || key === 'cash') {
          if (typeof value === 'number') {
            prizePool = value;
          } else if (typeof value === 'string') {
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) {
              prizePool = parsed;
            }
          }
        }
      });

      const participantsCount = participantCounts.get(event.id) ?? event.current_participants ?? 0;
      const maxParticipants =
        event.max_participants && event.max_participants > 0 ? event.max_participants : Math.max(participantsCount, 1);
      const startDate = new Date(event.start_date);
      const endDate = new Date(event.end_date);
      const isActive =
        typeof event.is_active === 'boolean' ? event.is_active : startDate <= now && endDate >= now;

      return {
        id: event.id,
        name: event.title,
        description: event.description ?? '',
        start_date: event.start_date,
        end_date: event.end_date,
        prize_pool: prizePool,
        entry_fee: entryFee,
        participants: participantsCount,
        max_participants: maxParticipants,
        category: event.event_type,
        requirements: normalizedRequirements,
        is_active: isActive,
        user_registered: registeredSet.has(event.id),
      };
    });

    setCompetitions(competitionsData);
    setRegisteredCompetitions(registeredSet);
  }, [user]);

  const loadCompetitiveData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      setPlayerRankings([]);
      setCompetitions([]);
      setUserRank(null);
      setRegisteredCompetitions(new Set());
      return;
    }

    try {
      setLoading(true);
      await Promise.all([fetchRankings(), fetchCompetitions(), fetchAchievements()]);
    } catch (error) {
      console.error('Error loading competitive data:', error);
      toast.error('Failed to load competitive data');
    } finally {
      setLoading(false);
    }
  }, [user, fetchRankings, fetchCompetitions, fetchAchievements]);

  useEffect(() => {
    loadCompetitiveData();
  }, [loadCompetitiveData]);

  useEffect(() => {
    previousRankingsRef.current = new Map();
  }, [user?.id]);

  const handleRankingRealtime = useCallback(() => {
    fetchRankings().catch((error) => console.error('Error refreshing rankings:', error));
  }, [fetchRankings]);

  const handleCompetitionRealtime = useCallback(() => {
    fetchCompetitions().catch((error) => console.error('Error refreshing competitions:', error));
  }, [fetchCompetitions]);

  useEffect(() => {
    if (!user) return;

    const rankingChannel = supabase
      .channel('global-rankings-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleRankingRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, handleRankingRealtime);

    const competitionsChannel = supabase
      .channel('competition-events-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_events' }, handleCompetitionRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_participants' }, handleCompetitionRealtime);

    rankingChannel.subscribe();
    competitionsChannel.subscribe();

    return () => {
      supabase.removeChannel(rankingChannel);
      supabase.removeChannel(competitionsChannel);
    };
  }, [user?.id, handleRankingRealtime, handleCompetitionRealtime]);

  const registerForCompetition = async (competitionId: string) => {
    if (!profile || !user) return;

    const competition = competitions.find((c) => c.id === competitionId);
    if (!competition) return;

    if (competition.user_registered || registeredCompetitions.has(competitionId)) {
      toast.info('You are already registered for this competition');
      return;
    }

    if (competition.participants >= competition.max_participants) {
      toast.error('This competition is already full');
      return;
    }

    const meetsRequirements = Object.entries(competition.requirements).every(([key, value]) => {
      const requiredValue = Number(value);
      if (Number.isNaN(requiredValue)) return true;
      if (key === 'level') return profile.level >= requiredValue;
      if (key === 'fame') return profile.fame >= requiredValue;
      if (skills && key in skills) {
        return (skills as Record<string, number>)[key] >= requiredValue;
      }
      return true;
    });

    if (!meetsRequirements) {
      toast.error("You don't meet the requirements for this competition");
      return;
    }

    if (profile.cash < competition.entry_fee) {
      toast.error('Insufficient funds for entry fee');
      return;
    }

    try {
      const { error } = await supabase.from('event_participants').insert({
        event_id: competitionId,
        user_id: user.id,
      });

      if (error) {
        if ((error as { code?: string }).code === '23505') {
          toast.info('You are already registered for this competition');
          return;
        }
        throw error;
      }

      setRegisteredCompetitions((prev) => {
        const updated = new Set(prev);
        updated.add(competitionId);
        return updated;
      });

      setCompetitions((prev) =>
        prev.map((c) =>
          c.id === competitionId
            ? {
                ...c,
                participants: Math.min(c.participants + 1, c.max_participants),
                user_registered: true,
              }
            : c
        )
      );

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
                    value={Math.min(
                      100,
                      (competition.participants / Math.max(competition.max_participants, 1)) * 100
                    )}
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