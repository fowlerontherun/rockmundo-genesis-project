import { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Music, Zap, Star, Clock, CheckCircle2, XCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { awardActionXp } from "@/utils/progression";

interface JamRound {
  id: number;
  prompt: string;
  options: { label: string; score: number; groove: number }[];
  timeLimit: number;
}

interface JamResult {
  totalScore: number;
  grooveLevel: number;
  roundResults: { prompt: string; choice: string; score: number }[];
  xpAwarded: number;
  chemistryBonus: number;
}

const JAM_ROUNDS: JamRound[] = [
  {
    id: 1,
    prompt: "The bassist drops a funky groove. How do you respond?",
    options: [
      { label: "Mirror the rhythm and lock in", score: 90, groove: 15 },
      { label: "Add a complementary counter-melody", score: 80, groove: 10 },
      { label: "Take a solo over the top", score: 50, groove: -5 },
      { label: "Stay quiet and listen", score: 60, groove: 5 },
    ],
    timeLimit: 8,
  },
  {
    id: 2,
    prompt: "The drummer signals a tempo change. What do you do?",
    options: [
      { label: "Follow the new tempo smoothly", score: 85, groove: 12 },
      { label: "Resist and keep your tempo", score: 30, groove: -10 },
      { label: "Gradually transition over 4 bars", score: 95, groove: 18 },
      { label: "Stop playing and re-enter", score: 55, groove: 0 },
    ],
    timeLimit: 6,
  },
  {
    id: 3,
    prompt: "Someone hits a wrong note. The room tenses up.",
    options: [
      { label: "Turn it into a jazz chord", score: 95, groove: 20 },
      { label: "Ignore it and keep playing", score: 70, groove: 5 },
      { label: "Stop and restart the section", score: 40, groove: -8 },
      { label: "Smile and nod encouragingly", score: 75, groove: 10 },
    ],
    timeLimit: 5,
  },
  {
    id: 4,
    prompt: "The energy peaks! Everyone's feeling it.",
    options: [
      { label: "Build intensity with dynamics", score: 90, groove: 15 },
      { label: "Hold the energy steady", score: 70, groove: 8 },
      { label: "Go all-out maximum volume", score: 55, groove: -3 },
      { label: "Drop to pianissimo for contrast", score: 85, groove: 12 },
    ],
    timeLimit: 7,
  },
  {
    id: 5,
    prompt: "Time for the big finish. How do you wrap it up?",
    options: [
      { label: "Eye contact and hit the final chord together", score: 100, groove: 25 },
      { label: "Gradual fadeout", score: 75, groove: 10 },
      { label: "Dramatic stop on the one", score: 90, groove: 18 },
      { label: "Keep going — don't stop the vibe!", score: 45, groove: -5 },
    ],
    timeLimit: 8,
  },
];

interface JamSessionGameplayProps {
  sessionId: string;
  sessionName: string;
  genre: string;
  userId: string;
  bandId?: string;
  onComplete: () => void;
}

export function JamSessionGameplay({
  sessionId,
  sessionName,
  genre,
  userId,
  bandId,
  onComplete,
}: JamSessionGameplayProps) {
  const [currentRound, setCurrentRound] = useState(0);
  const [groove, setGroove] = useState(50);
  const [roundResults, setRoundResults] = useState<JamResult["roundResults"]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState<JamResult | null>(null);
  const [saving, setSaving] = useState(false);

  const round = JAM_ROUNDS[currentRound];

  // Shuffle options per round for variety
  const shuffledOptions = useMemo(() => {
    if (!round) return [];
    return [...round.options].sort(() => Math.random() - 0.5);
  }, [currentRound, round]);

  // Timer
  useEffect(() => {
    if (!isPlaying || !round) return;
    setTimeRemaining(round.timeLimit);

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentRound, isPlaying]);

  const handleTimeout = useCallback(() => {
    if (!round) return;
    setRoundResults((prev) => [...prev, { prompt: round.prompt, choice: "Timed out", score: 20 }]);
    setGroove((prev) => Math.max(0, prev - 10));
    advanceRound();
  }, [round]);

  const handleChoice = (option: { label: string; score: number; groove: number }) => {
    if (!round) return;
    setRoundResults((prev) => [...prev, { prompt: round.prompt, choice: option.label, score: option.score }]);
    setGroove((prev) => Math.min(100, Math.max(0, prev + option.groove)));
    advanceRound();
  };

  const advanceRound = () => {
    if (currentRound < JAM_ROUNDS.length - 1) {
      setCurrentRound((prev) => prev + 1);
    } else {
      finishJam();
    }
  };

  const startJam = () => {
    setIsPlaying(true);
    setCurrentRound(0);
    setGroove(50);
    setRoundResults([]);
    setResult(null);
  };

  const finishJam = async () => {
    setIsPlaying(false);
    setSaving(true);

    const allResults = [...roundResults];
    // Include last round if not already counted (timing edge case)
    const totalScore = Math.round(
      allResults.reduce((sum, r) => sum + r.score, 0) / Math.max(allResults.length, 1)
    );
    const xpBase = Math.round(totalScore * 0.8 + groove * 0.5);
    const chemistryBonus = groove >= 70 ? 3 : groove >= 50 ? 1 : 0;

    try {
      // Award XP through progression system
      await awardActionXp({
        amount: xpBase,
        category: "performance",
        actionKey: "jam_session",
        metadata: { sessionId, genre, score: totalScore, groove },
      });

      // Award chemistry bonus if in a band
      if (bandId && chemistryBonus > 0) {
        const { data: band } = await supabase
          .from("bands")
          .select("chemistry_level")
          .eq("id", bandId)
          .single();

        if (band) {
          await supabase
            .from("bands")
            .update({ chemistry_level: Math.min(100, (band.chemistry_level ?? 50) + chemistryBonus) })
            .eq("id", bandId);
        }
      }

      setResult({
        totalScore,
        grooveLevel: groove,
        roundResults: allResults,
        xpAwarded: xpBase,
        chemistryBonus,
      });
    } catch (err) {
      console.error("Failed to save jam results:", err);
      toast.error("Failed to save jam results");
    } finally {
      setSaving(false);
    }
  };

  // Pre-game
  if (!isPlaying && !result) {
    return (
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            Jam Session: {sessionName}
          </CardTitle>
          <CardDescription>
            {genre} groove — React to musical cues, keep the groove alive, and build chemistry with your fellow musicians.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground space-y-2">
            <p>🎵 <strong>5 rounds</strong> of musical decisions</p>
            <p>⏱️ Each round is <strong>timed</strong> — react fast!</p>
            <p>🎯 Build <strong>groove</strong> by making choices that complement the group</p>
            <p>⭐ Earn <strong>XP and chemistry bonuses</strong> based on your performance</p>
          </div>
          <Button onClick={startJam} className="w-full" size="lg">
            <Zap className="mr-2 h-4 w-4" /> Start Jamming
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Results
  if (result) {
    const grade = result.totalScore >= 85 ? "S" : result.totalScore >= 70 ? "A" : result.totalScore >= 55 ? "B" : result.totalScore >= 40 ? "C" : "D";
    const gradeColors: Record<string, string> = {
      S: "text-yellow-500",
      A: "text-emerald-500",
      B: "text-blue-500",
      C: "text-orange-500",
      D: "text-rose-500",
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Jam Complete!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <p className={cn("text-5xl font-bold", gradeColors[grade])}>{grade}</p>
              <p className="text-sm text-muted-foreground">Grade</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">{result.totalScore}</p>
              <p className="text-sm text-muted-foreground">Score</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">{result.grooveLevel}%</p>
              <p className="text-sm text-muted-foreground">Groove</p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border p-3 text-sm">
              <Star className="h-4 w-4 text-primary inline mr-1" />
              <strong>+{result.xpAwarded} XP</strong> earned
            </div>
            {result.chemistryBonus > 0 && (
              <div className="rounded-lg border p-3 text-sm">
                <Zap className="h-4 w-4 text-yellow-500 inline mr-1" />
                <strong>+{result.chemistryBonus}</strong> band chemistry
              </div>
            )}
          </div>

          <div className="space-y-2">
            {result.roundResults.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {r.score >= 70 ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-500 shrink-0" />
                )}
                <span className="text-muted-foreground truncate">{r.choice}</span>
                <Badge variant="outline" className="ml-auto shrink-0">{r.score}</Badge>
              </div>
            ))}
          </div>

          <Button onClick={onComplete} variant="outline" className="w-full">
            Return to Sessions
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Active gameplay
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Round {currentRound + 1} / {JAM_ROUNDS.length}</CardTitle>
          <div className="flex items-center gap-2">
            <Clock className={cn("h-4 w-4", timeRemaining <= 3 ? "text-destructive animate-pulse" : "text-muted-foreground")} />
            <span className={cn("font-mono text-lg font-bold", timeRemaining <= 3 && "text-destructive")}>
              {timeRemaining}s
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Groove</span>
            <span className="font-medium">{groove}%</span>
          </div>
          <Progress value={groove} className="h-3" />
        </div>

        <p className="text-lg font-medium">{round?.prompt}</p>

        <div className="grid gap-2">
          {shuffledOptions.map((option, i) => (
            <Button
              key={i}
              variant="outline"
              className="h-auto py-3 px-4 text-left justify-start whitespace-normal"
              onClick={() => handleChoice(option)}
              disabled={saving}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
