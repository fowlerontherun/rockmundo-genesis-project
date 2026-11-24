import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Star, SkipForward, Gift, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { canSkipSurveyQuestion, SURVEY_CATEGORY_LABELS, SURVEY_REWARD, SURVEY_TEXT_LIMIT, type SurveyAnswers } from "@/lib/playerSurvey";
import type { SurveyQuestion } from "@/hooks/usePlayerSurvey";

interface PlayerSurveyModalProps {
  open: boolean;
  onClose: () => void;
  questions: SurveyQuestion[];
  onSubmit: (answers: SurveyAnswers) => Promise<unknown>;
  isSubmitting: boolean;
}

export function PlayerSurveyModal({ open, onClose, questions, onSubmit, isSubmitting }: PlayerSurveyModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const question = questions[currentIndex];
  const total = questions.length;
  if (!question) return null;

  const currentAnswer = answers[question.id];
  const canContinue = currentAnswer === null || !!currentAnswer?.trim();

  const setAnswer = (value: string | null) => {
    setAnswers((previous) => ({ ...previous, [question.id]: value }));
  };

  const handleNext = async () => {
    if (isSubmitting || !canContinue) return;
    if (currentIndex < total - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }

    try {
      await onSubmit(answers);
    } catch {
      // The survey hook shows the error. Keep the answers available to retry.
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">Game Review Survey</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isSubmitting} className="text-muted-foreground text-xs gap-1">
              <SkipForward className="h-3.5 w-3.5" />
              Not now
            </Button>
          </div>
          <DialogDescription className="flex items-center gap-2 pt-1 text-xs">
            <Gift className="h-3.5 w-3.5 text-primary" />
            <span>Complete for <strong className="text-primary">{SURVEY_REWARD.xp.toLocaleString()} XP</strong> + <strong className="text-primary">{SURVEY_REWARD.ap} Attribute Points</strong></span>
          </DialogDescription>
        </DialogHeader>

        <Progress value={(currentIndex / total) * 100} className="h-2 mt-2" />
        <p className="text-xs text-muted-foreground text-right">{currentIndex + 1} / {total}</p>

        <div className="space-y-4 py-2">
          <Badge variant="outline" className="text-xs">
            {SURVEY_CATEGORY_LABELS[question.category] || question.category}
          </Badge>
          <p className="text-sm font-medium text-foreground leading-relaxed">{question.question_text}</p>

          {/* Rating 1-5 */}
          {question.question_type === "rating_1_5" && (
            <div className="flex gap-2 justify-center py-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={`Rate ${n} out of 5`}
                  aria-pressed={currentAnswer === String(n)}
                  onClick={() => setAnswer(String(n))}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                    currentAnswer === String(n)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 text-muted-foreground"
                  )}
                >
                  <Star className={cn("h-6 w-6", currentAnswer === String(n) ? "fill-primary" : "")} />
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
                  variant={currentAnswer === opt ? "default" : "outline"}
                  aria-pressed={currentAnswer === opt}
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
                  variant={currentAnswer === opt ? "default" : "outline"}
                  aria-pressed={currentAnswer === opt}
                  onClick={() => setAnswer(opt)}
                  className="h-auto justify-start whitespace-normal py-2.5 px-3 text-left text-sm"
                >
                  {currentAnswer === opt && <CheckCircle className="h-4 w-4 mr-2 shrink-0" />}
                  {opt}
                </Button>
              ))}
            </div>
          )}

          {/* Free Text */}
          {question.question_type === "free_text" && (
            <Textarea
              placeholder="Share your thoughts..."
              value={currentAnswer ?? ""}
              aria-label={question.question_text}
              maxLength={SURVEY_TEXT_LIMIT}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
              className="text-sm"
            />
          )}
          {canSkipSurveyQuestion(question.category, question.question_type) && (
            <Button
              variant={currentAnswer === null ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={currentAnswer === null}
              onClick={() => setAnswer(null)}
            >
              {question.question_type === "free_text" ? "Prefer not to answer" : "Not applicable"}
            </Button>
          )}
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={() => setCurrentIndex(currentIndex - 1)} disabled={currentIndex === 0 || isSubmitting}>
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canContinue || isSubmitting}
            className="min-w-[100px]"
          >
            {isSubmitting ? "Submitting..." : currentIndex === total - 1 ? "Submit" : "Next"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
