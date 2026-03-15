import { User } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { OnboardingData } from "../OnboardingWizard";

interface GenderStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

const GENDER_OPTIONS = [
  { value: "male", label: "Male", emoji: "♂️" },
  { value: "female", label: "Female", emoji: "♀️" },
  { value: "non_binary", label: "Non-Binary", emoji: "⚧️" },
  { value: "other", label: "Prefer not to say", emoji: "🎵" },
];

export const GenderStep = ({ data, updateData }: GenderStepProps) => {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <User className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Who Are You?</h2>
        <p className="mt-2 text-muted-foreground">
          Choose how you'd like your character to be represented.
        </p>
      </div>

      <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
        {GENDER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => updateData({ gender: option.value })}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border-2 p-6 transition-all hover:border-primary/50",
              data.gender === option.value
                ? "border-primary bg-primary/10 shadow-md"
                : "border-border bg-card"
            )}
          >
            <span className="text-3xl">{option.emoji}</span>
            <Label className="cursor-pointer text-base font-medium">{option.label}</Label>
          </button>
        ))}
      </div>
    </div>
  );
};
