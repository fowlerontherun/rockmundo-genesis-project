import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useGameData } from "@/hooks/useGameData";
import { getSkillDisplayProgress } from "@/utils/skillProgressDisplay";
import { resolveSkillTier } from "@/utils/skillFamilies";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { isEducationSkillVisible, useSkillTierAccess } from "../hooks/useSkillTierAccess";
import { formatEducationSkillName } from "../utils/educationUi";

type EducationSkillDefinition = {
  slug: string;
  display_name: string | null;
  tier_caps: Record<string, unknown> | null;
};

export const EducationMySkillsTab = () => {
  const { profileId } = useActiveProfile();
  const { skillProgress, loading: progressLoading } = useGameData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "mine" | "available">("all");
  const [limit, setLimit] = useState(40);

  const { data: definitions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["education", "skill-definitions"],
    queryFn: async () => {
      const all: EducationSkillDefinition[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("skill_definitions")
          .select("slug, display_name, tier_caps")
          .order("slug").range(offset, offset + 499);
        if (error) throw error;
        all.push(...(data ?? []) as EducationSkillDefinition[]);
        if (!data || data.length < 500) break;
      }
      return all;
    },
    staleTime: 5 * 60 * 1000,
  });
  const tierAccess = useSkillTierAccess(profileId, definitions.map((definition) => definition.slug));
  const accessBySkill = tierAccess.data ?? new Map<string, boolean>();

  const rows = useMemo(() => {
    const progressBySlug = new Map((skillProgress ?? []).map((skill) => [skill.skill_slug, skill]));
    return definitions
      .filter((definition) => isEducationSkillVisible(definition.slug, accessBySkill))
      .map((definition) => {
        const progressRecord = progressBySlug.get(definition.slug);
        const progress = getSkillDisplayProgress((progressRecord ?? { current_level: 0, current_xp: 0, required_xp: 100 }) as any);
        const tierField = definition.tier_caps?.tier;
        const tier = resolveSkillTier(definition.slug, typeof tierField === "string" ? tierField : null);
        return {
          slug: definition.slug,
          name: definition.display_name || formatEducationSkillName(definition.slug),
          tier,
          progress,
        };
      })
      .sort((a, b) => Number(b.progress.is_unlocked) - Number(a.progress.is_unlocked)
        || b.progress.current_level - a.progress.current_level || a.name.localeCompare(b.name));
  }, [definitions, skillProgress, accessBySkill]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (filter === "mine" && !row.progress.is_unlocked) return false;
    if (filter === "available" && row.progress.is_unlocked) return false;
    if (search.trim() && !(row.name + " " + row.slug).toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  }), [rows, filter, search]);

  if (isLoading || progressLoading || tierAccess.isLoading) return <p className="py-12 text-center text-muted-foreground">Loading your skills...</p>;
  if (isError || tierAccess.isError) {
    return <Alert variant="destructive" role="alert"><AlertDescription>
      Skill availability could not be verified. Locked skills remain hidden.
      <Button size="sm" variant="outline" onClick={() => { void refetch(); void tierAccess.refetch(); }} className="ml-2">Retry</Button>
    </AlertDescription></Alert>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">My Skills</h2>
        <p className="text-sm text-muted-foreground">See what you know and choose what to learn next. Professional and Mastery skills appear when their prerequisites are complete.</p>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" value={search} placeholder="Search available skills..." onChange={(event) => { setSearch(event.target.value); setLimit(40); }} aria-label="Search available skills" />
      </div>
      <div className="flex flex-wrap gap-2">
        {([
          ["all", "All available"],
          ["mine", "Skills I know"],
          ["available", "New to learn"],
        ] as const).map(([value, label]) => (
          <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => { setFilter(value); setLimit(40); }}>{label}</Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} visible skills · {rows.filter((skill) => skill.progress.is_unlocked).length} learned</p>
      {filtered.length === 0 && (
        <Card className="border-dashed"><CardContent className="py-6 text-sm text-muted-foreground">
          No skills match this view. Try a different search or filter.
        </CardContent></Card>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.slice(0, limit).map((skill) => (
          <Card key={skill.slug}><CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3 justify-between">
              <div className="min-w-0">
                <p className="font-semibold">{skill.name}</p>
                <p className="text-xs text-muted-foreground">{skill.tier === "basic" ? "Foundation" : skill.tier === "professional" ? "Professional" : "Mastery"} tier</p>
              </div>
              <Badge variant={skill.progress.is_unlocked ? "secondary" : "outline"}>
                {skill.progress.is_unlocked ? "Level " + skill.progress.current_level : "Ready to learn"}
              </Badge>
            </div>
            {skill.progress.is_unlocked && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{skill.progress.is_max_level ? "Maximum level" : "Progress towards level " + skill.progress.next_level}</span>
                  <span>{skill.progress.is_max_level ? <CheckCircle2 className="h-4 w-4" /> : Math.round(skill.progress.progress_percent) + "%"}</span>
                </div>
                <Progress value={skill.progress.is_max_level ? 100 : skill.progress.progress_percent} aria-label={skill.name + " level progress"} />
              </div>
            )}
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to={"/education?tab=find&skill=" + encodeURIComponent(skill.slug)}>
                {skill.progress.is_unlocked ? "Improve skill" : "Learn this skill"} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent></Card>
        ))}
      </div>
      {filtered.length > limit && <Button variant="outline" className="w-full" onClick={() => setLimit((current) => current + 40)}>Show more skills</Button>}
    </div>
  );
};
