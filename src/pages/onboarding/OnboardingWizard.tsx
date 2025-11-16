import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";

import { AvatarPreview } from "@/components/onboarding/AvatarPreview";
import { BiographyInput } from "@/components/onboarding/BiographyInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import {
  ensurePlayerProfile,
  updatePlayerOnboarding,
  type PlayerProfile,
} from "@/lib/api/players";

interface StepDefinition {
  title: string;
  description: string;
}

const STEPS: StepDefinition[] = [
  {
    title: "Stage identity",
    description: "Pick the name other players will see across the world.",
  },
  {
    title: "Avatar",
    description: "Add a face to the name with a custom image.",
  },
  {
    title: "Biography",
    description: "Share a short introduction and musical influences.",
  },
  {
    title: "Review",
    description: "Confirm your choices before entering the city.",
  },
];

interface FormState {
  displayName: string;
  avatarUrl: string;
  bio: string;
}

const defaultFormState: FormState = {
  displayName: "",
  avatarUrl: "",
  bio: "",
};

const StepIndicator = ({ currentStep }: { currentStep: number }) => {
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Step {currentStep + 1} of {STEPS.length}</p>
          <h2 className="text-2xl font-semibold text-foreground">{STEPS[currentStep]?.title}</h2>
          <p className="text-sm text-muted-foreground">{STEPS[currentStep]?.description}</p>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <ol className="flex flex-wrap items-center gap-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep;
          return (
            <li key={step.title} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[0.75rem] ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : isComplete
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {index + 1}
              </span>
              <span className={isActive ? "text-foreground" : "text-muted-foreground"}>{step.title}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const ReviewCard = ({ profile }: { profile: FormState }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Review your persona</CardTitle>
        <CardDescription>Take a quick look before you launch into Rockmundo.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 sm:flex-row">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-border bg-muted shadow-sm">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl font-semibold text-muted-foreground">
                {profile.displayName
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((segment) => segment.charAt(0).toUpperCase())
                  .join("") || "??"}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Avatar preview</p>
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Stage name</h3>
            <p className="text-base font-medium text-foreground">{profile.displayName || "Not set"}</p>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Biography</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {profile.bio.trim().length > 0 ? profile.bio : "No bio yet. You can update this anytime."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const OnboardingWizard = () => {
  const { user, loading: authLoading, session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(0);
  const [formState, setFormState] = useState<FormState>(defaultFormState);

  const profileQuery = useQuery<PlayerProfile>({
    queryKey: ["player-profile", user?.id],
    queryFn: async () => {
      if (!user) {
        throw new Error("User session required to load profile");
      }
      const profile = await ensurePlayerProfile(user);
      return profile;
    },
    enabled: Boolean(user),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (profileQuery.data) {
      setFormState({
        displayName: profileQuery.data.display_name ?? "",
        avatarUrl: profileQuery.data.avatar_url ?? "",
        bio: profileQuery.data.bio ?? "",
      });
    }
  }, [profileQuery.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profileQuery.data) {
        throw new Error("Missing player profile");
      }
      return updatePlayerOnboarding(profileQuery.data.id, {
        displayName: formState.displayName,
        avatarUrl: formState.avatarUrl,
        bio: formState.bio,
      });
    },
    onSuccess: (updatedProfile) => {
      setFormState({
        displayName: updatedProfile.display_name ?? "",
        avatarUrl: updatedProfile.avatar_url ?? "",
        bio: updatedProfile.bio ?? "",
      });
      queryClient.setQueryData(["player-profile", user?.id], updatedProfile);
      toast({
        title: "Onboarding saved",
        description: "Your profile is ready. Welcome to Rockmundo!",
      });
      navigate("/dashboard");
    },
    onError: (error: unknown) => {
      console.error("onboarding.save.error", error);
      toast({
        title: "We hit a snag",
        description: error instanceof Error ? error.message : "Unable to save your onboarding details.",
        variant: "destructive",
      });
    },
  });

  const isLoading = authLoading || profileQuery.isLoading;
  const errorMessage = profileQuery.error instanceof Error ? profileQuery.error.message : null;

  const canGoBack = currentStep > 0;
  const canGoNext = currentStep < STEPS.length - 1;
  const continueDisabled =
    mutation.isLoading || (currentStep === 0 && formState.displayName.trim().length === 0);

  const handleNext = () => {
    setCurrentStep((step) => Math.min(step + 1, STEPS.length - 1));
  };

  const handlePrev = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const handleSubmit = () => {
    mutation.mutate();
  };

  const stageNameContent = (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        This name appears on leaderboards, gig posters, and multiplayer events. Make it memorable!
      </p>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Stage name</span>
        <input
          type="text"
          value={formState.displayName}
          onChange={(event) =>
            setFormState((state) => ({
              ...state,
              displayName: event.target.value,
            }))
          }
          placeholder="e.g. Nova Blaze"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        />
      </label>
      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Pro tip: You can change this later from your character profile.
      </div>
    </div>
  );

  const avatarContent = (
    <AvatarPreview
      value={formState.avatarUrl}
      onChange={(value) =>
        setFormState((state) => ({
          ...state,
          avatarUrl: value,
        }))
      }
      placeholderInitials={formState.displayName}
      disabled={mutation.isLoading}
    />
  );

  const bioContent = (
    <BiographyInput
      value={formState.bio}
      onChange={(value) =>
        setFormState((state) => ({
          ...state,
          bio: value,
        }))
      }
      disabled={mutation.isLoading}
    />
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return stageNameContent;
      case 1:
        return avatarContent;
      case 2:
        return bioContent;
      case 3:
        return <ReviewCard profile={formState} />;
      default:
        return stageNameContent;
    }
  };

  if (!session && !authLoading) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-10">
      <Card className="border-none bg-gradient-to-br from-background via-background to-muted shadow-xl">
        <CardHeader className="border-b border-border/40 bg-background/70">
          <CardTitle className="text-3xl font-bold">Welcome to Rockmundo</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Let&apos;s personalize your character before dropping you into the action.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 py-8">
          <StepIndicator currentStep={currentStep} />

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <p className="text-sm text-muted-foreground">Loading your profile...</p>
            </div>
          ) : errorMessage ? (
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                {errorMessage}
              </div>
              <Button variant="outline" onClick={() => profileQuery.refetch()} disabled={mutation.isLoading}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {renderStepContent()}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  {canGoBack && (
                    <Button variant="ghost" onClick={handlePrev} disabled={mutation.isLoading}>
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {canGoNext ? (
                    <Button onClick={handleNext} disabled={continueDisabled}>
                      Continue
                    </Button>
                  ) : (
                    <Button onClick={handleSubmit} disabled={mutation.isLoading}>
                      {mutation.isLoading ? "Saving..." : "Complete onboarding"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingWizard;
