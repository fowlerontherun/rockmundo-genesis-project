import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useInterviewSession } from "@/hooks/useInterviewSession";
import { Mic, Tv, Radio, Newspaper, Globe, BookOpen, Clock, Users, DollarSign, Star, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const mediaIcons: Record<string, typeof Mic> = {
  podcast: Mic,
  tv: Tv,
  radio: Radio,
  newspaper: Newspaper,
  internet: Globe,
  magazine: BookOpen,
  film: Tv,
};

const optionLabels = ["A", "B", "C", "D"] as const;
const optionKeys = ["a", "b", "c", "d"] as const;

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
    questionCount,
    questionTimeSeconds,
  } = useInterviewSession();

  if (!pending) return null;

  const MediaIcon = mediaIcons[pending.mediaType] || Globe;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <MediaIcon className="h-5 w-5 text-primary" />
            <DialogTitle className="font-oswald text-lg">
              {phase === "results" ? "Interview Results" : `Interview: ${pending.outletName}`}
            </DialogTitle>
          </div>
          <DialogDescription>
            {phase === "intro" && `Your scheduled ${pending.mediaType} appearance is ready. The interview must be completed.`}
            {phase === "question" && `Question ${currentIndex + 1} of ${questions.length}`}
            {phase === "results" && "Here's how your interview went"}
          </DialogDescription>
        </DialogHeader>

        {phase === "intro" && (
          <div className="space-y-4">
            <Card className="bg-card/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{pending.mediaType}</Badge>
                  {pending.showName && <span className="text-sm text-muted-foreground">{pending.showName}</span>}
                </div>
                <p className="text-sm text-muted-foreground">
                  This appearance has <strong>{questionCount} questions</strong>, with <strong>{questionTimeSeconds} seconds</strong> to answer each one.
                  Your choices shape fame, fans, earnings and your public reputation.
                </p>
                <div className="flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>Accepted PR appearances cannot be skipped. If time runs out, you'll stumble into a random response and take an awkwardness penalty.</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  There isn't always a single best answer. Professional, authentic, rebellious and controversial responses can each help or hurt different parts of your public image.
                </p>
              </CardContent>
            </Card>
            <Button onClick={startInterview} disabled={loading} className="w-full font-oswald">
              {loading ? "Preparing interview..." : "Go Live"}
            </Button>
          </div>
        )}

        {phase === "question" && currentQuestion && (
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Live — answer quickly</span>
                <span className={cn("font-mono font-bold", timeLeft <= 3 ? "text-destructive animate-pulse" : "")}>{Math.ceil(timeLeft)}s</span>
              </div>
              <Progress value={(timeLeft / questionTimeSeconds) * 100} className={cn("h-2", timeLeft <= 3 ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")} />
            </div>

            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="capitalize">{currentQuestion.category.replaceAll("_", " ")}</Badge>
              <span className="text-xs text-muted-foreground">{currentIndex + 1}/{questions.length}</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-3"
              >
                <p className="text-base font-medium leading-relaxed">“{currentQuestion.question_text}”</p>
                <div className="grid gap-2">
                  {optionKeys.map((key, index) => {
                    const textKey = `option_${key}_text` as keyof typeof currentQuestion;
                    return (
                      <button
                        key={key}
                        onClick={() => handleAnswer(key)}
                        className="text-left p-3 rounded-lg border border-border hover:border-primary/60 hover:bg-primary/5 transition-all hover:scale-[1.01] active:scale-[0.99]"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-bold px-2 py-1 rounded bg-muted text-muted-foreground">{optionLabels[index]}</span>
                          <p className="text-sm flex-1">{currentQuestion[textKey] as string}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {phase === "results" && totalEffects && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-card/50"><CardContent className="p-3 text-center"><Star className="h-4 w-4 mx-auto mb-1" /><p className="text-xs text-muted-foreground">Fame</p><p className="font-bold">{totalEffects.fame_mult >= 1 ? "+" : ""}{Math.round((totalEffects.fame_mult - 1) * 100)}%</p></CardContent></Card>
              <Card className="bg-card/50"><CardContent className="p-3 text-center"><Users className="h-4 w-4 mx-auto mb-1" /><p className="text-xs text-muted-foreground">Fans</p><p className="font-bold">{totalEffects.fan_mult >= 1 ? "+" : ""}{Math.round((totalEffects.fan_mult - 1) * 100)}%</p></CardContent></Card>
              <Card className="bg-card/50"><CardContent className="p-3 text-center"><DollarSign className="h-4 w-4 mx-auto mb-1" /><p className="text-xs text-muted-foreground">Cash</p><p className="font-bold">{totalEffects.cash_mult >= 1 ? "+" : ""}{Math.round((totalEffects.cash_mult - 1) * 100)}%</p></CardContent></Card>
            </div>

            {Object.keys(totalEffects.reputation).length > 0 && (
              <Card className="border-primary/30">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-2">Public image changes</p>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(totalEffects.reputation).map(([axis, value]) => (
                      <Badge key={axis} variant="outline" className="capitalize">{axis.replaceAll("_", " ")} {value > 0 ? "+" : ""}{value}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {answers.map((answer, index) => {
                const question = questions[index];
                const textKey = `option_${answer.chosen_option}_text` as keyof typeof question;
                return (
                  <Card key={answer.question_id} className="bg-card/40">
                    <CardContent className="p-3 space-y-1">
                      <p className="text-xs text-muted-foreground">Q{index + 1}: {question.question_text}</p>
                      <div className="flex items-start gap-2">
                        {answer.timed_out && <Badge variant="destructive" className="text-[10px]">Timed out</Badge>}
                        <span className="text-xs">{question[textKey] as string}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Button onClick={finishInterview} disabled={loading} className="w-full font-oswald">
              {loading ? "Applying interview effects..." : "Finish Interview"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
