import { useState, useMemo } from "react";
import { useGameData } from "@/hooks/useGameData";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Heart,
  Activity,
  Brain,
  Bed,
  Dumbbell,
  Smile,
  AlertTriangle,
  Wind,
  Salad,
  Hospital,
  Pill,
  Palmtree,
  Clock,
  ShieldAlert,
  Calendar,
} from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getHealthStatus, calculateTimeToFullRecovery } from "@/utils/healthSystem";
import { format, subDays } from "date-fns";
import { useHospitalization } from "@/hooks/useHospitalization";
import { useAddictions } from "@/hooks/useAddictions";
import { useHolidays, HOLIDAY_DESTINATIONS } from "@/hooks/useHolidays";
import { getSeverityLabel, getAddictionTypeLabel, getRecoveryProgramDetails, getDaysCleanMilestone } from "@/utils/addictionSystem";
import type { RecoveryProgram } from "@/utils/addictionSystem";

export default function WellnessPage() {
  const { profile, attributes, loading } = useGameData();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("overview");

  const health = profile?.health ?? 100;
  const energy = profile?.energy ?? 100;
  const healthStatus = getHealthStatus(health);
  const hoursToFullRecovery = calculateTimeToFullRecovery(health);

  const { nearestHospital, activeHospitalization, checkIn, isCheckingIn, discharge, isDischargeDue, isDischarging } = useHospitalization();
  const { addictions, hasActiveAddiction, startRecovery, isStartingRecovery, attendTherapy, isAttendingTherapy } = useAddictions();
  const { activeHoliday, canBookHoliday, bookHoliday, isBooking, cancelHoliday, isCancelling, daysRemaining } = useHolidays();

  const stress = useMemo(
    () => Math.max(0, Math.min(100, 100 - (attributes?.mental_focus || 10))),
    [attributes]
  );
  const fitness = useMemo(
    () => Math.max(0, Math.min(100, attributes?.physical_endurance || 10)),
    [attributes]
  );
  const mentalHealth = useMemo(
    () => Math.min(100, (attributes?.mental_focus || 10) + (health / 2)),
    [attributes, health]
  );

  const { data: recentActivities } = useQuery({
    queryKey: ["wellness-history", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("experience_ledger")
        .select("*")
        .eq("user_id", profile.user_id)
        .in("activity_type", ["rest", "yoga", "exercise", "meditation", "therapy", "nutrition"])
        .gte("created_at", subDays(new Date(), 7).toISOString())
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });

  // Rest mutation
  const restMutation = useMutation({
    mutationFn: async (hours: number) => {
      if (!profile) throw new Error("No profile");
      const healthGain = Math.min(40, hours * 10);
      const energyGain = Math.min(50, hours * 15);
      const newHealth = Math.min(100, health + healthGain);
      const newEnergy = Math.min(100, energy + energyGain);
      await supabase.from("experience_ledger").insert({
        user_id: profile.user_id, profile_id: profile.id,
        activity_type: "rest", xp_amount: 5 * hours,
        metadata: { hours, healthGain, energyGain },
      });
      const { error } = await supabase.from("profiles").update({
        health: newHealth, energy: newEnergy, last_health_update: new Date().toISOString(),
      }).eq("id", profile.id);
      if (error) throw error;
      return { health: newHealth, energy: newEnergy, hours };
    },
    onSuccess: ({ health, energy, hours }) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["wellness-history"] });
      toast.success(`Rested for ${hours} hour(s). Health: ${health}%, Energy: ${energy}%`);
    },
  });

  // Meditation mutation
  const meditationMutation = useMutation({
    mutationFn: async (duration: number) => {
      if (!profile) throw new Error("No profile");
      if (energy < 10) throw new Error("Not enough energy for meditation");
      const stressReduction = duration * 5;
      const mentalFocusGain = Math.floor(duration / 10);
      await supabase.from("experience_ledger").insert({
        user_id: profile.user_id, profile_id: profile.id,
        activity_type: "meditation", xp_amount: duration,
        metadata: { duration, stressReduction, mentalFocusGain },
      });
      const newEnergy = Math.max(0, energy - 10);
      const { error } = await supabase.from("profiles").update({
        energy: newEnergy, last_health_update: new Date().toISOString(),
      }).eq("id", profile.id);
      if (error) throw error;
      if (mentalFocusGain > 0) {
        const currentFocus = attributes?.mental_focus || 10;
        await supabase.from("player_attributes")
          .update({ mental_focus: Math.min(1000, currentFocus + mentalFocusGain) })
          .eq("profile_id", profile.id);
      }
      return { energy: newEnergy, duration, stressReduction };
    },
    onSuccess: ({ duration, stressReduction }) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      queryClient.invalidateQueries({ queryKey: ["wellness-history"] });
      toast.success(`Meditated for ${duration} minutes. Stress reduced by ${stressReduction}%`);
    },
  });

  // Exercise mutation
  const exerciseMutation = useMutation({
    mutationFn: async (intensity: "light" | "moderate" | "intense") => {
      if (!profile) throw new Error("No profile");
      const costs = { light: 15, moderate: 25, intense: 35 };
      const gains = { light: 8, moderate: 12, intense: 18 };
      const enduranceGains = { light: 1, moderate: 2, intense: 3 };
      if (energy < costs[intensity]) throw new Error(`Not enough energy for ${intensity} exercise`);
      await supabase.from("experience_ledger").insert({
        user_id: profile.user_id, profile_id: profile.id,
        activity_type: "exercise", xp_amount: gains[intensity],
        metadata: { intensity, healthGain: gains[intensity], enduranceGain: enduranceGains[intensity] },
      });
      const newHealth = Math.min(100, health + gains[intensity]);
      const newEnergy = Math.max(0, energy - costs[intensity]);
      const { error } = await supabase.from("profiles").update({
        health: newHealth, energy: newEnergy, last_health_update: new Date().toISOString(),
      }).eq("id", profile.id);
      if (error) throw error;
      const currentEndurance = attributes?.physical_endurance || 10;
      await supabase.from("player_attributes")
        .update({ physical_endurance: Math.min(1000, currentEndurance + enduranceGains[intensity]) })
        .eq("profile_id", profile.id);
      return { health: newHealth, energy: newEnergy, intensity };
    },
    onSuccess: ({ health, energy, intensity }) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      queryClient.invalidateQueries({ queryKey: ["wellness-history"] });
      toast.success(`Completed ${intensity} exercise. Health: ${health}%, Energy: ${energy}%`);
    },
  });

  // Therapy mutation
  const therapyMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("No profile");
      if (profile.cash < 50) throw new Error("Not enough money for therapy session ($50)");
      await supabase.from("experience_ledger").insert({
        user_id: profile.user_id, profile_id: profile.id,
        activity_type: "therapy", xp_amount: 15,
        metadata: { cost: 50, mentalHealthGain: 20 },
      });
      const newCash = profile.cash - 50;
      const { error } = await supabase.from("profiles").update({
        cash: newCash, last_health_update: new Date().toISOString(),
      }).eq("id", profile.id);
      if (error) throw error;
      const currentFocus = attributes?.mental_focus || 10;
      await supabase.from("player_attributes")
        .update({ mental_focus: Math.min(1000, currentFocus + 5) })
        .eq("profile_id", profile.id);
      return { cash: newCash };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      queryClient.invalidateQueries({ queryKey: ["wellness-history"] });
      toast.success("Completed therapy session. Mental health improved!");
    },
  });

  // Nutrition mutation
  const nutritionMutation = useMutation({
    mutationFn: async (quality: "basic" | "healthy" | "premium") => {
      if (!profile) throw new Error("No profile");
      const costs = { basic: 10, healthy: 25, premium: 50 };
      const gains = { basic: 5, healthy: 10, premium: 15 };
      if (profile.cash < costs[quality]) throw new Error(`Not enough money for ${quality} meal`);
      await supabase.from("experience_ledger").insert({
        user_id: profile.user_id, profile_id: profile.id,
        activity_type: "nutrition", xp_amount: 5,
        metadata: { quality, cost: costs[quality], energyGain: gains[quality] },
      });
      const newEnergy = Math.min(100, energy + gains[quality]);
      const newCash = profile.cash - costs[quality];
      const { error } = await supabase.from("profiles").update({
        energy: newEnergy, cash: newCash, last_health_update: new Date().toISOString(),
      }).eq("id", profile.id);
      if (error) throw error;
      return { energy: newEnergy, cash: newCash, quality };
    },
    onSuccess: ({ energy, quality }) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["wellness-history"] });
      toast.success(`Ate ${quality} meal. Energy: ${energy}%`);
    },
  });

  if (loading) {
    return <div className="flex justify-center py-8">Loading wellness data...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-oswald">Wellness & Lifestyle</h1>
        <div className="flex gap-2">
          {hasActiveAddiction && (
            <Badge variant="destructive" className="animate-pulse">⚠️ Addiction Active</Badge>
          )}
          {activeHospitalization && (
            <Badge variant="destructive">🏥 Hospitalized</Badge>
          )}
          {activeHoliday && (
            <Badge variant="secondary">🌴 On Holiday ({daysRemaining}d left)</Badge>
          )}
          <Badge variant={health < 30 ? "destructive" : health < 70 ? "secondary" : "default"}>
            {healthStatus.label}
          </Badge>
        </div>
      </div>

      {healthStatus.warning && (
        <Alert variant={health < 30 ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{healthStatus.warning}</AlertDescription>
        </Alert>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="hospital">Hospital</TabsTrigger>
          <TabsTrigger value="addictions">Addictions</TabsTrigger>
          <TabsTrigger value="holidays">Holidays</TabsTrigger>
        </TabsList>

        {/* === OVERVIEW TAB === */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Heart className="h-4 w-4" /> Physical Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm"><span>Health</span><span className="font-bold">{health}%</span></div>
                <Progress value={health} className="h-2" />
                <div className="flex justify-between text-sm"><span>Energy</span><span className="font-bold">{energy}%</span></div>
                <Progress value={energy} className="h-2" />
                <div className="flex justify-between text-sm"><span>Fitness</span><span className="font-bold">{fitness}%</span></div>
                <Progress value={fitness} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4" /> Mental Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm"><span>Mental Wellbeing</span><span className="font-bold">{Math.round(mentalHealth)}%</span></div>
                <Progress value={mentalHealth} className="h-2" />
                <div className="flex justify-between text-sm"><span>Stress</span><span className="font-bold">{stress}%</span></div>
                <Progress value={stress} className="h-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> Recovery</CardTitle>
              </CardHeader>
              <CardContent>
                {health < 100 ? (
                  <div className="text-center">
                    <p className="text-2xl font-bold">{hoursToFullRecovery}h</p>
                    <p className="text-xs text-muted-foreground">To full recovery</p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Smile className="h-8 w-8 mx-auto text-green-600" />
                    <p className="text-sm mt-2">Perfect health!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Wellness Activities</CardTitle>
              <CardDescription>Your wellness journey over the past week</CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivities && recentActivities.length > 0 ? (
                <div className="space-y-2">
                  {recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between py-2 px-3 rounded bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs capitalize">{activity.activity_type}</Badge>
                        <span className="text-sm">{format(new Date(activity.created_at), "MMM d, HH:mm")}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">+{activity.xp_amount} XP</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No recent wellness activities.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ACTIVITIES TAB (merged Physical + Mental + Lifestyle) === */}
        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Physical</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Bed className="h-5 w-5" />
                  <div><p className="font-medium">Rest</p><p className="text-sm text-muted-foreground">Recover health and energy</p></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => restMutation.mutate(1)} disabled={restMutation.isPending}>1hr</Button>
                  <Button size="sm" onClick={() => restMutation.mutate(4)} disabled={restMutation.isPending}>4hr</Button>
                  <Button size="sm" onClick={() => restMutation.mutate(8)} disabled={restMutation.isPending}>8hr</Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Dumbbell className="h-5 w-5" />
                  <div><p className="font-medium">Exercise</p><p className="text-sm text-muted-foreground">Boost health and endurance</p></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => exerciseMutation.mutate("light")} disabled={exerciseMutation.isPending || energy < 15}>Light</Button>
                  <Button size="sm" variant="outline" onClick={() => exerciseMutation.mutate("moderate")} disabled={exerciseMutation.isPending || energy < 25}>Moderate</Button>
                  <Button size="sm" variant="outline" onClick={() => exerciseMutation.mutate("intense")} disabled={exerciseMutation.isPending || energy < 35}>Intense</Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Mental</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Wind className="h-5 w-5" />
                  <div><p className="font-medium">Meditation</p><p className="text-sm text-muted-foreground">Reduce stress and improve focus</p></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => meditationMutation.mutate(15)} disabled={meditationMutation.isPending || energy < 10}>15 min</Button>
                  <Button size="sm" onClick={() => meditationMutation.mutate(30)} disabled={meditationMutation.isPending || energy < 10}>30 min</Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5" />
                  <div><p className="font-medium">Therapy Session</p><p className="text-sm text-muted-foreground">Professional mental health support</p></div>
                </div>
                <Button size="sm" onClick={() => therapyMutation.mutate()} disabled={therapyMutation.isPending || (profile?.cash ?? 0) < 50}>Session ($50)</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Nutrition</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Salad className="h-5 w-5" />
                  <div><p className="font-medium">Eat a Meal</p><p className="text-sm text-muted-foreground">Restore energy</p></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => nutritionMutation.mutate("basic")} disabled={nutritionMutation.isPending || (profile?.cash ?? 0) < 10}>Basic ($10)</Button>
                  <Button size="sm" variant="outline" onClick={() => nutritionMutation.mutate("healthy")} disabled={nutritionMutation.isPending || (profile?.cash ?? 0) < 25}>Healthy ($25)</Button>
                  <Button size="sm" variant="outline" onClick={() => nutritionMutation.mutate("premium")} disabled={nutritionMutation.isPending || (profile?.cash ?? 0) < 50}>Premium ($50)</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === HOSPITAL TAB === */}
        <TabsContent value="hospital" className="space-y-4">
          {activeHospitalization ? (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Hospital className="h-5 w-5" /> Currently Hospitalized</CardTitle>
                <CardDescription>You are recovering in hospital. All activities are blocked.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Admitted</p>
                    <p className="font-medium">{format(new Date(activeHospitalization.admitted_at), "MMM d, HH:mm")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Discharge</p>
                    <p className="font-medium">{format(new Date(activeHospitalization.expected_discharge_at), "MMM d, HH:mm")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cost</p>
                    <p className="font-medium">${activeHospitalization.total_cost}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Health on Admission</p>
                    <p className="font-medium">{activeHospitalization.health_on_admission}%</p>
                  </div>
                </div>
                {isDischargeDue && (
                  <Button onClick={() => discharge()} disabled={isDischarging} className="w-full">
                    {isDischarging ? "Discharging..." : "Discharge Now"}
                  </Button>
                )}
                {!isDischargeDue && (
                  <p className="text-sm text-muted-foreground text-center">
                    <Clock className="inline h-4 w-4 mr-1" />
                    Recovery in progress. You'll be discharged automatically.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Hospital className="h-5 w-5" /> Hospital</CardTitle>
                <CardDescription>Check in when your health is critically low for accelerated recovery.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {nearestHospital ? (
                  <div className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{nearestHospital.name}</p>
                        <p className="text-sm text-muted-foreground">Nearest hospital in your city</p>
                      </div>
                      <Badge variant={nearestHospital.is_free ? "default" : "secondary"}>
                        {nearestHospital.is_free ? "Free" : `$${nearestHospital.cost_per_day}/day`}
                      </Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Effectiveness</span>
                      <span className="font-bold">{nearestHospital.effectiveness_rating}/100</span>
                    </div>
                    <Progress value={nearestHospital.effectiveness_rating} className="h-2" />
                    <Button
                      onClick={() => checkIn()}
                      disabled={isCheckingIn || health > 30}
                      className="w-full"
                      variant={health <= 30 ? "destructive" : "outline"}
                    >
                      {health > 30 ? "Health must be below 30 to check in" : isCheckingIn ? "Checking in..." : "Check In to Hospital"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No hospital available in your current city.</p>
                )}
                <Alert>
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription>If your health drops to 0, you'll be auto-admitted to the nearest hospital.</AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === ADDICTIONS TAB === */}
        <TabsContent value="addictions" className="space-y-4">
          {addictions.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5" /> No Active Addictions</CardTitle>
                <CardDescription>You're clean! Risky nightlife behavior can trigger addictions.</CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Heavy partying and afterparty attendance increase addiction risk. Manage your lifestyle settings to stay safe.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : (
            addictions.map((addiction) => {
              const severityInfo = getSeverityLabel(addiction.severity);
              const milestone = getDaysCleanMilestone(addiction.days_clean);
              return (
                <Card key={addiction.id} className="border-destructive/50">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Pill className="h-5 w-5" />
                        {getAddictionTypeLabel(addiction.addiction_type)} Addiction
                      </span>
                      <Badge variant={addiction.status === "recovering" ? "secondary" : "destructive"}>
                        {addiction.status}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Severity</span>
                        <span className={`font-bold ${severityInfo.color}`}>{severityInfo.label} ({addiction.severity}/100)</span>
                      </div>
                      <Progress value={addiction.severity} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Days Clean</p>
                        <p className="font-bold text-lg">{addiction.days_clean}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Relapses</p>
                        <p className="font-bold text-lg">{addiction.relapse_count}</p>
                      </div>
                    </div>

                    {milestone && (
                      <Alert>
                        <Smile className="h-4 w-4" />
                        <AlertDescription>🎉 Milestone: {milestone.label}! Reward: ${milestone.reward}</AlertDescription>
                      </Alert>
                    )}

                    {addiction.status === "active" || addiction.status === "relapsed" ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Choose Recovery Program:</p>
                        <div className="grid gap-2">
                          {(["therapy", "rehab", "cold_turkey"] as RecoveryProgram[]).map((program) => {
                            const details = getRecoveryProgramDetails(program);
                            return (
                              <Button
                                key={program}
                                variant="outline"
                                className="justify-start h-auto py-3"
                                onClick={() => startRecovery({ addictionId: addiction.id, program })}
                                disabled={isStartingRecovery}
                              >
                                <div className="text-left">
                                  <p className="font-medium">{details.label}</p>
                                  <p className="text-xs text-muted-foreground">{details.description}</p>
                                </div>
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ) : addiction.recovery_program === "therapy" ? (
                      <Button
                        onClick={() => attendTherapy(addiction.id)}
                        disabled={isAttendingTherapy || (profile?.cash ?? 0) < 100}
                        className="w-full"
                      >
                        {isAttendingTherapy ? "In Session..." : "Attend Therapy Session ($100)"}
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center">
                        Recovery in progress via {addiction.recovery_program}...
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* === HOLIDAYS TAB === */}
        <TabsContent value="holidays" className="space-y-4">
          {activeHoliday ? (
            <Card className="border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Palmtree className="h-5 w-5" /> On Holiday!</CardTitle>
                <CardDescription>You're on a {activeHoliday.destination}. Songwriting is still available.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Destination</p>
                    <p className="font-medium">{activeHoliday.destination}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Days Remaining</p>
                    <p className="font-bold text-lg">{daysRemaining}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Health Boost</p>
                    <p className="font-medium text-green-500">+{activeHoliday.health_boost_per_day}/day</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ends</p>
                    <p className="font-medium">{format(new Date(activeHoliday.ends_at), "MMM d, HH:mm")}</p>
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => cancelHoliday()} disabled={isCancelling}>
                  {isCancelling ? "Cancelling..." : "Return Early (no refund)"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {!canBookHoliday && (
                <Alert>
                  <Calendar className="h-4 w-4" />
                  <AlertDescription>Holiday cooldown active. You can book another holiday after 14 days.</AlertDescription>
                </Alert>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {HOLIDAY_DESTINATIONS.map((dest) => (
                  <Card key={dest.name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span className="text-xl">{dest.emoji}</span>
                        {dest.name}
                      </CardTitle>
                      <CardDescription>{dest.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cost per day</span>
                        <span className="font-bold">${dest.costPerDay}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Health boost</span>
                        <span className="font-bold text-green-500">+{dest.healthPerDay}/day</span>
                      </div>
                      <div className="flex gap-2">
                        {dest.durations.map((d) => (
                          <Button
                            key={d}
                            size="sm"
                            variant="outline"
                            disabled={isBooking || !canBookHoliday || (profile?.cash ?? 0) < dest.costPerDay * d}
                            onClick={() => bookHoliday({ destination: dest, durationDays: d })}
                          >
                            {d} days (${dest.costPerDay * d})
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
