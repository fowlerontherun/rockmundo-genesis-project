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
  score: number;
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
  is_completed: boolean;
  user_registered: boolean;
  status: 'upcoming' | 'active' | 'completed';
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

type CompetitionRow = Database['public']['Tables']['competitions']['Row'];
type CompetitionParticipantRow = Database['public']['Tables']['competition_participants']['Row'];
type PlayerRankingRow = Database['public']['Tables']['player_rankings']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type CompetitionWithParticipants = CompetitionRow & {
  competition_participants: CompetitionParticipantRow[] | null;
};

const CompetitiveCharts: React.FC = () => {
  const { user } = useAuth();
  const { profile, skills, refetch: refetchGameData } = useGameData();
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

    try {
      const previousRanks = previousRankingsRef.current;

      const { data, error } = await supabase
        .from('player_rankings')
        .select(
          'id, rank, trend, total_plays, hit_songs, score, profile:profiles!inner(id, user_id, username, display_name, level, fame, avatar_url)'
        )
        .eq('ranking_type', 'global')
        .order('rank', { ascending: true })
        .limit(50);

      if (error) throw error;

      const rankingRows = (data ?? []) as (PlayerRankingRow & { profile: ProfileRow | null })[];

      const mapped = rankingRows.map((row) => {
        const profileData = row.profile;
        const baseTrend =
          row.trend === 'up' || row.trend === 'down' || row.trend === 'same'
            ? (row.trend as PlayerRanking['trend'])
            : 'same';
        const playerId = profileData?.user_id ?? profileData?.id ?? row.id;

        return {
          id: playerId,
          username: profileData?.username ?? 'player',
          display_name: profileData?.display_name ?? profileData?.username ?? 'Unknown Artist',
          level: profileData?.level ?? 1,
          fame: profileData?.fame ?? 0,
          score: Number(row.score ?? row.total_plays ?? 0),
          total_plays: Number(row.total_plays ?? 0),
          hit_songs: row.hit_songs ?? 0,
          rank: row.rank ?? 0,
          trend: baseTrend,
          avatar_url: profileData?.avatar_url ?? undefined,
        } satisfies PlayerRanking;
      });

      const updatedRankings: PlayerRanking[] = [];
      const nextPreviousRanks = new Map<string, number>();

      mapped.forEach((player) => {
        const previousRank = previousRanks.get(player.id);
        let trend: PlayerRanking['trend'] = player.trend;
        if (previousRank && previousRank !== player.rank) {
          trend = previousRank > player.rank ? 'up' : 'down';
        }
        const playerWithTrend: PlayerRanking = { ...player, trend };
        updatedRankings.push(playerWithTrend);
        if (player.rank > 0) {
          nextPreviousRanks.set(player.id, player.rank);
        }
      });

      let computedUserRank =
        updatedRankings.find((entry) => entry.id === user.id || entry.id === profile?.id) ?? null;

      if (!computedUserRank && profile?.id) {
        const { data: userRankingData, error: userRankingError } = await supabase
          .from('player_rankings')
          .select(
            'id, rank, trend, total_plays, hit_songs, score, profile:profiles!inner(id, user_id, username, display_name, level, fame, avatar_url)'
          )
          .eq('ranking_type', 'global')
          .eq('profile_id', profile.id)
          .maybeSingle();

        if (userRankingError) {
          console.error('Error fetching user ranking:', userRankingError);
        }

        if (userRankingData && userRankingData.profile) {
          const profileData = userRankingData.profile as ProfileRow;
          const fallbackTrend =
            userRankingData.trend === 'up' || userRankingData.trend === 'down'
              ? (userRankingData.trend as PlayerRanking['trend'])
              : 'same';

          computedUserRank = {
            id: profileData.user_id ?? profileData.id ?? userRankingData.id,
            username: profileData.username ?? 'player',
            display_name: profileData.display_name ?? profileData.username ?? 'Unknown Artist',
            level: profileData.level ?? 1,
            fame: profileData.fame ?? 0,
            score: Number(userRankingData.score ?? userRankingData.total_plays ?? 0),
            total_plays: Number(userRankingData.total_plays ?? 0),
            hit_songs: userRankingData.hit_songs ?? 0,
            rank: userRankingData.rank ?? 0,
            trend: fallbackTrend,
            avatar_url: profileData.avatar_url ?? undefined,
          };
          if (computedUserRank.rank > 0) {
            nextPreviousRanks.set(computedUserRank.id, computedUserRank.rank);
          }
          updatedRankings.push(computedUserRank);
        } else if (profile) {
          computedUserRank = {
            id: user.id,
            username: profile.username,
            display_name: profile.display_name,
            level: profile.level,
            fame: profile.fame,
            score: profile.fame,
            total_plays: 0,
            hit_songs: 0,
            rank: 0,
            trend: 'same',
            avatar_url: profile.avatar_url ?? undefined,
          };
        }
      }

      previousRankingsRef.current = nextPreviousRanks;
      setPlayerRankings(updatedRankings);
      setUserRank(computedUserRank);
    } catch (error) {
      console.error('Error fetching player rankings:', error);
      setPlayerRankings([]);
      setUserRank(null);
      previousRankingsRef.current = new Map();
    }
  }, [
    user?.id,
    profile?.id,
    profile?.username,
    profile?.display_name,
    profile?.level,
    profile?.fame,
    profile?.avatar_url,
  ]);

  const finalizeCompetition = useCallback(async (competition: CompetitionWithParticipants) => {
    try {
      const endDate = new Date(competition.end_date);
      const now = new Date();
      if (Number.isNaN(endDate.getTime()) || endDate > now) {
        return false;
      }

      const { data: participantRows, error: participantsError } = await supabase
        .from('competition_participants')
        .select('id, profile_id, score, final_rank, prize_amount, awarded_at')
        .eq('competition_id', competition.id);

      if (participantsError) throw participantsError;

      const participants = (participantRows ?? []) as CompetitionParticipantRow[];

      if (participants.length === 0) {
        if (competition.is_completed && !competition.is_active) {
          return false;
        }

        const { error: updateCompetitionError } = await supabase
          .from('competitions')
          .update({
            is_active: false,
            is_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', competition.id);

        if (updateCompetitionError) throw updateCompetitionError;
        return true;
      }

      const alreadyFinalized = participants.every((participant) => participant.final_rank != null);
      if (alreadyFinalized && competition.is_completed) {
        return false;
      }

      const sortedParticipants = [...participants].sort(
        (a, b) => Number(b.score ?? 0) - Number(a.score ?? 0)
      );

      const prizePool = Math.max(Number(competition.prize_pool ?? 0), 0);
      const distribution = [0.5, 0.3, 0.2];
      const rawPrizes = distribution.map((share) => prizePool * share);
      let remainingPrize = Math.round(prizePool);
      const roundedPrizes = rawPrizes.map((value) => {
        const rounded = Math.round(value);
        remainingPrize -= rounded;
        return rounded;
      });
      if (remainingPrize !== 0 && roundedPrizes.length > 0) {
        roundedPrizes[0] += remainingPrize;
      }

      const awardTimestamp = new Date().toISOString();

      const updates = sortedParticipants.map((participant, index) => ({
        id: participant.id,
        final_rank: index + 1,
        prize_amount: index < roundedPrizes.length ? Math.max(roundedPrizes[index], 0) : 0,
        awarded_at: awardTimestamp,
      }));

      const { error: updateParticipantsError } = await supabase
        .from('competition_participants')
        .upsert(updates);

      if (updateParticipantsError) throw updateParticipantsError;

      const { error: updateCompetitionError } = await supabase
        .from('competitions')
        .update({
          is_active: false,
          is_completed: true,
          updated_at: awardTimestamp,
        })
        .eq('id', competition.id);

      if (updateCompetitionError) throw updateCompetitionError;

      return true;
    } catch (error) {
      console.error('Error finalizing competition:', error);
      return false;
    }
  }, []);

  const fetchCompetitions = useCallback(async () => {
    if (!user) {
      setCompetitions([]);
      setRegisteredCompetitions(new Set());
      return;
    }

    const loadCompetitions = async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('*, competition_participants (id, profile_id, score, final_rank, prize_amount, awarded_at)')
        .order('start_date', { ascending: true });

      if (error) throw error;
      return (data ?? []) as CompetitionWithParticipants[];
    };

    try {
      const initialCompetitions = await loadCompetitions();
      const now = new Date();

      const competitionsNeedingFinalization = initialCompetitions.filter((competition) => {
        const endDate = new Date(competition.end_date);
        return (
          !competition.is_completed &&
          !Number.isNaN(endDate.getTime()) &&
          endDate <= now
        );
      });

      if (competitionsNeedingFinalization.length > 0) {
        await Promise.all(competitionsNeedingFinalization.map((competition) => finalizeCompetition(competition)));
      }

      const competitionsAfterFinalization =
        competitionsNeedingFinalization.length > 0 ? await loadCompetitions() : initialCompetitions;

      const registeredSet = new Set<string>();

      const competitionsData: Competition[] = competitionsAfterFinalization.map((competition) => {
        const participants = competition.competition_participants ?? [];
        const participantCount = participants.length;
        const userRegistered =
          Boolean(profile?.id) &&
          participants.some((participant) => participant.profile_id === profile?.id);
        if (userRegistered) {
          registeredSet.add(competition.id);
        }

        const requirementsRecord: Record<string, number> = {};
        if (
          competition.requirements &&
          typeof competition.requirements === 'object' &&
          !Array.isArray(competition.requirements)
        ) {
          Object.entries(competition.requirements as Record<string, unknown>).forEach(([key, value]) => {
            const numericValue = Number(value);
            if (!Number.isNaN(numericValue)) {
              requirementsRecord[key] = numericValue;
            }
          });
        }

        const maxParticipants =
          competition.max_participants && competition.max_participants > 0
            ? competition.max_participants
            : Math.max(participantCount, 1);

        const startDate = new Date(competition.start_date);
        const endDate = new Date(competition.end_date);
        const hasStarted = !Number.isNaN(startDate.getTime()) && startDate <= now;
        const hasEnded = !Number.isNaN(endDate.getTime()) && endDate < now;

        const isCompleted = competition.is_completed || hasEnded;
        const isActive = competition.is_active && !isCompleted;
        const status: Competition['status'] =
          isCompleted ? 'completed' : hasStarted && isActive ? 'active' : 'upcoming';

        return {
          id: competition.id,
          name: competition.name,
          description: competition.description ?? '',
          start_date: competition.start_date,
          end_date: competition.end_date,
          prize_pool: Number(competition.prize_pool ?? 0),
          entry_fee: Number(competition.entry_fee ?? 0),
          participants: participantCount,
          max_participants: maxParticipants,
          category: competition.category ?? 'general',
          requirements: requirementsRecord,
          is_active: isActive,
          is_completed: isCompleted,
          user_registered: userRegistered,
          status,
        };
      });

      setCompetitions(competitionsData);
      setRegisteredCompetitions(registeredSet);
    } catch (error) {
      console.error('Error fetching competitions:', error);
      toast.error('Failed to load competitions');
    }
  }, [user, profile?.id, finalizeCompetition]);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_rankings' }, handleRankingRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, handleRankingRealtime);

    const competitionsChannel = supabase
      .channel('competition-events-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competitions' }, handleCompetitionRealtime)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_participants' }, handleCompetitionRealtime);

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

    const now = new Date();
    const endDate = new Date(competition.end_date);
    if (competition.is_completed || endDate < now) {
      toast.error('This competition has already ended');
      return;
    }

    if (competition.user_registered || registeredCompetitions.has(competitionId)) {
      toast.info('You are already registered for this competition');
      return;
    }

    if (competition.participants >= competition.max_participants) {
      toast.error('This competition is already full');
      return;
    }

    if (!competition.is_active) {
      toast.error('Registration is closed for this competition');
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
      let participantScore = profile.fame;

      const { data: rankingScore, error: rankingError } = await supabase
        .from('player_rankings')
        .select('score')
        .eq('profile_id', profile.id)
        .eq('ranking_type', 'global')
        .maybeSingle();

      if (rankingError) {
        console.error('Error loading player score for competition:', rankingError);
      }

      if (rankingScore?.score != null) {
        const parsedScore = Number(rankingScore.score);
        if (!Number.isNaN(parsedScore)) {
          participantScore = parsedScore;
        }
      }

      const { error } = await supabase.from('competition_participants').insert({
        competition_id: competitionId,
        profile_id: profile.id,
        score: participantScore,
      });

      if (error) {
        if ((error as { code?: string }).code === '23505') {
          toast.info('You are already registered for this competition');
          return;
        }
        throw error;
      }

      if (competition.entry_fee > 0) {
        const newBalance = Math.max((profile.cash ?? 0) - competition.entry_fee, 0);
        const { error: balanceError } = await supabase
          .from('profiles')
          .update({ cash: newBalance })
          .eq('id', profile.id);

        if (balanceError) throw balanceError;
      }

      if (typeof refetchGameData === 'function') {
        await refetchGameData();
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
    } catch (error: unknown) {
      const fallbackMessage = 'Failed to register for competition';
      const errorMessage = error instanceof Error ? error.message : fallbackMessage;
      console.error('Error registering for competition:', errorMessage, error);
      toast.error(errorMessage === fallbackMessage ? fallbackMessage : `${fallbackMessage}: ${errorMessage}`);
    }
  };

  const leaveCompetition = async (competitionId: string) => {
    if (!profile || !user) return;

    const competition = competitions.find((c) => c.id === competitionId);
    if (!competition) return;

    if (!competition.user_registered && !registeredCompetitions.has(competitionId)) {
      toast.info("You're not registered for this competition");
      return;
    }

    const startDate = new Date(competition.start_date);
    const now = new Date();
    if (startDate <= now) {
      toast.error('You can no longer leave this competition');
      return;
    }

    try {
      const { error } = await supabase
        .from('competition_participants')
        .delete()
        .eq('competition_id', competitionId)
        .eq('profile_id', profile.id);

      if (error) throw error;

      if (competition.entry_fee > 0) {
        const { error: refundError } = await supabase
          .from('profiles')
          .update({ cash: (profile.cash ?? 0) + competition.entry_fee })
          .eq('id', profile.id);

        if (refundError) throw refundError;
      }

      if (typeof refetchGameData === 'function') {
        await refetchGameData();
      }

      setRegisteredCompetitions((prev) => {
        const updated = new Set(prev);
        updated.delete(competitionId);
        return updated;
      });

      setCompetitions((prev) =>
        prev.map((c) =>
          c.id === competitionId
            ? {
                ...c,
                participants: Math.max(c.participants - 1, 0),
                user_registered: false,
              }
            : c
        )
      );

      toast.success(`Left ${competition.name}`);
    } catch (error) {
      console.error('Error leaving competition:', error);
      toast.error('Failed to leave competition');
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
            {competitions.map((competition) => {
              const now = new Date();
              const startDate = new Date(competition.start_date);
              const endDate = new Date(competition.end_date);
              const hasStarted = !Number.isNaN(startDate.getTime()) && startDate <= now;
              const hasEnded = !Number.isNaN(endDate.getTime()) && endDate < now;
              const statusLabel =
                competition.status === 'completed'
                  ? 'Completed'
                  : competition.status === 'active'
                  ? 'Active'
                  : 'Starting Soon';
              const badgeVariant =
                competition.status === 'active'
                  ? 'default'
                  : competition.status === 'completed'
                  ? 'outline'
                  : 'secondary';
              const borderClass =
                competition.status === 'active'
                  ? 'border-green-500/30'
                  : competition.status === 'completed'
                  ? 'border-slate-500/30'
                  : 'border-orange-500/30';
              const canLeave = competition.user_registered && !hasStarted;
              const canJoin =
                !competition.user_registered &&
                competition.is_active &&
                !hasEnded &&
                competition.status !== 'completed';
              const buttonDisabled =
                competition.status === 'completed' ||
                (competition.user_registered
                  ? !canLeave
                  : !canJoin || competition.participants >= competition.max_participants);
              const buttonLabel = competition.user_registered
                ? canLeave
                  ? 'Leave Competition'
                  : 'Registered'
                : competition.status === 'completed'
                ? 'Completed'
                : competition.participants >= competition.max_participants
                ? 'Full'
                : competition.is_active
                ? 'Join Competition'
                : 'Registration Closed';
              const handleAction = competition.user_registered ? leaveCompetition : registerForCompetition;

              return (
                <Card key={competition.id} className={borderClass}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{competition.name}</CardTitle>
                      <Badge variant={badgeVariant}>{statusLabel}</Badge>
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
                      onClick={() => handleAction(competition.id)}
                      disabled={buttonDisabled}
                      className="w-full"
                    >
                      {buttonLabel}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
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