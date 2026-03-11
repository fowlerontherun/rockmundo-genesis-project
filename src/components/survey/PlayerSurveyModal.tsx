import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star, SkipForward, Gift, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SurveyQuestion } from "@/hooks/usePlayerSurvey";

interface PlayerSurveyModalProps {
  open: boolean;
  onClose: () => void;
  questions: SurveyQuestion[];
  onSubmit: (answers: { questionId: string; answerValue: string; answerNumeric?: number }[]) => Promise<void>;
  isSubmitting: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  gameplay: "Gameplay",
  music: "Music & Production",
  social: "Social & Community",
  economy: "Economy & Balance",
  ui: "UI & Experience",
  content: "Content",
  performance: "Performance",
  progression: "Progression",
};

export function PlayerSurveyModal({ open, onClose, questions, onSubmit, isSubmitting }: PlayerSurveyModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { value: string; numeric?: number }>>({});
  const [completed, setCompleted] = useState(false);

  const question = questions[currentIndex];
  const total = questions.length;
  const progress = total > 0 ? ((currentIndex) / total) * 100 : 0;
  const currentAnswer = question ? answers[question.id] : undefined;

  const setAnswer = useCallback((value: string, numeric?: number) => {
    if (!question) return;
    setAnswers((prev) => ({ ...prev, [question.id]: { value, numeric } }));
  }, [question]);

  const handleNext = useCallback(async () => {
    if (currentIndex < total - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // Submit
      const payload = Object.entries(answers).map(([questionId, ans]) => ({
        questionId,
        answerValue: ans.value,
        answerNumeric: ans.numeric,
      }));
      await onSubmit(payload);
      setCompleted(true);
    }
  }, [currentIndex, total, answers, onSubmit]);

  if (completed) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Gift className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Thank You!</h2>
            <p className="text-muted-foreground">Your feedback helps us make the game better.</p>
            <div className="flex gap-3">
              <Badge variant="secondary" className="text-sm px-3 py-1">+250 XP</Badge>
              <Badge variant="secondary" className="text-sm px-3 py-1">+25 Attribute Points</Badge>
            </div>
            <Button onClick={onClose} className="mt-4">Continue Playing</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">Game Review Survey</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground text-xs gap-1">
              <SkipForward className="h-3.5 w-3.5" />
              Skip
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
            <Gift className="h-3.5 w-3.5 text-primary" />
            <span>Complete for <strong className="text-primary">250 XP</strong> + <strong className="text-primary">25 Attribute Points</strong></span>
          </div>
        </DialogHeader>

        <Progress value={progress} className="h-2 mt-2" />
        <p className="text-xs text-muted-foreground text-right">{currentIndex + 1} / {total}</p>

        {question && (
          <div className="space-y-4 py-2">
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[question.category] || question.category}
            </Badge>
            <p className="text-sm font-medium text-foreground leading-relaxed">{question.question_text}</p>

            {/* Rating 1-5 */}
            {question.question_type === "rating_1_5" && (
              <div className="flex gap-2 justify-center py-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setAnswer(String(n), n)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                      currentAnswer?.numeric === n
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 text-muted-foreground"
                    )}
                  >
                    <Star className={cn("h-6 w-6", currentAnswer?.numeric === n ? "fill-primary" : "")} />
                    <span className="text-xs">{n}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Yes/No */}
            {question.question_type === "yes_no" && (
              <div className="flex gap-3 justify-center py-2">
                {["Yes", "No"].map((opt) => (
                  <Button
                    key={opt}
                    variant={currentAnswer?.value === opt ? "default" : "outline"}
                    onClick={() => setAnswer(opt)}
                    className="min-w-[80px]"
                  >
                    {opt}
                  </Button>
                ))}
              </div>
            )}

            {/* Multiple Choice */}
            {question.question_type === "multiple_choice" && question.options && (
              <div className="flex flex-col gap-2">
                {(question.options as string[]).map((opt) => (
                  <Button
                    key={opt}
                    variant={currentAnswer?.value === opt ? "default" : "outline"}
                    onClick={() => setAnswer(opt)}
                    className="justify-start text-left text-sm h-auto py-2.5 px-3"
                  >
                    {currentAnswer?.value === opt && <CheckCircle className="h-4 w-4 mr-2 shrink-0" />}
                    {opt}
                  </Button>
                ))}
              </div>
            )}

            {/* Free Text */}
            {question.question_type === "free_text" && (
              <Textarea
                placeholder="Share your thoughts..."
                value={currentAnswer?.value || ""}
                onChange={(e) => setAnswer(e.target.value)}
                rows={3}
                className="text-sm"
              />
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleNext}
            disabled={!currentAnswer?.value || isSubmitting}
            className="min-w-[100px]"
          >
            {isSubmitting ? "Submitting..." : currentIndex === total - 1 ? "Submit" : "Next"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
