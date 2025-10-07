import React from "react";
import { useGameData } from "@/hooks/useGameData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, Heart, Brain, Users, AlertTriangle, Coffee, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getHealthStatus, calculateTimeToFullRecovery, calculateHealthRecovery } from "@/utils/healthSystem";

const clampToPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const HealthPage = () => {
  const { profile, attributes } = useGameData();
  const queryClient = useQueryClient();

  const restMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("No profile found");
      
      const currentHealth = profile.health ?? 100;
      const currentEnergy = profile.energy ?? 100;
      const healthGain = calculateHealthRecovery(60 * 60 * 1000, true); // 1 hour of rest
      const newHealth = Math.min(100, currentHealth + healthGain);
      const newEnergy = Math.min(100, currentEnergy + 15);
      
      const { error } = await supabase
        .from("profiles")
        .update({
          health: newHealth,
          energy: newEnergy,
          last_health_update: new Date().toISOString(),
        })
        .eq("id", profile.id);
      
      if (error) throw error;
      return { health: newHealth, energy: newEnergy };
    },
    onSuccess: ({ health, energy }) => {
      queryClient.invalidateQueries({ queryKey: ["game-profile"] });
      toast.success(`Rested for 1 hour. Health: ${health}%, Energy: ${energy}%`);
    },
    onError: (error) => {
      toast.error(`Failed to rest: ${error.message}`);
    },
  });

  if (!profile || !attributes) {
    return <div className="container mx-auto p-6">Loading...</div>;
  }

  const health = profile.health ?? 100;
  const energy = profile.energy ?? 100;
  const healthStatus = getHealthStatus(health);
  const hoursToFullRecovery = calculateTimeToFullRecovery(health);

  const stress = clampToPercent(100 - (attributes.mental_focus || 10));
  const fitness = clampToPercent(attributes.physical_endurance || 10);
  const recovery = clampToPercent(Math.max(0, health - stress / 2));

  const illnesses: string[] = [];
  if (stress > 75) illnesses.push("High Stress");
  if (fitness < 25) illnesses.push("Poor Fitness");
  if (health < 30) illnesses.push("Exhaustion");

  const addictions: string[] = [];
  if (stress > 80 && fitness < 30) addictions.push("Caffeine Dependency");

  const suggestions: string[] = [];
  if (health < 50) suggestions.push("Rest immediately to restore health");
  if (stress > 50) suggestions.push("Consider meditation or relaxation activities");
  if (fitness < 50) suggestions.push("Try some physical training to boost fitness");
  if (energy < 40) suggestions.push("Take a break to recharge your energy");

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Health & Wellness</h1>
        <p className="text-muted-foreground">
          Monitor your wellbeing and manage your health through activities and rest.
        </p>
      </div>

      {healthStatus.warning && (
        <Alert variant={health < 30 ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{healthStatus.warning}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Health Metrics</CardTitle>
            <CardDescription>Your current physical and mental state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-2">
                  <Heart className="h-4 w-4" />
                  Overall Health
                </span>
                <div className="flex items-center gap-2">
                  <Badge className={healthStatus.color}>{healthStatus.label}</Badge>
                  <span className="text-sm font-bold">{health}%</span>
                </div>
              </div>
              <Progress value={health} className="h-3" />
              {health < 100 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  ~{hoursToFullRecovery} hours to full recovery
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Energy
                </span>
                <span className="text-sm font-bold">{energy}%</span>
              </div>
              <Progress value={energy} className="h-3" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Stress</span>
                  </div>
                  <span className="text-sm font-bold">{stress}%</span>
                </div>
                <Progress value={stress} className="h-2" />
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Fitness</span>
                  </div>
                  <span className="text-sm font-bold">{fitness}%</span>
                </div>
                <Progress value={fitness} className="h-2" />
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Heart className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Recovery</span>
                  </div>
                  <span className="text-sm font-bold">{recovery}%</span>
                </div>
                <Progress value={recovery} className="h-2" />
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button
                onClick={() => restMutation.mutate()}
                disabled={restMutation.isPending || health >= 100}
                className="flex items-center gap-2"
              >
                <Coffee className="h-4 w-4" />
                {restMutation.isPending ? "Resting..." : "Rest (1 Hour)"}
              </Button>
              {health >= 100 && (
                <p className="text-sm text-muted-foreground mt-2">
                  You're at full health!
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Illnesses</CardTitle>
            </CardHeader>
            <CardContent>
              {illnesses.length > 0 ? (
                <ul className="space-y-2">
                  {illnesses.map((illness) => (
                    <li key={illness} className="rounded-lg border bg-card/80 p-3 text-sm">
                      <Badge variant="destructive" className="mb-1">{illness}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No active illnesses</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Habits</CardTitle>
            </CardHeader>
            <CardContent>
              {addictions.length > 0 ? (
                <ul className="space-y-2">
                  {addictions.map((habit) => (
                    <li key={habit} className="rounded-lg border bg-card/80 p-3 text-sm">
                      {habit}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No concerning habits</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Wellness Suggestions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-4 md:grid-cols-2">
            {suggestions.map((tip, index) => (
              <li key={index} className="rounded-lg border bg-card/80 p-4 text-sm">
                {tip}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default HealthPage;
