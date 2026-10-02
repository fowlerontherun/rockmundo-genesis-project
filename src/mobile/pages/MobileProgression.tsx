import { useMemo, useState } from "react";
import { Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameData } from "@/hooks/useGameData";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { usePlayerAttributesQuery } from "@/hooks/usePlayerAttributesQuery";
import { useSkillCatalogue } from "@/hooks/useSkillCatalogue";
import { AttributePanel } from "@/components/attributes/AttributePanel";
import { SkillXpSpendDialog } from "@/components/skills/SkillXpSpendDialog";
import { MobileEntityCard, MobileErrorState, MobileLoadingSkeleton, MobileSectionCard, MobileSectionHeader, MobileStatusBadge } from "../components/MobilePrimitives";

export default function MobileProgression() {
  const { profileId } = useActiveProfile();
  const { skillProgress, xpWallet, refetch } = useGameData();
  const attributes = usePlayerAttributesQuery(profileId);
  const catalogue = useSkillCatalogue();
  const [spendSkill, setSpendSkill] = useState<any | null>(null);
  const skillXp = Number(xpWallet?.skill_xp_balance ?? xpWallet?.xp_balance ?? 0);
  const ap = Number(xpWallet?.attribute_points_balance ?? 0);

  const skills = useMemo(() => {
    const names = new Map((catalogue.data ?? []).map((item: any) => [item.slug, item]));
    return (skillProgress ?? []).map((progress: any) => {
      const item: any = names.get(progress.skill_slug) ?? {};
      return {
        slug: progress.skill_slug,
        name: item.name ?? progress.skill_slug?.replace(/[_-]+/g, " ") ?? "Skill",
        currentLevel: Number(progress.current_level ?? 0),
        xpIntoLevel: Number(progress.xp_into_level ?? 0),
        xpRequiredForNextLevel: progress.xp_required_for_next_level == null ? null : Number(progress.xp_required_for_next_level),
        maxLevel: Number(item.max_level ?? 200),
        unlocked: Boolean(progress.is_unlocked ?? Number(progress.current_level ?? 0) > 0),
        active: item.is_active ?? true,
      };
    }).filter((skill: any) => skill.unlocked).sort((a: any, b: any) => b.currentLevel - a.currentLevel);
  }, [catalogue.data, skillProgress]);

  const refresh = async () => { await Promise.all([refetch(), attributes.refetch(), catalogue.refetch()]); };

  return <div className="space-y-4">
    <MobileSectionHeader eyebrow="Progression" title="Spend XP & AP" description="Use Skill XP on unlocked skills and Attribute Points on core attributes." />
    <div className="grid grid-cols-2 gap-2">
      <MobileSectionCard title="Skill XP"><div className="text-2xl font-bold">{skillXp.toLocaleString()}</div><p className="text-xs text-muted-foreground">Available to spend</p></MobileSectionCard>
      <MobileSectionCard title="Attribute Points"><div className="text-2xl font-bold">{ap.toLocaleString()}</div><p className="text-xs text-muted-foreground">Available to spend</p></MobileSectionCard>
    </div>

    <MobileSectionCard title="Skills" subtitle="Spend Skill XP on skills already unlocked for this character.">
      {catalogue.isLoading ? <MobileLoadingSkeleton /> : catalogue.isError ? <MobileErrorState message="Skill data could not be loaded." onRetry={() => catalogue.refetch()} /> : <div className="space-y-2">{skills.map((skill: any) => <MobileEntityCard key={skill.slug} title={skill.name} subtitle={`Level ${skill.currentLevel} • ${skill.xpIntoLevel}/${skill.xpRequiredForNextLevel ?? "Max"} XP`} icon={<Zap className="h-5 w-5" />} meta={<Button size="sm" disabled={skillXp <= 0 || skill.currentLevel >= skill.maxLevel} onClick={(event) => { event.stopPropagation(); setSpendSkill(skill); }}>Spend XP</Button>} />)}</div>}
    </MobileSectionCard>

    <MobileSectionCard title="Attributes" subtitle="Spend AP on your core character attributes." action={<MobileStatusBadge tone={ap > 0 ? "success" : "neutral"}>{ap} AP</MobileStatusBadge>}>
      {attributes.isLoading ? <MobileLoadingSkeleton /> : attributes.isError ? <MobileErrorState message="Attributes could not be loaded." onRetry={() => attributes.refetch()} /> : <AttributePanel attributes={attributes.data ?? null} xpBalance={ap} onXpSpent={refresh} />}
    </MobileSectionCard>

    {spendSkill && <SkillXpSpendDialog open={!!spendSkill} onOpenChange={(open) => !open && setSpendSkill(null)} skill={spendSkill} availableSkillXp={skillXp} onSpent={refresh} />}
  </div>;
}
