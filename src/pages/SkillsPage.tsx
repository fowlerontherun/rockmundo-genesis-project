import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillTree } from "@/components/SkillTree";
import { useGameData } from "@/hooks/useGameData";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TrendingUp,
  Target,
  Award,
  Zap,
  Calendar,
  AlertCircle,
  Dumbbell,
  GitBranch,
  Gauge,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useMemo } from "react";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useSkillPracticeRestrictions } from "@/hooks/useSkillPractice";
import { SchedulePracticeDialog } from "@/components/skills/SchedulePracticeDialog";
import { XpWalletDisplay } from "@/components/attributes/XpWalletDisplay";
import { DailyStipendCard } from "@/components/attributes/DailyStipendCard";
import { FMPageScaffold } from "@/components/fm/FMPageScaffold";
import { AttributePanel } from "@/components/attributes/AttributePanel";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlayerAttributesQuery } from "@/hooks/usePlayerAttributesQuery";
import {
  calculateSkillOverviewStats,
  getSkillDisplayProgress,
  SKILL_PRACTICE_CONFIG,
} from "@/utils/skillProgressDisplay";
import {
  useSkillCatalogue,
  useProfileSkillAvailability,
  useSkillCatalogueRelationships,
} from "@/hooks/useSkillCatalogue";
import {
  getAttributeLabel,
  calculateWeightedLearningMultiplier,
} from "@/utils/skillCatalogue";

const formatReset = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "the next daily reset";

