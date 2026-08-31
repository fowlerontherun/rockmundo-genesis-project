import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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

type PracticeReward = {
  sessions_today: number;
  xp_today: number;
  base_xp: number;
  level_bonus: number;
  accuracy_bonus: number;
  combo_bonus: number;
  total_xp: number;
  actual_xp_awarded: number;
  accuracy: number;
  level_reached: number;
  diminishing: boolean;
  daily_cap_hit: boolean;
};

type RpcError = { message?: string };
type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: RpcError | null }>;
};

const rpcClient = supabase as unknown as RpcClient;

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
  songId,
  onPlayAgain,
  onExit,
}: StagePracticeResultsProps) {
  const { profileId } = useActiveProfile();
  const [reward, setReward] = useState<PracticeReward | null>(null);
  const submittedRef = useRef(false);
  const coachingTips = useMemo(() => getCoaching(gameState), [gameState]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profileId) throw new Error('No active character selected.');
      const { data, error } = await rpcClient.rpc('submit_active_practice_session', {
        p_profile_id: profileId,
        p_instrument_slug: instrumentSlug,
        p_song_id: songId.startsWith('default-') ? null : songId,
        p_song_title: songTitle,
        p_level_reached: gameState.level,
        p_score: gameState.score,
        p_longest_combo: gameState.longestCombo,
        p_notes_hit: gameState.notesHit,
        p_notes_missed: gameState.notesMissed,
      });
      if (error) throw new Error(error.message || 'Could not save Active Practice');
      const result = data as PracticeReward;
      setReward(result);
      return result;
    },
  });

  useEffect(() => {
    if (!profileId || submittedRef.current) return;
    submittedRef.current = true;
    saveMutation.mutate();
  }, [profileId, saveMutation]);

  const retrySave = () => {
    submittedRef.current = true;
    saveMutation.mutate();
  };

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
        <Card><CardContent className="pb-3 pt-4 text-center"><TrendingUp className="mx-auto mb-1 h-5 w-5 text-primary" /><p className="text-2xl font-bold">{reward?.level_reached ?? gameState.level}</p><p className="text-xs text-muted-foreground">Level Reached</p></CardContent></Card>
        <Card><CardContent className="pb-3 pt-4 text-center"><Target className="mx-auto mb-1 h-5 w-5 text-green-500" /><p className="text-2xl font-bold">{reward?.accuracy ?? gameState.accuracy}%</p><p className="text-xs text-muted-foreground">Accuracy</p></CardContent></Card>
        <Card><CardContent className="pb-3 pt-4 text-center"><Zap className="mx-auto mb-1 h-5 w-5 text-orange-500" /><p className="text-2xl font-bold">{gameState.longestCombo}</p><p className="text-xs text-muted-foreground">Longest Combo</p></CardContent></Card>
        <Card><CardContent className="pb-3 pt-4 text-center"><Trophy className="mx-auto mb-1 h-5 w-5 text-yellow-500" /><p className="text-2xl font-bold">{gameState.score.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Score</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Hit Breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm"><span className="text-yellow-400">Perfect</span><span className="font-medium">{gameState.perfectHits}</span></div>
          <div className="flex justify-between text-sm"><span className="text-green-400">Good</span><span className="font-medium">{gameState.goodHits}</span></div>
          <div className="flex justify-between text-sm"><span className="text-red-400">Missed</span><span className="font-medium">{gameState.notesMissed}</span></div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Lightbulb className="h-4 w-4 text-yellow-500" />Session Coaching</CardTitle></CardHeader>
        <CardContent className="space-y-2">{coachingTips.map((tip) => <p key={tip} className="text-sm text-muted-foreground">• {tip}</p>)}</CardContent>
      </Card>

      {reward && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><Star className="h-4 w-4 text-yellow-500" />XP Reward</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Base XP</span><span>+{reward.base_xp}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Level Bonus</span><span>+{reward.level_bonus}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Accuracy Bonus</span><span>+{reward.accuracy_bonus}</span></div>
            <div className="flex justify-between text-xs text-muted-foreground"><span>Combo Bonus</span><span>+{reward.combo_bonus}</span></div>
            <Separator />
            <div className="flex justify-between font-bold"><span>XP Earned</span><span className="text-primary">+{reward.actual_xp_awarded} XP</span></div>
            <p className="text-xs text-muted-foreground">Today: {reward.sessions_today} session{reward.sessions_today === 1 ? '' : 's'} · {reward.xp_today}/{DAILY_PRACTICE_XP_CAP} XP</p>
            {reward.diminishing && <div className="flex items-center gap-1 text-xs text-orange-400"><AlertTriangle className="h-3 w-3" />Diminishing returns applied after repeated sessions today.</div>}
            {reward.daily_cap_hit && <div className="flex items-center gap-1 text-xs text-orange-400"><AlertTriangle className="h-3 w-3" />Daily practice XP cap reached ({DAILY_PRACTICE_XP_CAP} XP/day).</div>}
          </CardContent>
        </Card>
      )}

      {saveMutation.isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-2 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-2"><p>Your practice result could not be saved, so no XP has been applied yet.</p><Button size="sm" variant="outline" onClick={retrySave} disabled={saveMutation.isPending}>Retry save</Button></div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onExit}><Home className="mr-2 h-4 w-4" /> Exit</Button>
        <Button className="flex-1" onClick={onPlayAgain} disabled={saveMutation.isPending}><RotateCcw className="mr-2 h-4 w-4" /> Practice Again</Button>
      </div>
    </div>
  );
}
