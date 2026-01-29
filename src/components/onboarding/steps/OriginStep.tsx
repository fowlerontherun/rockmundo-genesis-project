import { Loader2 } from "lucide-react";
import { useCharacterOrigins } from "@/hooks/useCharacterIdentity";
import { OriginCard } from "../OriginCard";
import type { OnboardingData } from "../OnboardingWizard";

interface OriginStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export const OriginStep = ({ data, updateData }: OriginStepProps) => {
  const { data: origins = [], isLoading } = useCharacterOrigins();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">
          Where Did Your Journey Begin?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your origin shapes your starting abilities and opens unique opportunities.
        </p>
      </div>

      {/* Origin grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {origins.map((origin) => (
          <OriginCard
            key={origin.id}
            origin={origin}
            isSelected={data.originId === origin.id}
            onSelect={() => updateData({ originId: origin.id })}
          />
        ))}
      </div>

      {/* Selection hint */}
      {!data.originId && (
        <p className="text-center text-sm text-muted-foreground">
          Select an origin to continue
        </p>
      )}
    </div>
  );
};
