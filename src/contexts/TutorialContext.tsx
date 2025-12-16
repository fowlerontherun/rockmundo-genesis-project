import { useState, useEffect } from "react";
import { createContext, useContext, ReactNode } from "react";
import { X, ChevronRight, ChevronLeft, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface TutorialStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for highlighting
  position?: "top" | "bottom" | "left" | "right";
}

interface TutorialContextType {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  startTutorial: (steps: TutorialStep[]) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error("useTutorial must be used within TutorialProvider");
  }
  return context;
};

export const TutorialProvider = ({ children }: { children: ReactNode }) => {
  const [isActive, setIsActive] = useState(false);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const startTutorial = (tutorialSteps: TutorialStep[]) => {
    setSteps(tutorialSteps);
    setCurrentStep(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      completeTutorial();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const skipTutorial = () => {
    setIsActive(false);
    setSteps([]);
    setCurrentStep(0);
  };

  const completeTutorial = () => {
    setIsActive(false);
    setSteps([]);
    setCurrentStep(0);
    localStorage.setItem("tutorial_completed", "true");
  };

  return (
    <TutorialContext.Provider
      value={{
        isActive,
        currentStep,
        totalSteps: steps.length,
        startTutorial,
        nextStep,
        prevStep,
        skipTutorial,
        completeTutorial,
      }}
    >
      {children}
      {isActive && steps[currentStep] && (
        <TutorialOverlay
          step={steps[currentStep]}
          currentStep={currentStep}
          totalSteps={steps.length}
          onNext={nextStep}
          onPrev={prevStep}
          onSkip={skipTutorial}
        />
      )}
    </TutorialContext.Provider>
  );
};

const TutorialOverlay = ({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: {
  step: TutorialStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) => {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
      <Card className="max-w-md w-full mx-4 animate-scale-in">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">{step.title}</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onSkip} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-muted-foreground mb-6">{step.content}</p>

          <Progress value={progress} className="h-1 mb-4" />

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {totalSteps}
            </span>
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button variant="outline" size="sm" onClick={onPrev}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button size="sm" onClick={onNext}>
                {currentStep === totalSteps - 1 ? "Finish" : "Next"}
                {currentStep < totalSteps - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Predefined tutorials
export const DASHBOARD_TUTORIAL: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Rock Manager!",
    content: "This is your command center for managing your music career. Let's take a quick tour of the key features.",
  },
  {
    id: "stats",
    title: "Your Stats",
    content: "Here you can see your character's attributes, skills, and progression. Keep training to improve!",
  },
  {
    id: "band",
    title: "Band Management",
    content: "Create or join a band to start performing gigs. Collaborate with other musicians to grow your fame.",
  },
  {
    id: "gigs",
    title: "Book Gigs",
    content: "Book gigs at venues to earn money and fame. Better performances lead to bigger opportunities!",
  },
  {
    id: "recording",
    title: "Recording Studio",
    content: "Record your songs to release them and earn streaming revenue. Quality recordings attract more listeners.",
  },
];
