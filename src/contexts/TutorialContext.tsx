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
    title: "Welcome to Rockmundo!",
    content: "This is your command center for managing your music career. Let's take a quick tour of the key features and get you started on your journey to stardom!",
  },
  {
    id: "character",
    title: "Your Character",
    content: "Your character has skills, attributes, and a wallet. Keep training and performing to improve your abilities. Check your profile to see your progress!",
  },
  {
    id: "songwriting",
    title: "Write Your First Song",
    content: "Head to Music Hub → Songwriting Studio to write your first song. You can write lyrics manually or use AI assistance. Song quality depends on your songwriting skill.",
  },
  {
    id: "band",
    title: "Band Management",
    content: "Create or join a band to unlock more opportunities! Bands can book bigger gigs, and chemistry between members improves your performances.",
  },
  {
    id: "openmic",
    title: "Start with Open Mic Nights!",
    content: "Open Mic Nights are perfect for beginners! Every city has a venue with a weekly open mic. Sign up, pick 2 songs, and perform when it's showtime. You'll earn fame and fans - no money, but great exposure!",
  },
  {
    id: "rehearsals",
    title: "Rehearse Your Songs",
    content: "Book rehearsal rooms to practice your songs with your band. Higher familiarity means better live performances. Rehearsals also build band chemistry!",
  },
  {
    id: "gigs",
    title: "Book Gigs",
    content: "Once you've built some fame, book gigs at venues! Create setlists from your rehearsed songs. Better performances lead to bigger payouts and more fans.",
  },
  {
    id: "schedule",
    title: "Check Your Schedule",
    content: "Your activities are scheduled and block time slots. Open mics, gigs, classes, and rehearsals all take time. Plan wisely - you can't double-book!",
  },
  {
    id: "education",
    title: "Keep Learning",
    content: "Visit Education to attend university courses, read skill books, watch videos, or work with mentors. More skills = better songs and performances!",
  },
  {
    id: "social",
    title: "Build Your Fanbase",
    content: "Use Twaater (social media) to post updates and engage with fans. Travel to new cities to expand your reach. Your fame grows with every performance and interaction!",
  },
];

export const OPEN_MIC_TUTORIAL: TutorialStep[] = [
  {
    id: "intro",
    title: "Open Mic Nights",
    content: "Open mic nights are the perfect way to start your music career! Every city has a venue hosting weekly open mic nights.",
  },
  {
    id: "schedule",
    title: "Weekly Schedule",
    content: "Each venue has a specific day of the week for their open mic. All performances start at 8 PM. Check the venue cards to see their schedule.",
  },
  {
    id: "signup",
    title: "Sign Up to Play",
    content: "Click 'Sign Up to Play' on any venue to register. You'll need to select 2 songs from your band's repertoire.",
  },
  {
    id: "waiting",
    title: "Wait for Showtime",
    content: "After signing up, you'll need to wait until the scheduled date and time. The 'Start Performance' button activates when it's showtime!",
  },
  {
    id: "performing",
    title: "Live Performance",
    content: "During your set, you'll see live commentary as the crowd reacts to your performance. Song quality, rehearsal level, and band chemistry all affect your score.",
  },
  {
    id: "rewards",
    title: "Fame & Fans",
    content: "Open mics don't pay money - they're about exposure! You'll earn fame and fans based on your performance. Great for building an audience before booking paid gigs.",
  },
];
