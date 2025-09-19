import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const HealthPage = () => {
  const { profile, attributes, loading } = useGameData();

  const healthValue = clampToPercent(profile?.health ?? 72);
  const averageAttribute = attributes
    ? clampToPercent(
        Object.values(attributes).reduce((sum, value) => sum + (value ?? 0), 0) /
          Object.keys(attributes).length,
      )
    : 55;

  const stressLevel = clampToPercent(100 - healthValue / 1.5 + (100 - averageAttribute) / 3);
  const fitnessLevel = clampToPercent((healthValue + averageAttribute) / 2);
  const recoveryLevel = clampToPercent(healthValue - stressLevel / 2 + averageAttribute / 4);

  const stressLabel = getStressLabel(stressLevel);
  const fitnessLabel = getFitnessLabel(fitnessLevel);
  const bodyShape = getBodyShape(fitnessLevel);
  const healthStatus = getHealthStatus(healthValue);

  const hasIllness = healthValue < 55 || stressLevel > 75;
  const illnesses = hasIllness
    ? [
        {
          name: "Tour Fatigue",
          severity: healthValue < 40 ? "Severe" : "Mild",
          description: "Energy reserves are low after recent performances. Prioritize rest days.",
        },
        ...(stressLevel > 80
          ? [
              {
                name: "Stress Overload",
                severity: "Moderate",
                description: "Mental strain is building. Incorporate mindfulness or downtime immediately.",
              },
            ]
          : []),
      ]
    : [];

  const addictions = stressLevel > 70 ? ["Caffeine dependence"] : [];

  const wellnessSuggestions = [
    healthValue < 65
      ? "Plan lighter engagements this week to rebuild stamina."
      : "Maintain current routines and hydration to keep health steady.",
    stressLevel > 55
      ? "Introduce a daily mindfulness or breathing exercise to lower stress."
      : "Keep using stress management habits before shows.",
    fitnessLevel < 60
      ? "Schedule cross-training or movement sessions twice this week."
      : "Keep consistent training blocks on the calendar.",
    addictions.length > 0
      ? "Swap one caffeinated drink for hydration and sleep earlier on off-nights."
      : "Continue balanced nutrition and hydration routines.",
  ];

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
                {illnesses.map((illness) => (
                  <li key={illness.name} className="rounded-lg border bg-card/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{illness.name}</div>
                      <Badge variant="destructive">{illness.severity}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{illness.description}</p>
                  </li>
                ))}
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
            {addictions.length > 0 ? (
              <ul className="space-y-3">
                {addictions.map((habit) => (
                  <li key={habit} className="rounded-lg border bg-card/80 p-3 text-sm">
                    {habit} — recommend tapering with support from crew and wellness coach.
                  </li>
                ))}
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
          <CardTitle>Wellness Playbook</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Loading personalised recommendations...
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {wellnessSuggestions.map((tip, index) => (
                <li key={`${tip}-${index}`} className="rounded-lg border bg-card/80 p-4 text-sm">
                  {tip}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HealthPage;