const SkillsPage = () => {
  const { t } = useTranslation();
  const { profileId } = useActiveProfile();
  const {
    skillProgress,
    loading,
    error,
    xpWallet,
    profile,
    dailyXpGrant,
    refetch,
  } = useGameData();
  const [selectedSkill, setSelectedSkill] = useState<{
    slug: string;
    name: string;
  } | null>(null);
  const attributesQuery = usePlayerAttributesQuery(profile?.id ?? profileId);
  const restrictionsQuery = useSkillPracticeRestrictions(
    profileId ?? undefined,
  );
  const restrictions = restrictionsQuery.data;
  const catalogueQuery = useSkillCatalogue();
  const availabilityQuery = useProfileSkillAvailability(
    profile?.id ?? profileId,
  );
  const relationships = useSkillCatalogueRelationships();

  const skillXpBalance = xpWallet?.skill_xp_balance ?? xpWallet?.xp_balance;
  const skillXpLifetime = xpWallet?.skill_xp_lifetime ?? xpWallet?.lifetime_xp;
  const attributePointsBalance = xpWallet?.attribute_points_balance;
  const attributePointsSpent = attributesQuery.data?.attribute_points_spent;
  const streak = xpWallet?.stipend_claim_streak ?? 0;
  const lastClaimDate =
    xpWallet?.last_stipend_claim_date ?? dailyXpGrant?.created_at;

  const stats = useMemo(
    () => calculateSkillOverviewStats(skillProgress ?? []),
    [skillProgress],
  );
  const xpCardLabel =
    stats.lifetimeXp === null ? "Current Level XP" : "Lifetime Skill XP";
  const xpCardValue = stats.lifetimeXp ?? stats.currentLevelXp;
  const catalogueBySlug = useMemo(
    () =>
      new Map((catalogueQuery.data ?? []).map((skill) => [skill.slug, skill])),
    [catalogueQuery.data],
  );
  const availabilityBySlug = useMemo(
    () =>
      new Map((availabilityQuery.data ?? []).map((item) => [item.slug, item])),
    [availabilityQuery.data],
  );
  const practiceableSkills = useMemo(
    () =>
      (skillProgress ?? []).filter(
        (skill) => getSkillDisplayProgress(skill).can_practice,
      ),
    [skillProgress],
  );

  const refreshProgressionData = async () => {
    await Promise.all([attributesQuery.refetch(), refetch()]);
  };

  const retryAll = () => {
    refetch();
    attributesQuery.refetch();
    restrictionsQuery.refetch();
  };

  const tabs = [
    {
      value: "practice",
      icon: Dumbbell,
      label: t("skills.tabs.practice", "Practice Skills"),
      desc: `Book ${SKILL_PRACTICE_CONFIG.durationOptionsHours.join("/")}-hour sessions (+${SKILL_PRACTICE_CONFIG.baseXpReward} XP)`,
    },
    {
      value: "tree",
      icon: GitBranch,
      label: t("skills.tabs.tree", "Skill Tree"),
      desc: t("skills.tabs.treeDesc", "Unlock and level up abilities"),
    },
    {
      value: "attributes",
      icon: Gauge,
      label: t("skills.tabs.attributes", "Attributes"),
      desc: t("skills.tabs.attributesDesc", "Spend AP on core stats"),
    },
  ];

  return (
    <FMPageScaffold
      title={t("skills.title", "Skills & Attributes")}
      subtitle={t(
        "skills.subtitle",
        "Master your craft and unlock new abilities",
      )}
      icon={Sparkles}
      backTo="/hub/character"
    >
      {(error || attributesQuery.error || restrictionsQuery.error) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>
              {t(
                "skills.errors.loadFailed",
                "Some progression data failed to load. Values are not being replaced with zero.",
              )}
            </span>
            <Button size="sm" variant="outline" onClick={retryAll}>
              {t("common.retry", "Retry")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading || !xpWallet ? (
        <Card>
          <CardContent className="pt-6">
            {loading
              ? t("skills.loading.wallet", "Loading XP wallet…")
              : t("skills.empty.wallet", "XP wallet row is missing.")}
          </CardContent>
        </Card>
      ) : (
        <XpWalletDisplay
          skillXpBalance={skillXpBalance ?? 0}
          skillXpLifetime={skillXpLifetime ?? 0}
          attributePointsBalance={attributePointsBalance ?? 0}
          attributePointsSpent={attributePointsSpent ?? 0}
          streak={streak}
        />
      )}

      <DailyStipendCard lastClaimDate={lastClaimDate} streak={streak} />

      {restrictionsQuery.isLoading && (
        <Alert>
          <Target className="h-4 w-4" />
          <AlertDescription>
            {t("skills.loading.practice", "Checking practice availability…")}
          </AlertDescription>
        </Alert>
      )}
      {restrictions && !restrictions.canPractice && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {restrictions.reason} Next reset:{" "}
            {formatReset(restrictions.nextResetAt)}
          </AlertDescription>
        </Alert>
      )}
      {restrictions?.canPractice && (
        <Alert>
          <Target className="h-4 w-4" />
          <AlertDescription>
            Practice sessions today: {restrictions.sessionsUsed}/
            {restrictions.maxDailySessions} — {restrictions.sessionsRemaining}{" "}
            remaining. Next reset: {formatReset(restrictions.nextResetAt)}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            label: xpCardLabel,
            value: xpCardValue.toLocaleString(),
            icon: TrendingUp,
          },
          {
            label: "Skills Unlocked",
            value: stats.unlockedCount,
            icon: Target,
          },
          {
            label: "Average Level",
            value: stats.averageLevel.toFixed(1),
            icon: Award,
          },
          {
            label: "Can Practice",
            value: stats.practiceableCount,
            icon: Zap,
            note: `Meets level ${SKILL_PRACTICE_CONFIG.minimumSkillLevel}+ and server rules`,
          },
        ].map(({ label, value, icon: Icon, note }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              {note && <p className="text-xs text-muted-foreground">{note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="practice" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto gap-2 bg-transparent p-0">
          {tabs.map(({ value, icon: Icon, label, desc }) => (
            <TabsTrigger
              key={value}
              value={value}
              aria-label={label}
              className={cn(
                "flex flex-col items-start gap-1 h-auto p-4 rounded-lg border border-border bg-card text-left",
                "data-[state=active]:border-primary data-[state=active]:bg-primary/10 data-[state=active]:shadow-md",
                "hover:border-primary/60 transition-colors",
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <Icon className="h-5 w-5 text-primary" />
                <span className="font-semibold text-base">{label}</span>
              </div>
              <span className="text-xs text-muted-foreground font-normal">
                {desc}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="attributes" className="mt-6">
          {attributesQuery.isLoading ? (
            <Card>
              <CardContent className="pt-6">
                {t("skills.loading.attributes", "Loading attributes…")}
              </CardContent>
            </Card>
          ) : attributesQuery.data ? (
            <AttributePanel
              attributes={attributesQuery.data}
              xpBalance={attributePointsBalance ?? 0}
              onXpSpent={refreshProgressionData}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                {t(
                  "skills.empty.attributes",
                  "Attribute row is missing for this profile.",
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tree" className="mt-6">
          {loading ? (
            <Card>
              <CardContent className="pt-6">
                {t("skills.loading.skills", "Loading skills…")}
              </CardContent>
            </Card>
          ) : (
            <SkillTree />
          )}
        </TabsContent>

        <TabsContent value="practice" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Practice Skills</CardTitle>
              <CardDescription>
                Schedule practice sessions using the shared practice
                configuration:{" "}
                {SKILL_PRACTICE_CONFIG.durationOptionsHours.join("/")}-hour
                duration, {SKILL_PRACTICE_CONFIG.baseXpReward} XP reward,
                maximum{" "}
                {restrictions?.maxDailySessions ??
                  SKILL_PRACTICE_CONFIG.maxDailySessions}{" "}
                sessions per server day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p>{t("skills.loading.skills", "Loading skills…")}</p>
              ) : practiceableSkills.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No skills available to practice yet.</p>
                  <p className="text-sm mt-2">
                    Starter skills can be unlocked through education and
                    supported practice or rehearsal activities.
                  </p>
                  <Button asChild size="sm" className="mt-4">
                    <a href="/education">Find starter lessons</a>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {practiceableSkills.map((skill) => {
                    const display = getSkillDisplayProgress(skill);
                    const canonical = catalogueBySlug.get(skill.skill_slug);
                    const name =
                      canonical?.name ??
                      `${skill.skill_slug.replace(/_/g, " ")} (legacy)`;
                    const attrLinks = relationships.attributeLinks.filter(
                      (link) => link.skill_slug === skill.skill_slug,
                    );
                    const availability = availabilityBySlug.get(
                      skill.skill_slug,
                    );
                    const learningBonus = calculateWeightedLearningMultiplier(
                      skill.skill_slug,
                      attributesQuery.data as any,
                      attrLinks,
                    );
                    const primaryRole = relationships.roleLinks
                      .find((link) => link.skill_slug === skill.skill_slug)
                      ?.role_key.replace(/_/g, " ");
                    return (
                      <div
                        key={skill.skill_slug}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold capitalize">
                                {name}
                              </h4>
                              <Badge variant="outline">
                                Level {display.current_level}
                              </Badge>
                              {canonical && (
                                <Badge variant="secondary">
                                  {canonical.category}
                                </Badge>
                              )}
                              {availability && (
                                <Badge variant="outline">
                                  {availability.status.replace(/_/g, " ")}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              <span>
                                {display.xp_into_level}/
                                {display.xp_required_for_next_level ?? "Max"} XP
                              </span>
                              {attrLinks.length > 0 && (
                                <span>
                                  Attributes:{" "}
                                  {attrLinks
                                    .map(
                                      (link) =>
                                        `${getAttributeLabel(link.attribute_key)} ${Math.round(link.weight * 100)}%`,
                                    )
                                    .join(", ")}{" "}
                                  (+{learningBonus.boostPercent}%)
                                </span>
                              )}
                              {primaryRole && <span>Role: {primaryRole}</span>}
                              {availability?.blockedReason && (
                                <span className="text-destructive">
                                  {availability.blockedReason.message}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-label={`Schedule practice for ${name}`}
                            disabled={!restrictions?.canPractice}
                            onClick={() =>
                              setSelectedSkill({ slug: skill.skill_slug, name })
                            }
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            Schedule Practice
                          </Button>
                        </div>
                        <Progress
                          value={display.progress_percent}
                          className="h-2"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedSkill && (
        <SchedulePracticeDialog
          open={!!selectedSkill}
          onOpenChange={(open) => !open && setSelectedSkill(null)}
          skillSlug={selectedSkill.slug}
          skillName={selectedSkill.name}
          practiceConfig={restrictions}
        />
      )}
    </FMPageScaffold>
  );
};

export default SkillsPage;
