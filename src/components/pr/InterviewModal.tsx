import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useInterviewSession } from "@/hooks/useInterviewSession";
import { Mic, Tv, Radio, Newspaper, Globe, BookOpen, Clock, Zap, Users, DollarSign, Star, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const mediaIcons: Record<string, typeof Mic> = {
  podcast: Mic,
  tv: Tv,
  radio: Radio,
  newspaper: Newspaper,
  internet: Globe,
  magazine: BookOpen,
};

const optionLabels = ["A", "B", "C", "D"] as const;
const optionKeys = ["a", "b", "c", "d"] as const;
const optionColors = [
  "border-green-500/50 hover:bg-green-500/10",
  "border-blue-500/50 hover:bg-blue-500/10",
  "border-yellow-500/50 hover:bg-yellow-500/10",
  "border-red-500/50 hover:bg-red-500/10",
];
const optionBadgeColors = [
  "bg-green-500/20 text-green-400",
  "bg-blue-500/20 text-blue-400",
  "bg-yellow-500/20 text-yellow-400",
  "bg-red-500/20 text-red-400",
];

const EffectBadges = ({ effects }: { effects: Record<string, unknown> }) => {
  const items: { label: string; value: string; positive: boolean; icon: typeof Star }[] = [];
  const fame = effects.fame_mult as number;
  const fan = effects.fan_mult as number;
  const cash = effects.cash_mult as number;
  const rep = effects.reputation as Record<string, number> | undefined;

  if (fame && fame !== 1) items.push({ label: "Fame", value: fame > 1 ? `+${Math.round((fame - 1) * 100)}%` : `${Math.round((fame - 1) * 100)}%`, positive: fame > 1, icon: Star });
  if (fan && fan !== 1) items.push({ label: "Fans", value: fan > 1 ? `+${Math.round((fan - 1) * 100)}%` : `${Math.round((fan - 1) * 100)}%`, positive: fan > 1, icon: Users });
  if (cash && cash !== 1) items.push({ label: "Cash", value: cash > 1 ? `+${Math.round((cash - 1) * 100)}%` : `${Math.round((cash - 1) * 100)}%`, positive: cash > 1, icon: DollarSign });
  if (rep) {
    Object.entries(rep).forEach(([k, v]) => {
      if (v !== 0) items.push({ label: k, value: v > 0 ? `+${v}` : `${v}`, positive: v > 0, icon: Zap });
    });
  }

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {items.map((item) => (
        <span key={item.label} className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", item.positive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400")}>
          {item.label} {item.value}
        </span>
      ))}
    </div>
  );
};

