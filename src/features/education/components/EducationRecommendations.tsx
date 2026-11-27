import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useGameData } from "@/hooks/useGameData";
import { useSkillCatalogueRelationships } from "@/hooks/useSkillCatalogue";
import { supabase } from "@/integrations/supabase/client";
import { useEducationSkillDefinitions } from "../hooks/useEducationSkillDefinitions";
import { type LearningGoal, selectLearningRecommendations } from "../utils/educationRecommendations";
import { formatEducationSkillName } from "../utils/educationUi";
import { useSkillTierAccess } from "../hooks/useSkillTierAccess";

const GOAL_OPTIONS: Array<{ value: LearningGoal; label: string }> = [
  { value: "all", label: "All skills" },
  { value: "lead_guitarist", label: "Lead guitarist" },
  { value: "rhythm_guitarist", label: "Rhythm guitarist" },
  { value: "bassist", label: "Bassist" },
  { value: "drummer", label: "Drummer" },
  { value: "lead_vocalist", label: "Lead vocalist" },
  { value: "backing_vocalist", label: "Backing vocalist" },
  { value: "songwriter", label: "Songwriter" },
  { value: "dj", label: "DJ" },
  { value: "producer", label: "Producer" },
  { value: "sound_engineer", label: "Sound engineer" },
  { value: "live_frontperson", label: "Live frontperson" },
];

const validGoal = (value: unknown): value is LearningGoal =>
  typeof value === "string" && GOAL_OPTIONS.some((option) => option.value === value);

export const EducationRecommendations = ({ activeSkills }: { activeSkills?: string[] }) => {
  const educationBase = useLocation().pathname.startsWith("/mobile") ? "/mobile/education" : "/education";
  const { profile, profileId, userId, isLoading: profileLoading } = useActiveProfile();
  const { skillProgress } = useGameData();
  const queryClient = useQueryClient();
  const [selectedGoal, setSelectedGoal] = useState<LearningGoal | null>(null);
  const savedGoal = validGoal(profile?.learning_goal) ? profile.learning_goal : "all";
  const goal = selectedGoal ?? savedGoal;
  useEffect(() => setSelectedGoal(null), [profileId]);
  const saveGoal = useMutation({
    mutationFn: async (nextGoal: LearningGoal) => {
      if (!profileId) throw new Error("Choose a character to save your learning plan.");
      const { data, error } = await supabase.from("profiles")
        .update({ learning_goal: nextGoal })
        .eq("id", profileId)
        .select("learning_goal")
        .single();
      if (error) throw error;
      if (data?.learning_goal !== nextGoal) throw new Error("Learning goal was not saved.");
      return nextGoal;
    },
    onSuccess: (nextGoal) => {
      queryClient.setQueryData(["active-profile", userId], (current: typeof profile) =>
        current ? { ...current, learning_goal: nextGoal } : current);
      setSelectedGoal(null);
    },
    onError: () => {
      setSelectedGoal(null);
      toast.error("Could not save your learning goal. Please try again.");
    },
  });

  const handleGoalChange = (value: string) => {
    if (!validGoal(value) || !profileId || value === goal) return;
    setSelectedGoal(value);
    saveGoal.mutate(value);
  };
  const catalogue = useEducationSkillDefinitions();
  const { roleLinks } = useSkillCatalogueRelationships();
  const access = useSkillTierAccess(profileId, (catalogue.data ?? []).map((skill) => skill.slug));

  const recommendations = useMemo(() => selectLearningRecommendations({
    catalogue: catalogue.data ?? [],
    progress: (skillProgress ?? []).map((skill) => ({
      skill_slug: skill.skill_slug,
      current_level: skill.current_level,
      current_xp: skill.current_xp,
      required_xp: skill.required_xp,
    })),
    roleLinks,
    access: access.data ?? new Map<string, boolean>(),
    goal,
    activeSkillSlugs: new Set(activeSkills ?? []),
    limit: 3,
  }), [catalogue.data, skillProgress, roleLinks, access.data, goal, activeSkills]);

  const isLoading = catalogue.isLoading || access.isLoading || profileLoading;
  const hasError = catalogue.isError || access.isError;

  return (
    <section className="space-y-3" aria-label="My learning plan">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Target className="h-5 w-5" /> My learning plan</h2>
          <p className="text-sm text-muted-foreground">Choose your career goal and get three clear next skills. Your choice is saved for this character.</p>
        </div>
        <Select value={goal} onValueChange={handleGoalChange} disabled={!profileId || saveGoal.isPending}>
          <SelectTrigger aria-label="Career learning goal" className="w-full sm:w-[205px]">
            <SelectValue placeholder="Career goal" />
          </SelectTrigger>
          <SelectContent>{GOAL_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {hasError && <p role="alert" className="text-sm text-destructive">Learning recommendations are unavailable until skill eligibility can be verified.</p>}
      {isLoading && !hasError && <p className="py-4 text-sm text-muted-foreground">Finding suitable next skills...</p>}
      {!isLoading && !hasError && recommendations.length === 0 && (
        <Card className="border-dashed"><CardContent className="py-5 text-sm text-muted-foreground">
          No recommended skills for this selection. Choose a different learning goal or browse your available skills.
        </CardContent></Card>
      )}
      {!isLoading && !hasError && recommendations.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {recommendations.map((skill, index) => (
            <Card key={skill.slug} className={index === 0 ? "border-primary/40" : undefined}>
              <CardHeader className="pb-1">
                <p className="flex items-center gap-1 text-xs font-medium text-primary">
                  {index === 0 ? <><CheckCircle2 className="h-3.5 w-3.5" /> Start here</> : `Next skill ${index + 1}`}
                </p>
                <CardTitle className="text-base">{skill.title || formatEducationSkillName(skill.slug)}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {skill.isNew ? "Ready to learn" : "Level " + skill.currentLevel + " · " + Math.round(skill.progressPercent) + "% to next level"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {!skill.isNew && <Progress value={skill.progressPercent} aria-label={skill.title + " progress " + skill.progressPercent + "%"} />}
                <p className="text-sm text-muted-foreground">{skill.reason}</p>
                <Button asChild variant={index === 0 ? "default" : "outline"} size="sm" className="w-full">
                  <Link to={educationBase + "?tab=find&skill=" + encodeURIComponent(skill.slug)}>
                    {skill.isNew ? "Start learning" : "Keep improving"} <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};
