import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Compass, Music2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageErrorState, PageLoadingState } from "@/components/ui/page-state";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface GettingStartedPanelProps {
  profile: any;
  userId?: string | null;
}

interface OnboardingSnapshot {
  skillRows: number;
  songCount: number;
  recordingCount: number;
  activityCount: number;
  bandCount: number;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  completed: boolean;
  optional?: boolean;
}

function buildSteps(profile: any, snapshot: OnboardingSnapshot): OnboardingStep[] {
  const hasProfileBasics = Boolean(profile?.display_name || profile?.username) && Boolean(profile?.age || profile?.gender || profile?.city_id);
  const hasSkills = snapshot.skillRows > 0;
  const hasSong = snapshot.songCount > 0;
  const hasBookedActivity = snapshot.activityCount > 0;
  const hasBand = snapshot.bandCount > 0;
  const hasRecording = snapshot.recordingCount > 0;

  const steps: OnboardingStep[] = [
    {
      id: "profile",
      title: "Confirm your character setup",
      description: "Make sure your artist name, identity, and home city are ready before you start making music.",
      href: "/characters",
      cta: "Review character",
      completed: hasProfileBasics,
    },
    {
      id: "skills",
      title: "Review your starter skills",
      description: "Check which musical skills you already have, then choose what to practise or learn first.",
      href: "/skills",
      cta: "Open skills",
      completed: hasSkills,
    },
    {
      id: "song",
      title: "Write your first song",
      description: "Start a songwriting session so your career has material to rehearse, record, and release.",
      href: "/booking/songwriting",
      cta: "Start songwriting",
      completed: hasSong,
    },
    {
      id: "activity",
      title: "Book your first activity",
      description: "Add a lesson, practice session, work shift, or music activity to your schedule so time has a clear next step.",
      href: "/schedule",
      cta: "Open schedule",
      completed: hasBookedActivity,
    },
  ];

  if (hasBand || hasSong) {
    steps.push({
      id: hasRecording ? "release" : "band",
      title: hasRecording ? "Prepare your first release" : "Join or create a band",
      description: hasRecording
        ? "You have recorded music. Move it toward a release when you are ready."
        : "A band is optional early on, but it unlocks rehearsals, gigs, and collaboration.",
      href: hasRecording ? "/release-manager" : "/band",
      cta: hasRecording ? "Open releases" : "Open band page",
      completed: hasRecording ? false : hasBand,
      optional: !hasRecording,
    });
  }

  return steps;
}

export function GettingStartedPanel({ profile, userId }: GettingStartedPanelProps) {
  const profileId = profile?.id;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["getting-started", userId, profileId],
    enabled: !!userId && !!profileId,
    staleTime: 30_000,
    queryFn: async (): Promise<OnboardingSnapshot> => {
      const [skillsResult, songsResult, recordingsResult, activitiesResult, bandsResult] = await Promise.all([
        (supabase as any).from("player_skills").select("id", { count: "exact", head: true }).eq("user_id", userId),
        (supabase as any).from("songs").select("id", { count: "exact", head: true }).eq("profile_id", profileId).or("archived.is.null,archived.eq.false"),
        (supabase as any).from("songs").select("id", { count: "exact", head: true }).eq("profile_id", profileId).in("status", ["recorded", "released"]).or("archived.is.null,archived.eq.false"),
        (supabase as any).from("player_scheduled_activities").select("id", { count: "exact", head: true }).eq("profile_id", profileId),
        (supabase as any).from("band_members").select("band_id", { count: "exact", head: true }).eq("profile_id", profileId).eq("member_status", "active"),
      ]);
      const failed = [skillsResult, songsResult, recordingsResult, activitiesResult, bandsResult].find((result: any) => result.error);
      if (failed?.error) throw failed.error;
      return {
        skillRows: skillsResult.count ?? 0,
        songCount: songsResult.count ?? 0,
        recordingCount: recordingsResult.count ?? 0,
        activityCount: activitiesResult.count ?? 0,
        bandCount: bandsResult.count ?? 0,
      };
    },
  });

  const steps = useMemo(() => buildSteps(profile, data ?? { skillRows: 0, songCount: 0, recordingCount: 0, activityCount: 0, bandCount: 0 }), [data, profile]);
  const requiredSteps = steps.filter((step) => !step.optional);
  const completedRequired = requiredSteps.filter((step) => step.completed).length;
  const isEstablished = (profile?.level ?? 1) >= 4 || (profile?.fame ?? 0) >= 100;
  const isComplete = completedRequired === requiredSteps.length && (data?.songCount ?? 0) > 0 && ((data?.activityCount ?? 0) > 0 || isEstablished);

  if (!profileId || isComplete || (isEstablished && (data?.songCount ?? 0) > 0)) return null;
  if (isLoading) return <PageLoadingState title="Loading first steps" description="Checking your character, skills, songs, band, and schedule progress..." />;
  if (error) return <PageErrorState title="First steps could not be loaded" description="You can still start with skills, songwriting, or the schedule from the dashboard links." onRetry={() => void refetch()} />;

  const progress = Math.round((completedRequired / Math.max(1, requiredSteps.length)) * 100);
  const nextStep = steps.find((step) => !step.completed) ?? steps[0];

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Compass className="h-4 w-4 text-primary" />
            Getting Started
          </CardTitle>
          <CardDescription>Follow these first steps to get from character setup to your first meaningful music action.</CardDescription>
        </div>
        <Button asChild size="sm"><Link to={nextStep.href}>{nextStep.cta}</Link></Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div aria-label="Getting started progress" aria-valuemin={0} aria-valuemax={requiredSteps.length} aria-valuenow={completedRequired} role="progressbar">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{completedRequired} of {requiredSteps.length} required steps complete</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <ol className="space-y-2">
          {steps.map((step, index) => {
            const Icon = step.completed ? CheckCircle2 : step.id === "song" ? Music2 : Circle;
            return (
              <li key={step.id} className={cn("rounded-lg border bg-card/70 p-3", step.completed && "opacity-75")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", step.completed ? "text-emerald-500" : "text-primary")} />
                    <div>
                      <h3 className="text-sm font-semibold">{index + 1}. {step.title}{step.optional ? " (optional)" : ""}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                  <Button asChild size="sm" variant={step.completed ? "outline" : "default"} className="shrink-0"><Link to={step.href}>{step.completed ? "Review" : step.cta}</Link></Button>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
