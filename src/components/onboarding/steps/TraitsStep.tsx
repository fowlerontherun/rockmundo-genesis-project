import { Loader2, Info } from "lucide-react";
import { useTraitsByCategory, useTraitCompatibility } from "@/hooks/useCharacterIdentity";
import { TraitBadge } from "../TraitBadge";
import { TRAIT_CATEGORIES } from "@/types/roleplaying";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { OnboardingData } from "../OnboardingWizard";

interface TraitsStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
}

export const TraitsStep = ({ data, updateData }: TraitsStepProps) => {
  const { traitsByCategory, isLoading } = useTraitsByCategory();
  const { areTraitsCompatible, getIncompatibleTraits } = useTraitCompatibility();

  const handleToggleTrait = (traitId: string) => {
    const currentTraits = [...data.traitIds];
    const index = currentTraits.indexOf(traitId);

    if (index >= 0) {
      // Remove trait
      currentTraits.splice(index, 1);
    } else if (currentTraits.length < 3) {
      // Add trait if compatible
      const potentialTraits = [...currentTraits, traitId];
      if (areTraitsCompatible(potentialTraits)) {
        currentTraits.push(traitId);
      }
    }

    updateData({ traitIds: currentTraits });
  };

  const isTraitDisabled = (traitId: string): boolean => {
    // Already selected
    if (data.traitIds.includes(traitId)) return false;
    
    // Max traits reached
    if (data.traitIds.length >= 3) return true;

    // Check compatibility
    const potentialTraits = [...data.traitIds, traitId];
    return !areTraitsCompatible(potentialTraits);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectionCount = data.traitIds.length;
  const isValidSelection = selectionCount >= 2 && selectionCount <= 3;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-foreground">
          What Defines You as an Artist?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose 2-3 personality traits that shape your approach to music and life.
        </p>
      </div>

      {/* Selection status */}
      <div className="flex items-center justify-center gap-2">
        <div
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            isValidSelection
              ? "bg-green-500/10 text-green-500"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {selectionCount}/3 traits selected
          {selectionCount < 2 && " (min 2)"}
        </div>
      </div>

      {/* Trait categories */}
      <div className="space-y-6">
        {TRAIT_CATEGORIES.map((category) => (
          <div key={category.key} className="space-y-3">
            <div>
              <h3 className="font-semibold text-foreground">{category.name}</h3>
              <p className="text-xs text-muted-foreground">{category.description}</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {traitsByCategory[category.key]?.map((trait) => (
                <TraitBadge
                  key={trait.id}
                  trait={trait}
                  isSelected={data.traitIds.includes(trait.id)}
                  isDisabled={isTraitDisabled(trait.id)}
                  onClick={() => handleToggleTrait(trait.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Incompatibility hint */}
      <Alert variant="default" className="bg-muted/50">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Some traits are mutually exclusive. Incompatible traits will be grayed out.
        </AlertDescription>
      </Alert>
    </div>
  );
};
