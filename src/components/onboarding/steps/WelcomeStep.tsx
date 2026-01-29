import { Sparkles, Music } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OnboardingData } from "../OnboardingWizard";

interface WelcomeStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export const WelcomeStep = ({ data, updateData }: WelcomeStepProps) => {
  return (
    <div className="space-y-8">
      {/* Hero section */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          Welcome to Your Musical Journey
        </h2>
        <p className="mt-2 text-muted-foreground">
          Every legend has a beginning. Let's create yours.
        </p>
      </div>

      {/* Name inputs */}
      <div className="mx-auto max-w-md space-y-6">
        <div className="space-y-2">
          <Label htmlFor="displayName" className="text-base">
            What's your name?
          </Label>
          <Input
            id="displayName"
            placeholder="Your real name or nickname"
            value={data.displayName}
            onChange={(e) => updateData({ displayName: e.target.value })}
            className="h-12 text-lg"
            autoFocus
          />
          <p className="text-sm text-muted-foreground">
            This is how you'll be known behind the scenes.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="artistName" className="text-base">
            <Music className="mr-2 inline-block h-4 w-4" />
            Stage Name (Optional)
          </Label>
          <Input
            id="artistName"
            placeholder="Your artist persona"
            value={data.artistName}
            onChange={(e) => updateData({ artistName: e.target.value })}
            className="h-12 text-lg"
          />
          <p className="text-sm text-muted-foreground">
            The name that will appear on marquees and album covers.
          </p>
        </div>
      </div>

      {/* Inspirational quote */}
      <div className="mx-auto max-w-lg rounded-lg border border-border/50 bg-card/50 p-6 text-center">
        <blockquote className="italic text-muted-foreground">
          "Every artist was first an amateur."
        </blockquote>
        <cite className="mt-2 block text-sm text-muted-foreground/70">
          — Ralph Waldo Emerson
        </cite>
      </div>
    </div>
  );
};
