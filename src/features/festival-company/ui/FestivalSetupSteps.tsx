import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const festivalSetupSteps = ["Identity", "When & where", "Atmosphere", "Promotion & budget", "Review"] as const;

export function FestivalSetupSteps({ step, onChange, canContinue = true, busy = false, children }: {
  step: number; onChange: (step: number) => void; canContinue?: boolean; busy?: boolean; children: React.ReactNode;
}) {
  return <div className="min-w-0 space-y-5">
    <nav aria-label="Festival setup steps" className="flex gap-2 overflow-x-auto border-b pb-3">
      {festivalSetupSteps.map((label, index) => <Button key={label} variant={step === index ? "default" : "ghost"}
        size="sm" className="shrink-0 gap-2" aria-current={step === index ? "step" : undefined}
        disabled={busy || index > step && !canContinue} onClick={() => onChange(index)}>
        {index < step ? <Check className="h-3.5 w-3.5" /> : <span className="font-mono">{index + 1}</span>}{label}
      </Button>)}
    </nav>
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-lg font-semibold">{festivalSetupSteps[step]}</h3>
      <span className="text-xs text-muted-foreground">{step + 1} / {festivalSetupSteps.length}</span>
    </div>
    {children}
    <div className="flex justify-between border-t pt-4">
      <Button variant="outline" disabled={step === 0 || busy} onClick={() => onChange(step - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Back</Button>
      {step < festivalSetupSteps.length - 1 && <Button disabled={!canContinue || busy} onClick={() => onChange(step + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>}
    </div>
  </div>;
}