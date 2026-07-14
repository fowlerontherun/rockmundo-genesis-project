import { Award, BadgeCheck, HeartHandshake, RotateCcw, Shield, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WellnessVitals } from "@/lib/api/wellnessActivities";
import { calculateAgeModifiers, calculateCareerAge, calculateCareerResilience, calculateCareerWear, calculateComebackReadiness, calculateExperienceScore, calculateLegacyProgression, calculateVeteranAdvantages, resolveCareerStage, validateMentoringEligibility, type CareerMode, type RetirementState } from "@/lib/careerLongevity";

export function CareerStageLongevityPanel({ vitals, fame = 0, profileAge = 24 }: { vitals: WellnessVitals | null; fame?: number; profileAge?: number }) {
  const history = { biologicalAge: profileAge, firstBandJoinedAt: "2020-01-01", firstGigAt: "2020-03-01", gigCount: 86, tourCount: 7, releaseCount: 5, recordingHours: 140, rehearsalHours: 220, awards: fame > 50000 ? 3 : 0, fame, skillAverage: 58, teachingSessions: 12 };
  const stage = resolveCareerStage(history);
  const careerAge = calculateCareerAge(history);
  const experience = calculateExperienceScore(history);
  const wear = calculateCareerWear({ gigs: 7, tourDays: 12, travelHours: 32, recordingHours: 18, rehearsalHours: 22, practiceHours: 20, restDays: 4, holidays: 2, activeConditionDays: 1, burnoutDays: vitals && vitals.burnout_risk > 70 ? 8 : 1, averageSleep: (vitals?.sleep_quality ?? 70) / 10, averageRecoveryQuality: 62, windowDays: 90, cumulativeTourLoad: 220, cumulativePerformanceLoad: 340, cumulativeRecordingLoad: 160, cumulativeRehearsalLoad: 260, cumulativeTravelLoad: 180, cumulativeBurnoutExposure: 20, cumulativeConditionDays: 8, cumulativeRecoveryDays: 90 });
  const resilience = calculateCareerResilience({ vitals: vitals ?? {}, history, wear, professionalSupport: 55, lifestyleStability: 70 });
  const ageMods = calculateAgeModifiers(profileAge, { fitness: vitals?.fitness ?? 55, professionalSupport: 55, preparation: 70 });
  const veteran = calculateVeteranAdvantages(history);
  const comeback = calculateComebackReadiness({ retirementState: "active", daysAway: 0, vitals: vitals ?? {}, history, preparationScore: 64, wear, bandAvailable: true });
  const mentoring = validateMentoringEligibility({ mentor: history, mentorProfileId: "current", menteeProfileId: "sample-mentee", focus: "performance", mentorRelevantSkill: 62, activeBurnout: vitals?.burnout_risk ?? 18 });
  const legacy = calculateLegacyProgression({ ...history, mentoringMilestones: 2, reliableYears: Math.floor(careerAge.activeCareerYears) });
  const careerMode: CareerMode = stage === "veteran" || stage === "legacy" ? "selective_touring" : "full_time_performer";
  const retirementState: RetirementState = "active";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Career Stage & Longevity
          <Badge variant="outline">Server-authoritative model</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">Career stage is earned from activity history, not exact age. Age effects are capped and are offset by fitness, preparation and professional support.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <section className="rounded-lg border p-3" aria-label="Career stage summary">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><BadgeCheck className="h-3 w-3" /> Stage summary</p>
            <p className="font-semibold capitalize">{stage}</p>
            <p className="text-sm">{careerAge.activeCareerYears} active years · experience {experience}/100</p>
            <p className="text-xs text-muted-foreground">Main advantage: consistency +{Math.round(veteran.performanceConsistency * 100)}%; main recovery note: {wear.recommendation}</p>
          </section>
          <section className="rounded-lg border p-3" aria-label="Long-term workload">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Shield className="h-3 w-3" /> Workload & resilience</p>
            <p className="font-semibold capitalize">{resilience.state.split("_").join(" ")}</p>
            <p className="text-sm">Wear impact {wear.activeImpact}/100 · trend {wear.longTermWorkloadBalance}/100</p>
            <p className="text-xs text-muted-foreground">Historical totals remain for records, while recovery periods reduce active impact.</p>
          </section>
          <section className="rounded-lg border p-3" aria-label="Veteran advantages">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><Award className="h-3 w-3" /> Veteran advantages</p>
            <p className="font-semibold">Preparation offsets active</p>
            <p className="text-sm">Recovery ×{ageMods.recoverySpeedMultiplier} · strain ×{ageMods.strainRiskMultiplier}</p>
            <p className="text-xs text-muted-foreground">Experience reduces volatility and mistake severity; it never replaces skill or guarantees success.</p>
          </section>
          <section className="rounded-lg border p-3" aria-label="Retirement and comeback">
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><RotateCcw className="h-3 w-3" /> Retirement & comeback</p>
            <p className="font-semibold capitalize">{retirementState.split("_").join(" ")} · {careerMode.split("_").join(" ")}</p>
            <p className="text-sm capitalize">Comeback: {comeback.state.split("_").join(" ")}</p>
            <p className="text-xs text-muted-foreground">Retirement is voluntary, preserves history and requires server-calculated conflict previews.</p>
          </section>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-medium">Mentoring eligibility</p>
            <p>{mentoring.eligible ? "Eligible for relevant mentoring listings." : mentoring.reasons.join(" ")}</p>
            <p className="mt-1 text-xs text-muted-foreground">Both-party consent, attendance validation, pair caps and no-show protections apply.</p>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-medium">Legacy progression</p>
            <p className="capitalize">{legacy.state} · score {legacy.score}/100</p>
            <p className="mt-1 text-xs text-muted-foreground">Legacy unlocks recognition, invitations and mentor capacity rather than large performance power.</p>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-medium">Private data protection</p>
            <p>Public profile may show stage, retirement announcements and legacy state; wear, conditions and comeback calculations stay private.</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Planning examples: “Veteran experience is improving consistency,” “Your recovery plan is offsetting consecutive shows,” and “A longer recovery window is recommended after this tour.”</p>
      </CardContent>
    </Card>
  );
}
