import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  usePlayerCharacterIdentity,
  useCreateCharacterIdentity,
  useUpdateCharacterIdentity,
  useCompleteOnboarding,
} from "@/hooks/useCharacterIdentity";
import { useCreateReputation } from "@/hooks/useReputation";
import { useCharacterOrigins, usePersonalityTraits } from "@/hooks/useCharacterIdentity";
import { getCombinedReputationModifiers } from "@/lib/api/roleplaying";

import { WelcomeStep } from "./steps/WelcomeStep";
import { AppearanceStep } from "./steps/AppearanceStep";
import { OriginStep } from "./steps/OriginStep";
import { TraitsStep } from "./steps/TraitsStep";
import { MusicIdentityStep } from "./steps/MusicIdentityStep";
import { CareerPathStep } from "./steps/CareerPathStep";
import { StartingCityStep } from "./steps/StartingCityStep";
import { BackstoryStep } from "./steps/BackstoryStep";

const STEPS = [
  { id: 1, title: "Welcome", description: "What should the world call you?" },
  { id: 2, title: "Appearance", description: "Create your look" },
  { id: 3, title: "Origin", description: "Where did your journey begin?" },
  { id: 4, title: "Personality", description: "What defines you?" },
  { id: 5, title: "Musical Identity", description: "Your sound" },
  { id: 6, title: "Career Path", description: "How do you want to start?" },
  { id: 7, title: "Starting City", description: "Choose your home base" },
  { id: 8, title: "Your Story", description: "Review your backstory" },
];

export interface OnboardingData {
  displayName: string;
  artistName: string;
  originId: string | null;
  traitIds: string[];
  musicalStyle: string;
  careerGoal: string;
  startingCityId: string | null;
  backstoryText: string;
}

export const OnboardingWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const [data, setData] = useState<OnboardingData>({
    displayName: "",
    artistName: "",
    originId: null,
    traitIds: [],
    musicalStyle: "",
    careerGoal: "solo",
    startingCityId: null,
    backstoryText: "",
  });

  const { data: identity } = usePlayerCharacterIdentity();
  const { data: origins = [] } = useCharacterOrigins();
  const { data: traits = [] } = usePersonalityTraits();
  
  const createIdentity = useCreateCharacterIdentity();
  const updateIdentity = useUpdateCharacterIdentity();
  const createReputation = useCreateReputation();
  const completeOnboarding = useCompleteOnboarding();

  // Initialize identity if not exists
  useEffect(() => {
    if (identity === null && !createIdentity.isPending) {
      createIdentity.mutate();
    }
  }, [identity, createIdentity]);

  // Restore step from saved progress
  useEffect(() => {
    if (identity && identity.onboarding_step > 0) {
      setCurrentStep(Math.min(identity.onboarding_step + 1, STEPS.length));
      
      // Restore saved data
      setData((prev) => ({
        ...prev,
        originId: identity.origin_id,
        traitIds: identity.trait_ids ?? [],
        musicalStyle: identity.musical_style ?? "",
        careerGoal: identity.career_goal ?? "solo",
        startingCityId: identity.starting_city_id,
        backstoryText: identity.backstory_text ?? "",
      }));
    }
  }, [identity]);

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const progress = (currentStep / STEPS.length) * 100;

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return data.displayName.trim().length >= 2;
      case 2:
        return true; // Appearance is optional
      case 3:
        return data.originId !== null;
      case 4:
        return data.traitIds.length >= 2 && data.traitIds.length <= 3;
      case 5:
        return data.musicalStyle.trim().length > 0;
      case 6:
        return data.careerGoal.length > 0;
      case 7:
        return data.startingCityId !== null;
      case 8:
        return true;
      default:
        return false;
    }
  };

  const saveProgress = async () => {
    if (!identity) return;

    await updateIdentity.mutateAsync({
      origin_id: data.originId,
      trait_ids: data.traitIds,
      musical_style: data.musicalStyle,
      career_goal: data.careerGoal,
      starting_city_id: data.startingCityId,
      backstory_text: data.backstoryText,
      onboarding_step: currentStep,
    });
  };

  const handleNext = async () => {
    if (!canProceed() || isTransitioning) return;
    
    setIsTransitioning(true);
    
    try {
      await saveProgress();
      
      if (currentStep < STEPS.length) {
        setCurrentStep((prev) => prev + 1);
      }
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1 && !isTransitioning) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    
    try {
      await saveProgress();
      
      // Create reputation with initial modifiers from origin and traits
      const selectedOrigin = origins.find((o) => o.id === data.originId) ?? null;
      const selectedTraits = traits.filter((t) => data.traitIds.includes(t.id));
      const modifiers = getCombinedReputationModifiers(selectedOrigin, selectedTraits);
      
      await createReputation.mutateAsync(modifiers);
      await completeOnboarding.mutateAsync();
      
      navigate("/dashboard");
    } finally {
      setIsTransitioning(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <WelcomeStep data={data} updateData={updateData} />;
      case 2:
        return <AppearanceStep />;
      case 3:
        return <OriginStep data={data} updateData={updateData} />;
      case 4:
        return <TraitsStep data={data} updateData={updateData} />;
      case 5:
        return <MusicIdentityStep data={data} updateData={updateData} />;
      case 6:
        return <CareerPathStep data={data} updateData={updateData} />;
      case 7:
        return <StartingCityStep data={data} updateData={updateData} />;
      case 8:
        return (
          <BackstoryStep
            data={data}
            updateData={updateData}
            origins={origins}
            traits={traits}
          />
        );
      default:
        return null;
    }
  };

  const isLastStep = currentStep === STEPS.length;
  const isSaving = updateIdentity.isPending || createReputation.isPending || completeOnboarding.isPending;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header with progress */}
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground">
                {STEPS[currentStep - 1].title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {STEPS[currentStep - 1].description}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Step {currentStep} of {STEPS.length}
            </div>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </header>

      {/* Step content */}
      <main className="container mx-auto flex-1 px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="mx-auto max-w-3xl"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation footer */}
      <footer className="sticky bottom-0 border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 1 || isTransitioning}
            className={cn(currentStep === 1 && "invisible")}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>

          {/* Step indicators */}
          <div className="hidden items-center gap-1.5 md:flex">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  step.id === currentStep
                    ? "bg-primary"
                    : step.id < currentStep
                    ? "bg-primary/50"
                    : "bg-muted"
                )}
              />
            ))}
          </div>

          {isLastStep ? (
            <Button
              onClick={handleComplete}
              disabled={!canProceed() || isSaving}
              className="min-w-[140px]"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Begin Journey
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canProceed() || isTransitioning}
              className="min-w-[100px]"
            >
              {isTransitioning ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};
