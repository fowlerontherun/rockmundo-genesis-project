import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/social/ScoreGauge";
import {
  Baby, ArrowLeft, UtensilsCrossed, Moon, Gamepad2, GraduationCap,
  TreePine, Heart, Sparkles, Clock, BookOpen, Briefcase,
  PencilLine, MessagesSquare, Coins, Palette, AlertTriangle, Lock,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { usePlayerChild, useChildInteractions, useApplyChildInteraction, type ChildInteractionType } from "@/hooks/useChildInteractions";
import { useChildAgeProgression, SCHOOL_STAGES, type SchoolStage } from "@/hooks/useChildAgeProgression";
import { Skeleton } from "@/components/ui/skeleton";
import { useResolvedChildTraits, type ChildTrait } from "@/hooks/useChildTraits";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ActionDef {
  type: ChildInteractionType;
  label: string;
  icon: typeof Baby;
  description: string;
  color: string;
  /** Stages where this action is available. */
  stages: SchoolStage[];
  /** Optional UI grouping. */
  group?: "care" | "education" | "social";
  /** Hint shown for locked actions. */
  unlockHint?: string;
}

const ACTIONS: ActionDef[] = [
  { type: "feed", label: "Feed", icon: UtensilsCrossed, description: "+25 food, +5 mood", color: "text-amber-500", group: "care",
    stages: ["infant", "toddler", "preschool", "primary", "middle", "high"] },
  { type: "sleep", label: "Nap", icon: Moon, description: "+30 sleep, +3 mood", color: "text-indigo-400", group: "care",
    stages: ["infant", "toddler", "preschool", "primary"] },
  { type: "comfort", label: "Comfort", icon: Heart, description: "+8 mood, +5 stability", color: "text-social-love", group: "care",
    stages: ["infant", "toddler", "preschool", "primary", "middle", "high"] },
  { type: "play", label: "Play", icon: Gamepad2, description: "+20 affection, +5 bond", color: "text-social-loyalty", group: "social",
    stages: ["toddler", "preschool", "primary", "middle"] },
  { type: "outing", label: "Outing", icon: TreePine, description: "+15 mood, +8 bond", color: "text-emerald-500", group: "social",
    stages: ["preschool", "primary", "middle", "high"] },
  { type: "teach_skill", label: "Teach", icon: GraduationCap, description: "+15 learning, +2 stability", color: "text-social-chemistry", group: "education",
    stages: ["preschool", "primary", "middle", "high"] },
  { type: "discipline", label: "Discipline", icon: AlertTriangle, description: "+6 stability, −8 mood, −4 bond", color: "text-amber-600", group: "social",
    stages: ["preschool", "primary", "middle", "high"], unlockHint: "Unlocks at age 4" },
  { type: "hobby", label: "Hobby Session", icon: Palette, description: "+12 affection, +12 learning, +8 mood", color: "text-fuchsia-500", group: "education",
    stages: ["primary", "middle", "high"], unlockHint: "Unlocks in Primary School" },
  { type: "homework", label: "Help with Homework", icon: PencilLine, description: "+25 learning, +2 stability, +4 bond, −3 mood", color: "text-sky-500", group: "education",
    stages: ["primary", "middle", "high"], unlockHint: "Unlocks in Primary School" },
  { type: "talk", label: "Have a Talk", icon: MessagesSquare, description: "+10 stability, +6 mood, +10 bond", color: "text-social-trust", group: "social",
    stages: ["middle", "high"], unlockHint: "Unlocks in Middle School" },
  { type: "allowance", label: "Give Allowance", icon: Coins, description: "+12 mood, +6 bond", color: "text-yellow-500", group: "social",
    stages: ["middle", "high"], unlockHint: "Unlocks in Middle School" },
];

const STAGE_ICON: Record<SchoolStage, typeof Baby> = {
  infant: Baby,
  toddler: Baby,
  preschool: BookOpen,
  primary: BookOpen,
  middle: GraduationCap,
  high: GraduationCap,
  graduated: Briefcase,
};

const NEED_KEYS = ["food", "sleep", "affection", "learning"] as const;

export default function ChildDetail() {
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const { data: child, isLoading } = usePlayerChild(childId);
  const { data: interactions = [] } = useChildInteractions(childId);
  const apply = useApplyChildInteraction(childId);
  const progression = useChildAgeProgression(child);

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto p-4 space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!child) {
    return (
      <div className="container max-w-3xl mx-auto p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Card className="mt-4">
          <CardContent className="py-10 text-center text-muted-foreground">
            <Baby className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Child not found.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const liveAge = progression?.liveAge ?? child.current_age ?? 0;
  const stageMeta = progression?.stageMeta ?? SCHOOL_STAGES[0];
  const StageIcon = STAGE_ICON[stageMeta.stage];

  const needs: Record<string, number> = child.needs ?? { food: 70, sleep: 70, affection: 70, learning: 50 };
  const mood = child.mood ?? 70;
  const topPotentials = Object.entries((child.inherited_potentials ?? {}) as Record<string, number>)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);
  const traitKeys: string[] = Array.isArray(child.traits) ? (child.traits as string[]) : [];
  const traits = useResolvedChildTraits(traitKeys);

  const isAdult = stageMeta.stage === "graduated";
  const visibleActions = ACTIONS.filter((a) => a.stages.includes(stageMeta.stage));
  // Locked actions: not available now, but unlock at a later stage the child will reach.
  const stageOrder: SchoolStage[] = ["infant", "toddler", "preschool", "primary", "middle", "high", "graduated"];
  const currentStageIdx = stageOrder.indexOf(stageMeta.stage);
  const lockedUpcoming = ACTIONS.filter((a) =>
    !a.stages.includes(stageMeta.stage) &&
    a.stages.some((s) => stageOrder.indexOf(s) > currentStageIdx),
  );
  const groupedVisible = {
    care: visibleActions.filter((a) => a.group === "care"),
    education: visibleActions.filter((a) => a.group === "education"),
    social: visibleActions.filter((a) => a.group === "social"),
  };

  // Stage progress bar: percent through current stage's age range.
  const [minAge, maxAge] = stageMeta.ageRange;
  const stageSpan = Math.max(1, Math.min(maxAge, 18) - minAge + 1);
  const stagePct = Math.min(100, Math.round(((liveAge - minAge + 1) / stageSpan) * 100));

  return (
    <div className="container max-w-3xl mx-auto p-4 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      {/* Header */}
      <Card className="border-social-loyalty/30 bg-gradient-to-br from-social-loyalty/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-social-loyalty/15 p-3">
                <Baby className="h-6 w-6 text-social-loyalty" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{child.name} {child.surname}</h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  Age {liveAge}
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <StageIcon className="h-3 w-3" /> {stageMeta.label}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">{child.playability_state}</Badge>
                </p>
                {child.last_interaction_at && (
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last interaction {formatDistanceToNow(new Date(child.last_interaction_at), { addSuffix: true })}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider">Mood</p>
              <p className="text-2xl font-bold text-social-loyalty">{mood}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Life stage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <StageIcon className="h-4 w-4 text-social-chemistry" /> Life Stage · {stageMeta.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">{stageMeta.description}</p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-social-chemistry transition-all"
              style={{ width: `${stagePct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Age {minAge}</span>
            <span>{stagePct}% through stage</span>
            <span>{maxAge >= 999 ? "Adult" : `Age ${maxAge}`}</span>
          </div>
        </CardContent>
      </Card>

      {/* Needs (hide for adults) */}
      {!isAdult && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="h-4 w-4 text-social-love" /> Needs
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {NEED_KEYS.map((key) => (
              <ScoreGauge
                key={key}
                label={key.charAt(0).toUpperCase() + key.slice(1)}
                value={Number(needs[key] ?? 0)}
                max={100}
                color={Number(needs[key] ?? 0) < 30 ? "destructive" : "social-trust"}
                variant="bar"
                size="sm"
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Bonds & stability */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-social-chemistry" /> Wellbeing
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3">
          <ScoreGauge label="Stability" value={child.emotional_stability ?? 70} max={100} color="social-trust" variant="bar" size="sm" />
          <ScoreGauge label="Bond A" value={child.bond_parent_a ?? 50} max={100} color="social-love" variant="bar" size="sm" />
          <ScoreGauge label="Bond B" value={child.bond_parent_b ?? 50} max={100} color="social-loyalty" variant="bar" size="sm" />
        </CardContent>
      </Card>

      {/* Personality traits — born with these, modulate every interaction */}
      {traits.length > 0 && (
        <Card className="border-social-chemistry/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-social-chemistry" /> Personality
              <span className="text-[10px] font-normal text-muted-foreground">
                Affects how interactions land
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <TooltipProvider delayDuration={150}>
              <div className="flex flex-wrap gap-1.5">
                {traits.map((t) => (
                  <Tooltip key={t.key}>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="text-[11px] gap-1 border-social-chemistry/40 bg-social-chemistry/5 cursor-help"
                      >
                        <Sparkles className="h-3 w-3 text-social-chemistry" />
                        {t.name}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[260px]">
                      <p className="text-xs font-semibold">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                      {Object.keys(t.modifiers ?? {}).length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {Object.entries(t.modifiers).map(([interaction, mods]) => (
                            <p key={interaction} className="text-[10px]">
                              <span className="capitalize text-foreground/80">
                                {interaction.replace(/_/g, " ")}:
                              </span>{" "}
                              <span className="text-muted-foreground">
                                {Object.entries(mods)
                                  .map(([k, v]) => formatModifier(k, v))
                                  .join(", ")}
                              </span>
                            </p>
                          ))}
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipContent_OR_DESCRIPTION_REPLACED />
          </CardContent>
        </Card>
      )}

      {/* Interaction Actions — gated by stage */}
      {!isAdult ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Care &amp; Activities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(["care", "education", "social"] as const).map((group) => {
              const items = groupedVisible[group];
              if (items.length === 0) return null;
              const groupLabel = group === "care" ? "Daily Care" : group === "education" ? "Education" : "Social & Bonding";
              return (
                <div key={group} className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{groupLabel}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {items.map(({ type, label, icon: Icon, description, color }) => (
                      <Button
                        key={type}
                        variant="outline"
                        className="h-auto flex-col items-start gap-1 p-3 text-left"
                        disabled={apply.isPending}
                        onClick={() => apply.mutate({ type })}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Icon className={`h-4 w-4 ${color}`} />
                          <span className="text-sm font-semibold">{label}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-normal">{description}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}

            {visibleActions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                No care actions available at this stage.
              </p>
            )}

            {lockedUpcoming.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Coming Up
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {lockedUpcoming.map(({ type, label, icon: Icon, description, color, unlockHint }) => (
                    <div
                      key={type}
                      className="rounded-md border border-dashed border-border/60 p-3 opacity-60 cursor-not-allowed"
                      title={unlockHint ?? "Locked"}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Icon className={`h-4 w-4 ${color}`} />
                        <span className="text-sm font-semibold">{label}</span>
                        <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
                      {unlockHint && (
                        <p className="text-[10px] text-social-chemistry mt-0.5">{unlockHint}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-social-love/30">
          <CardContent className="p-5 text-center space-y-2">
            <Briefcase className="h-8 w-8 mx-auto text-social-love" />
            <p className="text-sm font-semibold">{child.name} has come of age.</p>
            <p className="text-xs text-muted-foreground">
              They are now an independent adult and playable as their own character.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top potentials */}
      {topPotentials.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-social-chemistry" /> Inherited Potentials
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {topPotentials.map(([skill, value]) => (
              <ScoreGauge
                key={skill}
                label={skill.charAt(0).toUpperCase() + skill.slice(1)}
                value={value}
                max={20}
                color="social-chemistry"
                variant="bar"
                size="sm"
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent interactions */}
      {interactions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Interactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {interactions.slice(0, 8).map((i) => (
              <div key={i.id} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <span className="font-medium capitalize">{i.interaction_type.replace("_", " ")}</span>
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
