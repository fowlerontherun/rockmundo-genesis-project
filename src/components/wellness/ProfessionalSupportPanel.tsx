import { CalendarClock, HeartHandshake, ShieldCheck, Star, UserRoundCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WELLNESS_PROFESSIONAL_ROLES, WELLNESS_SERVICES, calculateProfessionalReputation, calculateServiceOutcome, deriveQualificationTier, type WellnessProfessionalRole } from "@/lib/wellnessProfessionals";
import type { WellnessCoreValues } from "@/lib/wellnessSystem";

interface ProfessionalSupportPanelProps {
  vitals: WellnessCoreValues;
  fame?: number;
}

const recommendedRoles = (vitals: WellnessCoreValues): WellnessProfessionalRole[] => {
  const roles: WellnessProfessionalRole[] = [];
  if (vitals.fatigue > 65 || vitals.fitness < 45) roles.push("personal_trainer", "massage_therapist");
  if (vitals.physical_health < 55) roles.push("physiotherapist");
  if (vitals.stress > 60 || vitals.burnout_risk > 55) roles.push("therapist");
  if (vitals.nutrition < 60) roles.push("nutritionist");
  if (roles.length === 0) roles.push("wellness_coach", "vocal_coach");
  return Array.from(new Set(roles)).slice(0, 4);
};

const professionalExamples = [
  {
    id: "npc-wellness-coach",
    name: "City Wellness Desk",
    role: "wellness_coach" as const,
    kind: "NPC baseline",
    service: "wellness_review" as const,
    skills: { coaching: 38, communication: 42, empathy: 36, organisation: 40 },
    completed: 0,
    reputation: 24,
    reliability: 88,
    relation: "Drop-in",
    next: "Baseline availability",
  },
  {
    id: "player-vocal-coach",
    name: "Qualified player provider",
    role: "vocal_coach" as const,
    kind: "Real-player ceiling",
    service: "vocal_coaching_session" as const,
    skills: { vocal_technique: 76, coaching: 68, communication: 72, reliability: 83 },
    completed: 54,
    reputation: 58,
    reliability: 91,
    relation: "Freelance / employed",
    next: "Uses schedule conflicts",
  },
];

export function ProfessionalSupportPanel({ vitals, fame = 0 }: ProfessionalSupportPanelProps) {
  const roles = recommendedRoles(vitals);
  const unlockedContracts = fame >= 1000;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartHandshake className="h-4 w-4 text-primary" /> Professional Support
          <Badge variant="outline">Server rules</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Qualified NPC and real-player professionals use the normal scheduler, finance ledger, staff jobs and wellness outcome caps. This is fictional game support, not real-world healthcare.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <section aria-labelledby="support-team-heading">
          <h2 id="support-team-heading" className="mb-2 text-sm font-semibold">Current support team patterns</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {professionalExamples.map((provider) => {
              const qualification = deriveQualificationTier({ role: provider.role, skills: provider.skills, completedServices: provider.completed, reputation: provider.reputation, reliability: provider.reliability }) ?? "trainee";
              const rep = calculateProfessionalReputation({ completedAppointments: provider.completed, reliability: provider.reliability, averageRating: 4.4, outcomeConsistency: 78 });
              const outcome = calculateServiceOutcome({ providerKind: provider.kind.startsWith("Real") ? "player" : "npc", role: provider.role, service: provider.service, qualification, relevantSkillAverage: Object.values(provider.skills).reduce((a, b) => a + b, 0) / Object.values(provider.skills).length, providerWellness: vitals, providerReliability: provider.reliability, conditionCompatible: true, carePlanAdherence: 40, familiarityCount: provider.kind.startsWith("Real") ? 4 : 0 });
              return (
                <article key={provider.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{provider.name}</p>
                      <p className="text-xs text-muted-foreground">{WELLNESS_PROFESSIONAL_ROLES[provider.role].label} · {provider.relation}</p>
                    </div>
                    <Badge variant="secondary" className="capitalize">{qualification}</Badge>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><dt className="text-muted-foreground">Reliability</dt><dd className="font-medium">{provider.reliability}%</dd></div>
                    <div><dt className="text-muted-foreground">Reputation</dt><dd className="font-medium">{rep.state} ({rep.score})</dd></div>
                    <div><dt className="text-muted-foreground">Next appointment</dt><dd className="font-medium">{provider.next}</dd></div>
                    <div><dt className="text-muted-foreground">Expected quality</dt><dd className="font-medium">{Math.round(outcome.quality * 100)}%</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="appointments-heading" className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border p-3">
            <h2 id="appointments-heading" className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4" /> Appointment lifecycle</h2>
            <p className="mt-1 text-xs text-muted-foreground">Booked sessions require client and provider availability, payment validation, attendance evidence and idempotent completion before benefits, XP or reviews unlock.</p>
          </div>
          <div className="rounded-lg border p-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" /> Contracts & care plans</h2>
            <p className="mt-1 text-xs text-muted-foreground">{unlockedContracts ? "Ongoing weekly, monthly, band and tour support can create scheduled work without guaranteeing perfect outcomes." : "Ongoing contracts unlock at Professional Artist tier; basic one-off support stays available now."}</p>
          </div>
          <div className="rounded-lg border p-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><Star className="h-4 w-4" /> Abuse controls</h2>
            <p className="mt-1 text-xs text-muted-foreground">Self-booking, fake reviews, refunded XP, circular payments and repeated low-value pair farming are rejected or diminished server-side.</p>
          </div>
        </section>

        <section aria-labelledby="recommendations-heading">
          <h2 id="recommendations-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold"><UserRoundCheck className="h-4 w-4" /> Recommended professionals</h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {roles.map((role) => {
              const def = WELLNESS_PROFESSIONAL_ROLES[role];
              const service = WELLNESS_SERVICES[def.supportedServices[0]];
              return (
                <div key={role} className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{def.label}</p><Badge variant="outline">${Math.round(service.baseFeeCents / 100)}</Badge></div>
                  <p className="mt-1 text-xs text-muted-foreground">{def.summary}</p>
                  <p className="mt-2 text-xs"><span className="font-medium">Service:</span> {service.label} · {service.durationMinutes}m · {service.remoteEligible ? "remote or local" : "local only"}</p>
                </div>
              );
            })}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
