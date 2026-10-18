import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Target, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useGameData } from "@/hooks/useGameData";
import { useProfileSkillAvailability, useSkillCatalogue, useSkillCatalogueRelationships } from "@/hooks/useSkillCatalogue";
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

export const EducationRecommendations = ({ activeSkills }: { activeSkills?: string[] }) => {
  const { profileId } = useActiveProfile();
  const { skillProgress } = useGameData();
  const [goal, setGoal] = useState<LearningGoal>("all");
  const catalogue = useSkillCatalogue();
  const available = useProfileSkillAvailability(profileId);
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
    availability: available.data ?? [],
    roleLinks,
    access: access.data ?? new Map<string, boolean>(),
    goal,
    activeSkillSlugs: new Set(activeSkills ?? []),
    limit: 4,
  }), [catalogue.data, skillProgress, available.data, roleLinks, access.data, goal, activeSkills]);

  const isLoading = catalogue.isLoading || available.isLoading || access.isLoading;
  const hasError = catalogue.isError || available.isError || access.isError;

  return (
    <section className="space-y-3" aria-label="Recommended learning">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Target className="h-5 w-5" /> What to learn next</h2>
        <Select value={goal} onValueChange={(value) => setGoal(value as LearningGoal)}>
          <SelectTrigger aria-label="Learning goal" className="w-full sm:w-[205px]">
            <SelectValue placeholder="Choose your role" />
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
        <div className="grid gap-3 sm:grid-cols-2">
          {recommendations.map((skill) => (
            <Card key={skill.slug}>
              <CardHeader className="pb-1">
                <CardTitle className="text-base">{skill.title || formatEducationSkillName(skill.slug)}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {skill.isNew ? "Ready to learn" : "Level " + skill.currentLevel + " · " + Math.round(skill.progressPercent) + "% to next level"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {!skill.isNew && <Progress value={skill.progressPercent} aria-label={skill.title + " progress " + skill.progressPercent + "%"} />}
                <p className="text-sm text-muted-foreground">{skill.reason}</p>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to={"/education?tab=find&skill=" + encodeURIComponent(skill.slug)}>
                    {skill.isNew ? "Find a first lesson" : "Find ways to improve"} <ArrowRight className="ml-1.5 h-4 w-4" />
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
