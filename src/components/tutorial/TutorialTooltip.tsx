import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTutorial } from "@/hooks/useTutorial";
import { X, ChevronRight, Lightbulb, CheckCircle2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

export const TutorialTooltip = () => {
  const { currentStep, progressPercent, completeStep, incompleteSteps } = useTutorial();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [localDismissed, setLocalDismissed] = useState<Set<string>>(new Set());

  // Check localStorage for dismissed state on mount
  useEffect(() => {
    const dismissedTutorial = localStorage.getItem("tutorial_dismissed");
    if (dismissedTutorial === "true") {
      setDismissed(true);
    }
  }, []);

  // Auto-complete step when user visits the target route
  useEffect(() => {
    if (currentStep?.target_route && location.pathname === currentStep.target_route) {
      // Mark as visited after a short delay
      const timer = setTimeout(() => {
        completeStep(currentStep.step_key);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, currentStep]);

  if (dismissed || !currentStep || progressPercent === 100) {
    return null;
  }

  // Skip if this step was locally dismissed
  if (localDismissed.has(currentStep.step_key)) {
    return null;
  }

  const handleDismissAll = () => {
    localStorage.setItem("tutorial_dismissed", "true");
    setDismissed(true);
  };

  const handleSkipStep = () => {
    setLocalDismissed(prev => new Set(prev).add(currentStep.step_key));
    completeStep(currentStep.step_key);
  };

  const handleGoToStep = () => {
    if (currentStep.target_route) {
      navigate(currentStep.target_route);
    }
  };

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-lg border-primary/20 z-50 animate-in slide-in-from-bottom-5">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-base">Tutorial</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleDismissAll}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Progress value={progressPercent} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground">{progressPercent}%</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">
              Step {incompleteSteps.findIndex(s => s.step_key === currentStep.step_key) + 1}
            </Badge>
            <Badge variant="outline" className="text-xs capitalize">
              {currentStep.category.replace(/_/g, ' ')}
            </Badge>
          </div>
          <h3 className="font-semibold">{currentStep.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{currentStep.description}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkipStep}
            className="text-xs"
          >
            Skip
          </Button>
          {currentStep.target_route && (
            <Button
              size="sm"
              onClick={handleGoToStep}
              className="flex-1 gap-1"
            >
              Go there <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {!currentStep.target_route && (
            <Button
              size="sm"
              onClick={handleSkipStep}
              className="flex-1 gap-1"
            >
              <CheckCircle2 className="h-4 w-4" /> Got it
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const TutorialProgress = () => {
  const { progressPercent, completedSteps, steps } = useTutorial();
  
  if (progressPercent === 100) return null;

  return (
    <div className="flex items-center gap-2">
      <Progress value={progressPercent} className="h-2 w-20" />
      <span className="text-xs text-muted-foreground">
        {completedSteps.length}/{steps.length}
      </span>
    </div>
  );
};