export const InterviewModal = () => {
  const {
    pending,
    phase,
    currentQuestion,
    currentIndex,
    timeLeft,
    totalEffects,
    loading,
    startInterview,
    handleAnswer,
    finishInterview,
    answers,
    questions,
  } = useInterviewSession();

  if (!pending) return null;

  const MediaIcon = mediaIcons[pending.mediaType] || Globe;
  const isOpen = !!pending;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <MediaIcon className="h-5 w-5 text-primary" />
            <DialogTitle className="font-oswald text-lg">
              {phase === "results" ? "Interview Results" : `Interview: ${pending.outletName}`}
            </DialogTitle>
          </div>
          <DialogDescription>
            {phase === "intro" && `You're about to go live on ${pending.outletName}. Answer wisely!`}
            {phase === "question" && `Question ${currentIndex + 1} of 3`}
            {phase === "results" && "Here's how your interview went"}
          </DialogDescription>
        </DialogHeader>

        {/* INTRO */}
        {phase === "intro" && (
          <div className="space-y-4">
            <Card className="bg-card/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{pending.mediaType}</Badge>
                  {pending.showName && <span className="text-sm text-muted-foreground">{pending.showName}</span>}
                </div>
                <p className="text-sm text-muted-foreground">
                  You'll be asked 3 questions. You have <strong>10 seconds</strong> per question.
                  Choose your response carefully — each answer affects your fame, fans, earnings, and reputation!
                </p>
                <div className="flex items-center gap-1 text-xs text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  <span>If time runs out, the worst response is chosen automatically.</span>
                </div>
              </CardContent>
            </Card>
            <Button onClick={startInterview} disabled={loading} className="w-full font-oswald">
              {loading ? "Preparing..." : "Start Interview"}
            </Button>
          </div>
        )}

        {/* QUESTION */}
        {phase === "question" && currentQuestion && (
          <div className="space-y-4">
            {/* Timer */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Time remaining</span>
                <span className={cn("font-mono font-bold", timeLeft <= 3 ? "text-destructive animate-pulse" : "")}>
                  {Math.ceil(timeLeft)}s
                </span>
              </div>
              <Progress value={(timeLeft / 10) * 100} className={cn("h-2", timeLeft <= 3 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")} />
            </div>

            {/* Question */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <p className="text-sm font-medium leading-relaxed">"{currentQuestion.question_text}"</p>

                {/* Options */}
                <div className="grid gap-2">
                  {optionKeys.map((key, i) => {
                    const textKey = `option_${key}_text` as keyof typeof currentQuestion;
                    const effectsKey = `option_${key}_effects` as keyof typeof currentQuestion;
                    return (
                      <button
                        key={key}
                        onClick={() => handleAnswer(key)}
                        className={cn(
                          "text-left p-3 rounded-lg border transition-all",
                          optionColors[i],
                          "hover:scale-[1.01] active:scale-[0.99]"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded", optionBadgeColors[i])}>
                            {optionLabels[i]}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm">{currentQuestion[textKey] as string}</p>
                            <EffectBadges effects={currentQuestion[effectsKey] as Record<string, unknown>} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* RESULTS */}
        {phase === "results" && totalEffects && (
          <div className="space-y-4">
            {/* Per-question summary */}
            <div className="space-y-2">
              {answers.map((a, i) => {
                const q = questions[i];
                const textKey = `option_${a.chosen_option}_text` as keyof typeof q;
                return (
                  <Card key={i} className="bg-card/50">
                    <CardContent className="p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Q{i + 1}: {q.question_text}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px]", a.timed_out ? "border-destructive text-destructive" : "")}>
                          {a.timed_out ? "⏰ Timed Out" : `Option ${a.chosen_option.toUpperCase()}`}
                        </Badge>
                        <span className="text-xs">{q[textKey] as string}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Total effects */}
            <Card className="border-primary/30">
              <CardContent className="p-4">
                <h4 className="text-sm font-oswald mb-2">Combined Interview Effects</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <Star className="h-4 w-4 mx-auto mb-1 text-yellow-400" />
                    <p className="text-xs text-muted-foreground">Fame</p>
                    <p className={cn("text-sm font-bold", totalEffects.fame_mult >= 1 ? "text-green-400" : "text-red-400")}>
                      {totalEffects.fame_mult >= 1 ? "+" : ""}{Math.round((totalEffects.fame_mult - 1) * 100)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <Users className="h-4 w-4 mx-auto mb-1 text-blue-400" />
                    <p className="text-xs text-muted-foreground">Fans</p>
                    <p className={cn("text-sm font-bold", totalEffects.fan_mult >= 1 ? "text-green-400" : "text-red-400")}>
                      {totalEffects.fan_mult >= 1 ? "+" : ""}{Math.round((totalEffects.fan_mult - 1) * 100)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <DollarSign className="h-4 w-4 mx-auto mb-1 text-emerald-400" />
                    <p className="text-xs text-muted-foreground">Cash</p>
                    <p className={cn("text-sm font-bold", totalEffects.cash_mult >= 1 ? "text-green-400" : "text-red-400")}>
                      {totalEffects.cash_mult >= 1 ? "+" : ""}{Math.round((totalEffects.cash_mult - 1) * 100)}%
                    </p>
                  </div>
                </div>
                {Object.keys(totalEffects.reputation).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Reputation Changes</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(totalEffects.reputation).map(([axis, val]) => (
                        <Badge key={axis} variant="outline" className={cn("text-[10px] capitalize", val > 0 ? "text-green-400 border-green-500/30" : "text-red-400 border-red-500/30")}>
                          {axis}: {val > 0 ? "+" : ""}{val}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button onClick={finishInterview} disabled={loading} className="w-full font-oswald">
              {loading ? "Applying Effects..." : "Done"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
