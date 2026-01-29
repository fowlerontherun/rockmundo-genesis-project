import { User, Users, UsersRound, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OnboardingData } from "../OnboardingWizard";

interface CareerPathStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

const CAREER_PATHS = [
  {
    id: "solo",
    title: "Solo Artist",
    description: "Full creative control over your music and career",
    icon: User,
    benefits: ["Complete artistic freedom", "Keep all earnings", "Build personal brand"],
    challenges: ["Harder start", "No band chemistry bonus", "Limited live performance options"],
  },
  {
    id: "form_band",
    title: "Form a Band",
    description: "Create a new band with AI-generated members",
    icon: Users,
    benefits: ["Band chemistry bonuses", "Shared workload", "Fuller live sound"],
    challenges: ["Split earnings", "Creative compromises", "Member management"],
  },
  {
    id: "join_band",
    title: "Join Existing Band",
    description: "Browse and apply to join player-run bands",
    icon: UsersRound,
    benefits: ["Immediate community", "Learn from others", "Shared resources"],
    challenges: ["Less control", "Must prove yourself", "Band politics"],
  },
];

export const CareerPathStep = ({ data, updateData }: CareerPathStepProps) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">
          How Do You Want to Start?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose your initial career path. You can always change direction later.
        </p>
      </div>

      {/* Career path options */}
      <div className="grid gap-4 md:grid-cols-3">
        {CAREER_PATHS.map((path) => {
          const isSelected = data.careerGoal === path.id;
          const Icon = path.icon;

          return (
            <button
              key={path.id}
              onClick={() => updateData({ careerGoal: path.id })}
              className={cn(
                "group relative flex flex-col rounded-xl border-2 p-5 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-4 w-4" />
                </div>
              )}

              {/* Icon */}
              <div
                className={cn(
                  "mb-3 flex h-12 w-12 items-center justify-center rounded-lg transition-colors",
                  isSelected ? "bg-primary/20" : "bg-muted"
                )}
              >
                <Icon
                  className={cn(
                    "h-6 w-6 transition-colors",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}
                />
              </div>

              {/* Title & description */}
              <h3 className="mb-1 font-semibold text-foreground">{path.title}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{path.description}</p>

              {/* Benefits */}
              <div className="mb-3 space-y-1">
                <p className="text-xs font-medium text-green-500">Benefits:</p>
                <ul className="space-y-0.5">
                  {path.benefits.map((benefit) => (
                    <li key={benefit} className="text-xs text-muted-foreground">
                      + {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Challenges */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-orange-500">Challenges:</p>
                <ul className="space-y-0.5">
                  {path.challenges.map((challenge) => (
                    <li key={challenge} className="text-xs text-muted-foreground">
                      − {challenge}
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
