import { HeartHandshake, HeartPulse, ShieldCheck, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAddictions } from "@/hooks/useAddictions";
import { getAddictionTypeLabel, getSeverityLabel, type RecoveryProgram } from "@/utils/addictionSystem";

const PROGRAMS: Array<{ id: RecoveryProgram; label: string; detail: string }> = [
  { id: "therapy", label: "Therapy", detail: "$100 per session · keeps normal activities available" },
  { id: "rehab", label: "Residential rehab", detail: "$1,200 · 10 days · blocks other scheduled activity" },
  { id: "cold_turkey", label: "Self-directed recovery", detail: "Free · slowest recovery · no schedule block" },
];

export function RecoveryPanel() {
  const { addictions, isLoading, startRecovery, isStartingRecovery, attendTherapy, isAttendingTherapy } = useAddictions();

  return (
    <Card className="border-emerald-500/20 bg-gradient-to-br from-card to-emerald-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><HeartHandshake className="h-4 w-4" /> Addiction & Recovery</CardTitle>
        <CardDescription>
          Nightclub excess, Underworld consumables and substance dependency now feed one persistent system. Recovery is optional, but untreated problems can keep worsening when the same risks are repeated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Checking current recovery state…</p>
        ) : addictions.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border bg-background/70 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> No active addictions. Exposure can build gradually, so repeated high-risk nights still matter.
          </div>
        ) : (
          addictions.map((addiction) => {
            const extended = addiction as typeof addiction & {
              withdrawal_until?: string | null;
              recovery_ends_at?: string | null;
              recovery_sessions?: number;
              support_score?: number;
              last_exposure_at?: string | null;
            };
            const severity = getSeverityLabel(addiction.severity);
            const recovering = addiction.status === "recovering";
            const withdrawalActive = Boolean(extended.withdrawal_until && new Date(extended.withdrawal_until).getTime() > Date.now());

            return (
              <div key={addiction.id} className="space-y-3 rounded-lg border bg-background/70 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{getAddictionTypeLabel(addiction.addiction_type)}</span>
                      <Badge variant={recovering ? "secondary" : addiction.status === "relapsed" ? "destructive" : "outline"} className="text-[10px] capitalize">{addiction.status}</Badge>
                      <Badge variant="outline" className={`text-[10px] ${severity.color}`}>{severity.label}</Badge>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {recovering ? `${addiction.days_clean} clean day${addiction.days_clean === 1 ? "" : "s"} · ${extended.recovery_sessions ?? 0} supported sessions` : "Repeated exposure increases severity and can make later recovery harder."}
                    </p>
                  </div>
                  <span className="text-xs font-semibold">{addiction.severity}/100</span>
                </div>

                <Progress value={addiction.severity} className="h-2" />

                {withdrawalActive && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                    <HeartPulse className="h-3.5 w-3.5" /> Early recovery effects are active until {new Date(extended.withdrawal_until!).toLocaleString()}.
                  </div>
                )}

                {recovering ? (
                  <div className="flex flex-wrap gap-2">
                    {addiction.recovery_program === "therapy" && (
                      <Button size="sm" variant="secondary" disabled={isAttendingTherapy} onClick={() => attendTherapy(addiction.id)}>
                        <Stethoscope className="mr-1 h-3.5 w-3.5" /> Attend $100 therapy session
                      </Button>
                    )}
                    <Badge variant="outline" className="text-[10px] capitalize">Programme: {addiction.recovery_program?.replaceAll("_", " ")}</Badge>
                    {extended.recovery_ends_at && <Badge variant="outline" className="text-[10px]">Rehab ends {new Date(extended.recovery_ends_at).toLocaleDateString()}</Badge>}
                  </div>
                ) : (
                  <div className="grid gap-2 md:grid-cols-3">
                    {PROGRAMS.map((program) => (
                      <Button key={program.id} size="sm" variant={program.id === "rehab" ? "default" : "secondary"} disabled={isStartingRecovery} onClick={() => startRecovery({ addictionId: addiction.id, program: program.id })} className="h-auto min-h-14 justify-start whitespace-normal text-left">
                        <span><span className="block font-medium">{program.label}</span><span className="block text-[10px] opacity-80">{program.detail}</span></span>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
