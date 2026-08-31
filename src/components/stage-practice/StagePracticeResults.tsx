import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfile } from '@/hooks/useActiveProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  Clock3,
  Home,
  Lightbulb,
  RotateCcw,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
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

function formatDuration(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function getCoaching(gameState: GameState) {
  const tips: string[] = [];

  if (gameState.accuracy < 65) {
    tips.push('Slow the session down and prioritise clean timing over chasing combos.');
  } else if (gameState.accuracy < 85) {
    tips.push('Your timing is developing well. Aim for fewer misses before pushing for a longer combo.');
  } else {
    tips.push('Strong timing. Push for longer clean streaks and more Perfect hits next session.');
  }

  if (gameState.longestCombo < 8) {
    tips.push('Focus on one lane change at a time and reset quickly after a miss.');
  } else if (gameState.longestCombo >= 20) {
    tips.push('Excellent consistency — try a harder instrument level or faster practice track next.');
  }

  const totalHits = gameState.perfectHits + gameState.goodHits;
  if (totalHits > 0 && gameState.perfectHits / totalHits < 0.35) {
    tips.push('You are landing notes, but many are outside the Perfect window. Watch the hit line rather than the falling note itself.');
  }

  return tips.slice(0, 3);
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

  const coachingTips = useMemo(() => getCoaching(gameState), [gameState]);

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
      return {
        sessions: data?.length || 0,
        xp: data?.reduce((sum, session) => sum + (session.xp_earned || 0), 0) || 0,
      };
    },
    enabled: !!profileId,
  });

  useEffect(() => {
    if (!todayData || xpResult) return;

    setXpResult(
      calculateXpReward(
        gameState.level,
        gameState.accuracy,
        gameState.longestCombo,
        todayData.sessions,
        todayData.xp,
      ),
    );
  }, [todayData, gameState, xpResult]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profileId || !xpResult || saved) return;

      const { error: sessionError } = await supabase.from('stage_practice_sessions').insert({
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
        difficulty:
          skillLevel <= 3
            ? 'beginner'
            : skillLevel <= 8
              ? 'intermediate'
              : skillLevel <= 14
                ? 'advanced'
                : 'master',
      });

      if (sessionError) throw sessionError;

      if (xpResult.actualXpAwarded > 0) {
        const { data: existingSkill, error: skillFetchError } = await supabase
          .from('skill_progress')
          .select('id, current_xp, required_xp, current_level')
          .eq('profile_id', profileId)
          .eq('skill_slug', instrumentSlug)
          .maybeSingle();

        if (skillFetchError) throw skillFetchError;

        if (existingSkill) {
          let newXp = (existingSkill.current_xp || 0) + xpResult.actualXpAwarded;
          let requiredXp = existingSkill.required_xp || 100;
          let newLevel = existingSkill.current_level || 0;

          // Handle rewards large enough to cross more than one level boundary.
          while (newXp >= requiredXp) {
            newXp -= requiredXp;
            newLevel += 1;
            requiredXp = Math.round(requiredXp * 1.15);
          }

          const { error: skillUpdateError } = await supabase
            .from('skill_progress')
            .update({
              current_xp: newXp,
              current_level: newLevel,
              required_xp: requiredXp,
              last_practiced_at: new Date().toISOString(),
            })
            .eq('id', existingSkill.id);

          if (skillUpdateError) throw skillUpdateError;
        }
      }

      setSaved(true);
    },
  });

  useEffect(() => {
    if (xpResult && !saved && !saveMutation.isPending && !saveMutation.isError) {
      saveMutation.mutate();
    }
  }, [xpResult, saved, saveMutation]);

  const grade = useMemo(() => {
    if (gameState.accuracy >= 95 && gameState.longestCombo >= 20) return { grade: 'S', color: 'text-yellow-400' };
    if (gameState.accuracy >= 85) return { grade: 'A', color: 'text-green-400' };
    if (gameState.accuracy >= 70) return { grade: 'B', color: 'text-blue-400' };
    if (gameState.accuracy >= 50) return { grade: 'C', color: 'text-orange-400' };
    return { grade: 'D', color: 'text-red-400' };
  }, [gameState.accuracy, gameState.longestCombo]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Card className="text-center">
        <CardContent className="space-y-2 pb-4 pt-6">
          <p className="text-sm text-muted-foreground">Active Practice Complete</p>
          <p className={`text-7xl font-black ${grade.color}`}>{grade.grade}</p>
          <p className="text-sm text-muted-foreground">{songTitle}</p>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline">{INSTRUMENT_LABELS[instrumentSlug] || instrumentSlug}</Badge>
            <Badge variant="secondary" className="gap-1">
              <Clock3 className="h-3 w-3" />
              {formatDuration(gameState.elapsedMs)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pb-3 pt-4 text-center">
            <TrendingUp className="mx-auto mb-1 h-5 w-5 text-primary" />
            <p className="text-2xl font-bold">{gameState.level}</p>
            <p className="text-xs text-muted-foreground">Level Reached</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-3 pt-4 text-center">
            <Target className="mx-auto mb-1 h-5 w-5 text-green-500" />
            <p className="text-2xl font-bold">{gameState.accuracy}%</p>
            <p className="text-xs text-muted-foreground">Accuracy</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-3 pt-4 text-center">
            <Zap className="mx-auto mb-1 h-5 w-5 text-orange-500" />
            <p className="text-2xl font-bold">{gameState.longestCombo}</p>
            <p className="text-xs text-muted-foreground">Longest Combo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pb-3 pt-4 text-center">
            <Trophy className="mx-auto mb-1 h-5 w-5 text-yellow-500" />
            <p className="text-2xl font-bold">{gameState.score.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Score</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Hit Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm"><span className="text-yellow-400">Perfect</span><span className="font-medium">{gameState.perfectHits}</span></div>
          <div className="flex justify-between text-sm"><span className="text-green-400">Good</span><span className="font-medium">{gameState.goodHits}</span></div>
          <div className="flex justify-between text-sm"><span className="text-red-400">Missed</span><span className="font-medium">{gameState.notesMissed}</span></div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Session Coaching
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {coachingTips.map((tip) => (
            <p key={tip} className="text-sm text-muted-foreground">• {tip}</p>
          ))}
        </CardContent>
      </Card>

      {xpResult && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 text-yellow-500" />
              XP Reward
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Base XP</span><span>+{xpResult.baseXp}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Level Bonus (Lvl {gameState.level} × 12)</span><span>+{xpResult.levelBonus}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Accuracy Bonus ({gameState.accuracy}% × 0.6)</span><span>+{xpResult.accuracyBonus}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Combo Bonus ({gameState.longestCombo} × 0.5)</span><span>+{xpResult.comboBonus}</span></div>
            <Separator />
            <div className="flex justify-between font-bold"><span>XP Earned</span><span className="text-primary">+{xpResult.actualXpAwarded} XP</span></div>
            {xpResult.diminishingApplied && (
              <div className="flex items-center gap-1 text-xs text-orange-400">
                <AlertTriangle className="h-3 w-3" />
                Diminishing returns applied after repeated sessions today.
              </div>
            )}
            {xpResult.dailyCapHit && (
              <div className="flex items-center gap-1 text-xs text-orange-400">
                <AlertTriangle className="h-3 w-3" />
                Daily practice XP cap reached ({DAILY_PRACTICE_XP_CAP} XP/day).
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {saveMutation.isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-2 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-2">
              <p>Your practice result could not be saved, so no XP has been applied yet.</p>
              <Button size="sm" variant="outline" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                Retry save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onExit}>
          <Home className="mr-2 h-4 w-4" /> Exit
        </Button>
        <Button className="flex-1" onClick={onPlayAgain}>
          <RotateCcw className="mr-2 h-4 w-4" /> Practice Again
        </Button>
      </div>
    </div>
  );
}
