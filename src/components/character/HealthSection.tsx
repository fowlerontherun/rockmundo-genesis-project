import { useMemo } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Heart, Activity, Brain, Coffee, Clock, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getHealthStatus, calculateTimeToFullRecovery } from "@/utils/healthSystem";
import type {
  PlayerProfile,
  PlayerAttributes,
  ProfileActivityStatus,
} from "@/hooks/useGameData";

const getStatusEndDate = (status: ProfileActivityStatus | null): Date | null => {
  if (!status || status.status === "idle") {
    return null;
  }

  if (status.ends_at) {
    const parsed = new Date(status.ends_at);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (!status.started_at || typeof status.duration_minutes !== "number") {
    return null;
  }

  const startedAt = new Date(status.started_at);
  if (Number.isNaN(startedAt.getTime())) {
    return null;
  }

  return new Date(startedAt.getTime() + status.duration_minutes * 60_000);
};

interface HealthSectionProps {
  profile: PlayerProfile;
  attributes: PlayerAttributes | null;
  activityStatus: ProfileActivityStatus | null;
  startActivity: (
    input: {
      status: string;
      durationMinutes?: number | null;
      metadata?: Record<string, unknown> | null;
    },
  ) => Promise<ProfileActivityStatus | null>;
}

export function HealthSection({
  profile,
  attributes,
  activityStatus,
  startActivity,
}: HealthSectionProps) {
  const queryClient = useQueryClient();

  const health = profile.health ?? 100;
  const energy = profile.energy ?? 100;
  const healthStatus = getHealthStatus(health);
  const hoursToFullRecovery = calculateTimeToFullRecovery(health);
  const stress = useMemo(
    () => Math.max(0, Math.min(100, 100 - (attributes?.mental_focus || 10))),
    [attributes],
  );
  const fitness = useMemo(
    () => Math.max(0, Math.min(100, attributes?.physical_endurance || 10)),
    [attributes],
  );

  const statusEndsAt = useMemo(() => getStatusEndDate(activityStatus), [activityStatus]);

  const isBusy = useMemo(() => {
    if (!activityStatus || activityStatus.status === "idle") {
      return false;
    }

    if (typeof activityStatus.duration_minutes !== "number") {
      return true;
    }

    if (!statusEndsAt) {
      return false;
    }

    return statusEndsAt.getTime() > Date.now();
  }, [activityStatus, statusEndsAt]);

  const busyStatusLabel = useMemo(() => {
    if (!activityStatus || activityStatus.status === "idle") {
      return null;
    }

    return activityStatus.status.replace(/_/g, " ");
  }, [activityStatus]);

  const busyCountdownLabel = useMemo(() => {
    if (!isBusy || !statusEndsAt) {
      return null;
    }

    try {
      return formatDistanceToNowStrict(statusEndsAt, { addSuffix: true });
    } catch (error) {
      console.error("Failed to format activity countdown", error);
      return null;
    }
  }, [isBusy, statusEndsAt]);

  const ensureNotBusy = () => {
    if (!isBusy) {
      return false;
    }

    const countdown = busyCountdownLabel ? ` You'll be free ${busyCountdownLabel}.` : "";
    const label = busyStatusLabel ?? "another activity";
    toast.error(`You're currently busy with ${label}.${countdown}`.trim());
    return true;
  };

  const restMutation = useMutation({
    mutationFn: async () => {
      const durationMinutes = 60;

      const statusRecord = await startActivity({
        status: "resting",
        durationMinutes,
        metadata: { source: "health_tab", activity: "rest" },
      });

      if (!statusRecord) {
        console.warn("Activity status could not be recorded for rest (1 hour)");
      }

      const newHealth = Math.min(100, health + 10);
      const newEnergy = Math.min(100, energy + 15);
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
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to rest right now.";
      toast.error(message);
    },
  });

  const yogaMutation = useMutation({
    mutationFn: async () => {
      if (energy < 15) throw new Error("Not enough energy for yoga (need 15 energy)");

      const durationMinutes = 30;

      const statusRecord = await startActivity({
        status: "yoga_routine",
        durationMinutes,
        metadata: { source: "health_tab", activity: "yoga" },
      });

      if (!statusRecord) {
        console.warn("Activity status could not be recorded for yoga routine");
      }

      const newHealth = Math.min(100, health + 8);
      const newEnergy = Math.max(0, energy - 15);
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
      toast.success(`Completed 30-minute yoga session! Health: ${health}%, Energy: ${energy}%`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to start yoga right now.";
      toast.error(message);
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      if (energy < 25) throw new Error("Not enough energy for a 5k run (need 25 energy)");

      const baseDuration = 35;
      const durationReduction = Math.min(15, fitness / 10);
      const duration = Math.max(20, Math.round(baseDuration - durationReduction));

      const statusRecord = await startActivity({
        status: "running_5k",
        durationMinutes: duration,
        metadata: { source: "health_tab", activity: "run_5k" },
      });

      if (!statusRecord) {
        console.warn("Activity status could not be recorded for 5k run");
      }

      const newHealth = Math.min(100, health + 12);
      const newEnergy = Math.max(0, energy - 25);
      const { error } = await supabase
        .from("profiles")
        .update({
          health: newHealth,
          energy: newEnergy,
          last_health_update: new Date().toISOString(),
        })
        .eq("id", profile.id);
      if (error) throw error;
      return { health: newHealth, energy: newEnergy, duration };
    },
    onSuccess: ({ health, energy, duration }) => {
      queryClient.invalidateQueries({ queryKey: ["game-profile"] });
      toast.success(`Completed 5k run in ${duration} minutes! Health: ${health}%, Energy: ${energy}%`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to start your run right now.";
      toast.error(message);
    },
  });

  return (
    <div className="space-y-6">
      {healthStatus.warning && (
        <Alert variant={health < 30 ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{healthStatus.warning}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
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

            <div className="grid gap-4 grid-cols-2">
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
                    <Heart className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Fitness</span>
                  </div>
                  <span className="text-sm font-bold">{fitness}%</span>
                </div>
                <Progress value={fitness} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wellness Activities</CardTitle>
            <CardDescription>Improve your health through various activities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isBusy && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  You're currently busy with {busyStatusLabel ?? "another activity"}
                  {busyCountdownLabel ? ` and will be free ${busyCountdownLabel}.` : "."}
                </AlertDescription>
              </Alert>
            )}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold">Rest (1 Hour)</h4>
                  <p className="text-sm text-muted-foreground">Recover health and energy</p>
                </div>
                <Badge variant="outline">+10 Health, +15 Energy</Badge>
              </div>
              <Button
                onClick={() => {
                  if (ensureNotBusy()) return;
                  restMutation.mutate();
                }}
                disabled={restMutation.isPending || health >= 100 || isBusy}
                className="w-full"
              >
                <Coffee className="h-4 w-4 mr-2" />
                {restMutation.isPending ? "Resting..." : "Rest"}
              </Button>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold">Yoga Routine (30 min)</h4>
                  <p className="text-sm text-muted-foreground">Reduce stress, improve flexibility</p>
                </div>
                <Badge variant="outline">+8 Health, -15 Energy</Badge>
              </div>
              <Button
                onClick={() => {
                  if (ensureNotBusy()) return;
                  yogaMutation.mutate();
                }}
                disabled={yogaMutation.isPending || energy < 15 || isBusy}
                className="w-full"
                variant="secondary"
              >
                {yogaMutation.isPending ? "Practicing..." : energy < 15 ? "Not Enough Energy" : "Do Yoga"}
              </Button>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold">Run 5k ({Math.max(20, Math.round(35 - Math.min(15, fitness / 10)))} min)</h4>
                  <p className="text-sm text-muted-foreground">Improve fitness and endurance</p>
                </div>
                <Badge variant="outline">+12 Health, -25 Energy</Badge>
              </div>
              <Button
                onClick={() => {
                  if (ensureNotBusy()) return;
                  runMutation.mutate();
                }}
                disabled={runMutation.isPending || energy < 25 || isBusy}
                className="w-full"
                variant="secondary"
              >
                {runMutation.isPending ? "Running..." : energy < 25 ? "Not Enough Energy" : "Run 5k"}
              </Button>
              {fitness > 10 && (
                <p className="text-xs text-muted-foreground">
                  Your fitness level reduces run time. Keep training!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
