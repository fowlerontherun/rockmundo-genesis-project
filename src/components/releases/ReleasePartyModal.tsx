import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useReleasePartySession } from "@/hooks/useReleasePartySession";
import { PartyPopper, Clock, Zap, Users, DollarSign, Star, AlertTriangle, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ReleasePartyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  releaseId: string;
  releaseTitle: string;
  userId: string;
  bandId: string | null;
}

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
  const items: { label: string; value: string; positive: boolean }[] = [];
  const hype = effects.hype_mult as number;
  const fan = effects.fan_mult as number;
  const cash = effects.cash_mult as number;
  const rep = effects.reputation as Record<string, number> | undefined;

  if (hype && hype !== 1) items.push({ label: "Hype", value: hype > 1 ? `+${Math.round((hype - 1) * 100)}%` : `${Math.round((hype - 1) * 100)}%`, positive: hype > 1 });
  if (fan && fan !== 1) items.push({ label: "Fans", value: fan > 1 ? `+${Math.round((fan - 1) * 100)}%` : `${Math.round((fan - 1) * 100)}%`, positive: fan > 1 });
  if (cash && cash !== 1) items.push({ label: "Cash", value: cash > 1 ? `+${Math.round((cash - 1) * 100)}%` : `${Math.round((cash - 1) * 100)}%`, positive: cash > 1 });
  if (rep) {
    Object.entries(rep).forEach(([k, v]) => {
      if (v !== 0) items.push({ label: k, value: v > 0 ? `+${v}` : `${v}`, positive: v > 0 });
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

export function ReleasePartyModal({ open, onOpenChange, releaseId, releaseTitle, userId, bandId }: ReleasePartyModalProps) {
  const {
    phase,
    currentQuestion,
    currentIndex,
    timeLeft,
    totalEffects,
    hypeAwarded,
    loading,
    startParty,
    handleAnswer,
    finishParty,
    answers,
    questions,
    reset,
  } = useReleasePartySession(open ? releaseId : null, releaseTitle, userId, bandId);

  const handleClose = () => {
    if (phase === "results") {
      reset();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            <DialogTitle className="font-oswald text-lg">
              {phase === "results" ? "Party Results" : `Release Party: ${releaseTitle}`}
            </DialogTitle>
          </div>
          <DialogDescription>
            {phase === "intro" && "Throw an epic release party to build hype for your music!"}
            {phase === "question" && `Question ${currentIndex + 1} of 5`}
            {phase === "results" && "Here's how your release party went"}
          </DialogDescription>
        </DialogHeader>

        {/* INTRO */}
        {phase === "intro" && (
          <div className="space-y-4">
            <Card className="bg-card/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    <Flame className="h-3 w-3 mr-1" />
                    Release Party
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  You'll face 5 situations at your release party. You have <strong>10 seconds</strong> per question.
                  Your choices will determine how much hype your release gains!
                </p>
                <p className="text-sm text-muted-foreground">
                  Base hype award: <strong>100 points</strong>, modified by your answers (range: 50-150+).
                </p>
                <div className="flex items-center gap-1 text-xs text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  <span>If time runs out, the worst response is chosen automatically.</span>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-2">
              <Button onClick={handleClose} disabled={loading} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={startParty} disabled={loading} className="flex-1">
                {loading ? "Setting Up..." : "🎉 Start Party!"}
              </Button>
            </div>
          </div>
        )}

        {/* QUESTION */}
        {phase === "question" && currentQuestion && (
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Time remaining</span>
                <span className={cn("font-mono font-bold", timeLeft <= 3 ? "text-destructive animate-pulse" : "")}>
                  {Math.ceil(timeLeft)}s
                </span>
              </div>
              <Progress value={(timeLeft / 10) * 100} className={cn("h-2", timeLeft <= 3 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <p className="text-sm font-medium leading-relaxed">"{currentQuestion.question_text}"</p>
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

            <Card className="border-primary/30">
              <CardContent className="p-4">
                <h4 className="text-sm font-oswald mb-2">Party Results</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="text-center">
                    <Flame className="h-4 w-4 mx-auto mb-1 text-orange-400" />
                    <p className="text-xs text-muted-foreground">Hype</p>
                    <p className="text-sm font-bold text-orange-400">+{hypeAwarded}</p>
                  </div>
                  <div className="text-center">
                    <Star className="h-4 w-4 mx-auto mb-1 text-yellow-400" />
                    <p className="text-xs text-muted-foreground">Hype Mult</p>
                    <p className={cn("text-sm font-bold", totalEffects.hype_mult >= 1 ? "text-green-400" : "text-red-400")}>
                      {totalEffects.hype_mult >= 1 ? "+" : ""}{Math.round((totalEffects.hype_mult - 1) * 100)}%
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

            <Button onClick={async () => { await finishParty(); handleClose(); }} disabled={loading} className="w-full">
              {loading ? "Saving Results..." : "🎉 Done!"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
