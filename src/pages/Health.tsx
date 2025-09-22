import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useGameData } from "@/hooks/useGameData";
import {
  Activity,
  Brain,
  Dumbbell,
  HeartPulse,
  Leaf,
  Moon,
  Syringe,
} from "lucide-react";
import { Link } from "react-router-dom";

const clampToPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const getHealthStatus = (health: number) => {
  if (health >= 85) return "Peak condition";
  if (health >= 70) return "Stable";
  if (health >= 50) return "Needs attention";
  return "Critical";
};

const getStressLabel = (stress: number) => {
  if (stress <= 25) return "Relaxed";
  if (stress <= 55) return "Managing";
  if (stress <= 80) return "Elevated";
  return "Overloaded";
};

const getFitnessLabel = (fitness: number) => {
  if (fitness >= 85) return "Athletic";
  if (fitness >= 65) return "Conditioned";
  if (fitness >= 45) return "Developing";
  return "Detrained";
};

const getBodyShape = (fitness: number) => {
  if (fitness >= 85) return "Sculpted";
  if (fitness >= 65) return "Lean";
  if (fitness >= 45) return "Balanced";
  return "Needs Training";
};

const formatLabel = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const cleaned = value.replace(/[_-]+/g, " ").trim();
  if (cleaned.length === 0) {
    return null;
  }

  return cleaned
    .split(" ")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const HealthPage = () => {
  const {
    profile,
    attributes,
    loading,
    healthMetrics,
    healthConditions,
    healthHabits,
    wellnessRecommendations,
  } = useGameData();

  const baseHealth = typeof profile?.health === "number" ? profile.health : null;
  const healthValue = clampToPercent(
    typeof healthMetrics?.health_score === "number" ? healthMetrics.health_score : baseHealth ?? 100,
  );
  const averageAttribute = attributes
    ? clampToPercent(
        Object.values(attributes).reduce((sum, value) => sum + (value ?? 0), 0) /
          Object.keys(attributes).length,
      )
    : 55;

  const fallbackStressLevel = clampToPercent(100 - healthValue / 1.5 + (100 - averageAttribute) / 3);
  const stressLevel = clampToPercent(
    typeof healthMetrics?.stress_level === "number" ? healthMetrics.stress_level : fallbackStressLevel,
  );
  const fallbackFitnessLevel = clampToPercent((healthValue + averageAttribute) / 2);
  const fitnessLevel = clampToPercent(
    typeof healthMetrics?.fitness_level === "number" ? healthMetrics.fitness_level : fallbackFitnessLevel,
  );
  const fallbackRecoveryLevel = clampToPercent(healthValue - fallbackStressLevel / 2 + averageAttribute / 4);
  const recoveryLevel = clampToPercent(
    typeof healthMetrics?.recovery_level === "number" ? healthMetrics.recovery_level : fallbackRecoveryLevel,
  );

  const stressLabel = getStressLabel(stressLevel);
  const fitnessLabel = getFitnessLabel(fitnessLevel);
  const bodyShape = getBodyShape(fitnessLevel);
  const healthStatus = getHealthStatus(healthValue);

  const fallbackIllnesses = (healthValue < 55 || stressLevel > 75)
    ? [
        {
          id: "fallback-fatigue",
          name: "Tour Fatigue",
          severity: healthValue < 40 ? "Severe" : "Mild",
          description: "Energy reserves are low after recent performances. Prioritize rest days.",
        },
        ...(stressLevel > 80
          ? [
              {
                id: "fallback-stress-overload",
                name: "Stress Overload",
                severity: "Moderate",
                description: "Mental strain is building. Incorporate mindfulness or downtime immediately.",
              },
            ]
          : []),
      ]
    : [];

  const illnesses =
    healthConditions.length > 0
      ? healthConditions.map((condition) => ({
          id: condition.id,
          name: condition.condition_name,
          severity:
            formatLabel(condition.severity) ?? condition.severity ?? "Unspecified",
          description:
            condition.description ??
            `No detailed notes recorded yet. Logged on ${
              condition.detected_at
                ? new Date(condition.detected_at).toLocaleDateString()
                : "a recent session"
            }.`,
        }))
      : fallbackIllnesses;

  const fallbackHabits =
    stressLevel > 70
      ? [
          {
            id: "fallback-caffeine",
            name: "Caffeine dependence",
            impact: "elevated",
            recommendation: "Recommend tapering with support from crew and wellness coach.",
          },
        ]
      : [];

  const activeHabits =
    healthHabits.length > 0
      ? healthHabits.map((habit) => ({
          id: habit.id,
          name: habit.habit_name,
          impact: formatLabel(habit.impact) ?? habit.impact ?? null,
          rawImpact: habit.impact ?? null,
          recommendation: habit.recommendation ?? null,
        }))
      : fallbackHabits.map((habit) => ({
          ...habit,
          impact: formatLabel(habit.impact) ?? habit.impact,
          rawImpact: habit.impact,
        }));

  const fallbackRecommendations = [
    {
      id: "fallback-health",
      recommendation:
        healthValue < 65
          ? "Plan lighter engagements this week to rebuild stamina."
          : "Maintain current routines and hydration to keep health steady.",
      priority: healthValue < 65 ? "high" : "normal",
      category: "health",
    },
    {
      id: "fallback-stress",
      recommendation:
        stressLevel > 55
          ? "Introduce a daily mindfulness or breathing exercise to lower stress."
          : "Keep using stress management habits before shows.",
      priority: stressLevel > 55 ? "high" : "normal",
      category: "stress",
    },
    {
      id: "fallback-fitness",
      recommendation:
        fitnessLevel < 60
          ? "Schedule cross-training or movement sessions twice this week."
          : "Keep consistent training blocks on the calendar.",
      priority: fitnessLevel < 60 ? "medium" : "normal",
      category: "fitness",
    },
    {
      id: "fallback-habits",
      recommendation:
        activeHabits.length > 0
          ? "Swap one caffeinated drink for hydration and sleep earlier on off-nights."
          : "Continue balanced nutrition and hydration routines.",
      priority: activeHabits.length > 0 ? "medium" : "normal",
      category: "habits",
    },
  ];

  const wellnessEntries =
    wellnessRecommendations.length > 0
      ? wellnessRecommendations.map((entry) => ({
          id: entry.id,
          recommendation: entry.recommendation,
          priority: entry.priority,
          category: entry.category,
        }))
      : fallbackRecommendations;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Health & Wellness</h1>
        <p className="text-muted-foreground">
          Monitor your artist&apos;s wellbeing, manage recovery time, and plan interventions before the next gig cycle.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <HeartPulse className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Overall Health</CardTitle>
                <p className="text-sm text-muted-foreground">{healthStatus}</p>
              </div>
            </div>
            <Badge variant="outline" className="px-3 py-1 text-sm">
              {healthValue}% stable
            </Badge>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Progress value={healthValue} className="h-3" />
              <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                <span>Current health index</span>
                <span>{healthValue}%</span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Stress Level",
                  value: `${stressLevel}%`,
                  label: stressLabel,
                  icon: Brain,
                  bar: stressLevel,
                },
                {
                  title: "Fitness Level",
                  value: `${fitnessLevel}%`,
                  label: fitnessLabel,
                  icon: Dumbbell,
                  bar: fitnessLevel,
                },
                {
                  title: "Recovery",
                  value: `${recoveryLevel}%`,
                  label: recoveryLevel >= 70 ? "On Track" : recoveryLevel >= 45 ? "Needs Rest" : "At Risk",
                  icon: Moon,
                  bar: recoveryLevel,
                },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.title} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{metric.title}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {metric.label}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      <Progress value={metric.bar} className="h-2" />
                      <div className="text-sm text-muted-foreground">{metric.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Body Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Body Shape</span>
              </div>
              <Badge variant="secondary">{bodyShape}</Badge>
            </div>
            <Separator />
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Average conditioning score is {fitnessLevel}%, driven by attribute balance of {averageAttribute}%.
              </p>
              <p>
                Maintain consistent sleep and nutrition rhythms to support touring stamina and studio focus.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Syringe className="h-5 w-5 text-primary" />
              <CardTitle>Illnesses & Conditions</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">Live diagnostics based on current health trends.</p>
          </CardHeader>
          <CardContent>
            {illnesses.length > 0 ? (
              <ul className="space-y-4">
                {illnesses.map((illness) => {
                  const severityLabel = illness.severity ?? "Unspecified";
                  const severityVariant = severityLabel.toLowerCase().includes("severe")
                    ? "destructive"
                    : "secondary";

                  return (
                    <li key={illness.id ?? illness.name} className="rounded-lg border bg-card/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">{illness.name}</div>
                        <Badge variant={severityVariant} className="text-xs">
                          {severityLabel}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{illness.description}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No active illnesses detected. Keep regular rest days and hydration to maintain resilience.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Leaf className="h-5 w-5 text-primary" />
              <CardTitle>Addictions & Habits</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">Track habits that could impact performance quality.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeHabits.length > 0 ? (
              <ul className="space-y-3">
                {activeHabits.map((habit) => {
                  const normalizedImpact = habit.rawImpact?.toLowerCase() ?? "";
                  const impactVariant = /severe|high|negative|elevated/.test(normalizedImpact)
                    ? "destructive"
                    : "secondary";

                  return (
                    <li key={habit.id ?? habit.name} className="rounded-lg border bg-card/80 p-3 text-sm space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{habit.name}</span>
                        {habit.impact ? (
                          <Badge variant={impactVariant} className="text-xs">
                            {habit.impact}
                          </Badge>
                        ) : null}
                      </div>
                      {habit.recommendation ? (
                        <p className="text-xs text-muted-foreground">{habit.recommendation}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No concerning habits logged. Continue reinforcing healthy recovery rituals.
              </div>
            )}
            <Separator />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Monitor late-night routines and stimulant intake during tour legs to avoid long-term strain.
              </p>
              <p>
                Pair heavy show weeks with deliberate recovery sessions for sustained creative output.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Health Services</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect with specialist support teams when you need targeted recovery plans or advanced care.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Therapy", to: "/health/therapy" },
              { label: "Rehab", to: "/health/rehab" },
              { label: "Wonder Drugs", to: "/health/wonder-drugs" },
              { label: "Cosmetic Surgery", to: "/health/cosmetic-surgery" },
              { label: "Doctor", to: "/health/doctor" },
            ].map((service) => (
              <Button key={service.to} asChild variant="outline" className="justify-start">
                <Link to={service.to}>{service.label}</Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Wellness Playbook</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading personalised recommendations...
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {wellnessEntries.map((entry) => {
                const normalizedPriority = entry.priority?.toLowerCase() ?? "normal";
                const priorityLabel = formatLabel(entry.priority);
                const showPriorityBadge = Boolean(priorityLabel && normalizedPriority !== "normal");
                const priorityVariant =
                  normalizedPriority === "high"
                    ? "destructive"
                    : normalizedPriority === "medium"
                    ? "secondary"
                    : "outline";
                const categoryLabel = formatLabel(entry.category);

                return (
                  <li key={entry.id} className="rounded-lg border bg-card/80 p-4 text-sm space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span>{entry.recommendation}</span>
                      {showPriorityBadge ? (
                        <Badge variant={priorityVariant} className="text-xs">
                          {priorityLabel}
                        </Badge>
                      ) : null}
                    </div>
                    {categoryLabel ? (
                      <p className="text-xs text-muted-foreground">Focus area: {categoryLabel}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HealthPage;
