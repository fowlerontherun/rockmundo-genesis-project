import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfile } from '@/hooks/useActiveProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trophy, Target, Zap, Star, Music, RotateCcw, Home, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  type GameState,
  type XpRewardResult,
  calculateXpReward,
  INSTRUMENT_LABELS,
  DAILY_PRACTICE_XP_CAP,
} from '@/lib/minigames/stagePracticeTypes';

interface StagePracticeResultsProps {
  gameState: GameState;
  songTitle: string;
  instrumentSlug: string;
  skillLevel: number;
  songId: string;
  onPlayAgain: () => void;
  onExit: () => void;
}

export function StagePracticeResults({
  gameState,
  songTitle,
  instrumentSlug,
  skillLevel,
  songId,
  onPlayAgain,
  onExit,
}: StagePracticeResultsProps) {
  const { profileId } = useActiveProfile();
  const [xpResult, setXpResult] = useState<XpRewardResult | null>(null);
  const [saved, setSaved] = useState(false);

  // Fetch today's sessions for diminishing returns
  const { data: todayData } = useQuery({
    queryKey: ['practice-today', profileId],
    queryFn: async () => {
      if (!profileId) return { sessions: 0, xp: 0 };
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('stage_practice_sessions')
        .select('xp_earned')
        .eq('profile_id', profileId)
        .gte('played_at', today.toISOString());
      if (error) throw error;
      const sessions = data?.length || 0;
      const xp = data?.reduce((sum, s) => sum + (s.xp_earned || 0), 0) || 0;
      return { sessions, xp };
    },
    enabled: !!profileId,
  });

  // Calculate XP when today data loads
  useEffect(() => {
    if (todayData && !xpResult) {
      const result = calculateXpReward(
        gameState.level,
        gameState.accuracy,
        gameState.longestCombo,
        todayData.sessions,
        todayData.xp,
      );
      setXpResult(result);
    }
  }, [todayData, gameState, xpResult]);

  // Save session and award XP
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profileId || !xpResult || saved) return;

      // Save session
      await supabase.from('stage_practice_sessions').insert({
        user_id: profileId,
        profile_id: profileId,
        instrument_slug: instrumentSlug,
        song_id: songId.startsWith('default-') ? null : songId,
        song_title: songTitle,
        level_reached: gameState.level,
        score: gameState.score,
        accuracy_pct: gameState.accuracy,
        longest_combo: gameState.longestCombo,
        notes_hit: gameState.notesHit,
        notes_missed: gameState.notesMissed,
        xp_earned: xpResult.actualXpAwarded,
        difficulty: skillLevel <= 3 ? 'beginner' : skillLevel <= 8 ? 'intermediate' : skillLevel <= 14 ? 'advanced' : 'master',
      });

      // Award XP to instrument skill
      if (xpResult.actualXpAwarded > 0) {
        const { data: existingSkill } = await supabase
          .from('skill_progress')
          .select('id, current_xp, required_xp, current_level')
          .eq('profile_id', profileId)
          .eq('skill_slug', instrumentSlug)
          .single();

        if (existingSkill) {
          const newXp = (existingSkill.current_xp || 0) + xpResult.actualXpAwarded;
          const requiredXp = existingSkill.required_xp || 100;
          
          if (newXp >= requiredXp) {
            await supabase
              .from('skill_progress')
              .update({
                current_xp: newXp - requiredXp,
                current_level: (existingSkill.current_level || 0) + 1,
                required_xp: Math.round(requiredXp * 1.15),
                last_practiced_at: new Date().toISOString(),
              })
              .eq('id', existingSkill.id);
          } else {
            await supabase
              .from('skill_progress')
              .update({
                current_xp: newXp,
                last_practiced_at: new Date().toISOString(),
              })
              .eq('id', existingSkill.id);
          }
        }
      }

      setSaved(true);
    },
  });

  // Auto-save on mount
  useEffect(() => {
    if (xpResult && !saved && !saveMutation.isPending) {
      saveMutation.mutate();
    }
  }, [xpResult, saved, saveMutation]);

  const getGrade = () => {
    if (gameState.accuracy >= 95 && gameState.longestCombo >= 20) return { grade: 'S', color: 'text-yellow-400' };
    if (gameState.accuracy >= 85) return { grade: 'A', color: 'text-green-400' };
    if (gameState.accuracy >= 70) return { grade: 'B', color: 'text-blue-400' };
    if (gameState.accuracy >= 50) return { grade: 'C', color: 'text-orange-400' };
    return { grade: 'D', color: 'text-red-400' };
  };

  const { grade, color } = getGrade();

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Performance Grade */}
      <Card className="text-center">
        <CardContent className="pt-6 pb-4 space-y-2">
          <p className="text-sm text-muted-foreground">Performance Grade</p>
          <p className={`text-7xl font-black ${color}`}>{grade}</p>
          <p className="text-sm text-muted-foreground">{songTitle}</p>
          <Badge variant="outline">{INSTRUMENT_LABELS[instrumentSlug] || instrumentSlug}</Badge>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{gameState.level}</p>
            <p className="text-xs text-muted-foreground">Level Reached</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{gameState.accuracy}%</p>
            <p className="text-xs text-muted-foreground">Accuracy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Zap className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <p className="text-2xl font-bold">{gameState.longestCombo}</p>
            <p className="text-xs text-muted-foreground">Longest Combo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Trophy className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold">{gameState.score.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Hit Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Hit Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-yellow-400">Perfect</span>
            <span className="font-medium">{gameState.perfectHits}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-green-400">Good</span>
            <span className="font-medium">{gameState.goodHits}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-red-400">Missed</span>
            <span className="font-medium">{gameState.notesMissed}</span>
          </div>
        </CardContent>
      </Card>

      {/* XP Reward */}
      {xpResult && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              XP Reward
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Base XP</span>
              <span>+{xpResult.baseXp}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Level Bonus (Lvl {gameState.level} × 5)</span>
              <span>+{xpResult.levelBonus}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Accuracy Bonus ({gameState.accuracy}% × 0.5)</span>
              <span>+{xpResult.accuracyBonus}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Combo Bonus ({gameState.longestCombo} × 0.3)</span>
              <span>+{xpResult.comboBonus}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>XP Earned</span>
              <span className="text-primary">+{xpResult.actualXpAwarded} XP</span>
            </div>
            {xpResult.diminishingApplied && (
              <div className="flex items-center gap-1 text-xs text-orange-400">
                <AlertTriangle className="h-3 w-3" />
                Diminishing returns applied (multiple sessions today)
              </div>
            )}
            {xpResult.dailyCapHit && (
              <div className="flex items-center gap-1 text-xs text-orange-400">
                <AlertTriangle className="h-3 w-3" />
                Daily practice XP cap reached ({DAILY_PRACTICE_XP_CAP} XP/day)
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onExit}>
          <Home className="h-4 w-4 mr-2" />
          Exit
        </Button>
        <Button className="flex-1" onClick={onPlayAgain}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Practice Again
        </Button>
      </div>
    </div>
  );
}
