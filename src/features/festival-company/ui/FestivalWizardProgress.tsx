import { Button } from "@/components/ui/button";

const labels = ["Identity", "Annual pattern & location", "Vibe & site", "Scale & policy", "First edition dates", "Review"];
export function FestivalWizardProgress({
  currentStep,
  maximumStep,
  onSelect,
}: {
  currentStep: number;
  maximumStep: number;
  onSelect: (step: number) => void;
}) {
  return (
    <nav aria-label="Festival configuration steps">
      <ol className="grid grid-cols-1 gap-2 xs:grid-cols-2 lg:grid-cols-6">
        {labels.map((label, index) => {
          const step = index + 1;
          const unavailable = step > maximumStep;
          const reason = unavailable
            ? step === 2
              ? "Complete a valid identity first."
              : "Complete the preceding required fields first."
            : undefined;
          return (
            <li key={label}>
              <Button
                type="button"
                className="min-h-11 w-full whitespace-normal"
                variant={currentStep === step ? "default" : "outline"}
                aria-current={currentStep === step ? "step" : undefined}
                aria-disabled={unavailable}
                disabled={unavailable}
                title={reason}
                onClick={() => onSelect(step)}
              >
                {step}. {label}
                {reason && (
                  <span className="sr-only"> Unavailable: {reason}</span>
                )}
              </Button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
