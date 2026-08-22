import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hammer, Loader2, Lock, X, CheckCircle2, Clock } from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  useCityProjects,
  useCityProjectTypes,
  useProposeCityProject,
  useCancelCityProject,
} from "@/hooks/useCityProjects";
import {
  PROJECT_CATEGORY_LABELS,
  PROJECT_EFFECT_LABELS,
  type CityProjectCategory,
  type CityProject,
  type CityProjectEffects,
  type CityProjectType,
} from "@/types/city-projects";
import type { MayorPoliticsState } from "@/hooks/useMayorPolitics";
import { getSkillBySlug } from "@/utils/skillCatalogue";

interface Props {
  cityId: string;
  politics: MayorPoliticsState | undefined;
}

const LEGACY_DUPLICATE_EFFECTS = new Set<keyof CityProjectEffects>(["music_scene", "local_bonus"]);

function visibleEffects(effects: CityProjectEffects) {
  return Object.entries(effects).filter(([key]) => {
    const typedKey = key as keyof CityProjectEffects;
    if (!LEGACY_DUPLICATE_EFFECTS.has(typedKey)) return true;
    if (typedKey === "music_scene" && effects.music_scene_rating != null) return false;
    if (typedKey === "local_bonus" && Object.keys(effects).some((candidate) => candidate.endsWith("_rating"))) return false;
    return true;
  });
}

function effectLabel(key: string) {
  return PROJECT_EFFECT_LABELS[key as keyof CityProjectEffects] ?? key.replace(/_/g, " ");
}

function effectValue(key: string, value: number) {
  if (key === "weekly_budget_bonus") return `+$${Number(value).toLocaleString()}/week`;
  if (key === "max_concert_capacity") return `${Number(value).toLocaleString()} capacity`;
  if (key === "population") return `+${Number(value).toLocaleString()}`;
  return `${value >= 0 ? "+" : ""}${value}`;
}

export function MayorProjectsTab({ cityId, politics }: Props) {
  const { data: types } = useCityProjectTypes();
  const { data: projects } = useCityProjects(cityId);
  const propose = useProposeCityProject();
  const cancel = useCancelCityProject();

  const [confirmType, setConfirmType] = useState<CityProjectType | null>(null);

  const active = useMemo(
    () => projects?.filter((p) => p.status === "in_progress") ?? [],
    [projects],
  );
  const completed = useMemo(
    () => projects?.filter((p) => p.status === "completed") ?? [],
    [projects],
  );
  const cancelled = useMemo(
    () =>
      projects?.filter(
        (p) => p.status === "cancelled" || p.status === "failed",
      ) ?? [],
    [projects],
  );

  // Preview only. The RPC recalculates this discount and the final price before
  // reserving any treasury funds, so a modified browser cannot change the cost.
  const discount = politics?.unlocks.projectDiscount ?? 0;

  const finalCost = (t: CityProjectType) =>
    Math.round(t.base_cost * (1 - discount / 100));

  const isUnlocked = (t: CityProjectType) => {
    if (!t.required_skill_slug || t.required_skill_level === 0) return true;
    if (!politics) return false;
    const lvl =
      (politics.levels as unknown as Record<string, number>)[
        t.required_skill_slug
      ] ?? 0;
    return lvl >= t.required_skill_level;
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completed.length})
          </TabsTrigger>
          <TabsTrigger value="archive">
            Archive ({cancelled.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="space-y-3 mt-4">
          <div className="rounded-lg border bg-muted/15 p-3 text-xs text-muted-foreground">
            Completed projects now permanently improve explicit city ratings. A rating of 50 is neutral; higher ratings create bounded gameplay advantages shown in City Services.
          </div>
          {discount > 0 && (
            <div className="text-xs text-success">
              ✓ Negotiation skill grants you a {discount}% discount on all
              project costs. The final cost is verified by City Hall when you confirm.
            </div>
          )}
          {(
            [
              "infrastructure",
              "culture",
              "economy",
              "quality_of_life",
            ] as CityProjectCategory[]
          ).map((cat) => {
            const items = (types ?? []).filter((t) => t.category === cat);
            if (items.length === 0) return null;
            return (
              <div key={cat} className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground tracking-wide">
                  {PROJECT_CATEGORY_LABELS[cat]}
                </h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {items.map((t) => {
                    const unlocked = isUnlocked(t);
                    return (
                      <Card
                        key={t.id}
                        className={!unlocked ? "opacity-60" : ""}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm flex items-center gap-2">
                                {t.name}
                                {!unlocked && (
                                  <Lock className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {t.description}
                              </div>
                            </div>
                            <Badge variant="outline" className="shrink-0">
                              ${finalCost(t).toLocaleString()}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 text-xs">
                            <Badge variant="secondary">
                              {t.duration_days}d
                            </Badge>
                            <Badge variant="secondary">
                              +{t.approval_change} approval
                            </Badge>
                            {visibleEffects(t.effects).map(([key, value]) => (
                              <Badge
                                key={key}
                                variant="secondary"
                                className="text-xs"
                              >
                                {effectLabel(key)}: {effectValue(key, Number(value))}
                              </Badge>
                            ))}
                          </div>
                          {!unlocked && t.required_skill_slug && (
                            <div className="text-xs text-warning">
                              Requires {getSkillBySlug(t.required_skill_slug)?.name ?? "Unknown catalogue skill"}{" "}
                              ≥ {t.required_skill_level}
                            </div>
                          )}
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={!unlocked || propose.isPending}
                            onClick={() => setConfirmType(t)}
                          >
                            <Hammer className="h-3 w-3 mr-1" /> Propose
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="active" className="space-y-2 mt-4">
          {active.length === 0 ? (
            <EmptyState text="No active projects" />
          ) : (
            active.map((p) => (
              <ActiveProjectCard
                key={p.id}
                project={p}
                onCancel={() => cancel.mutate({ projectId: p.id, cityId })}
                cancelling={cancel.isPending}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-2 mt-4">
          {completed.length === 0 ? (
            <EmptyState text="No completed projects yet" />
          ) : (
            completed.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" /> {p.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Completed{" "}
                      {p.completed_at
                        ? format(new Date(p.completed_at), "MMM d, yyyy")
                        : ""}{" "}
                      · ${p.cost.toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="outline">+{p.approval_change} approval</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="archive" className="space-y-2 mt-4">
          {cancelled.length === 0 ? (
            <EmptyState text="No archived projects" />
          ) : (
            cancelled.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.status === "cancelled" ? "Cancelled" : "Failed"} · $
                      {p.cost.toLocaleString()}
                    </div>
                  </div>
                  <Badge variant="destructive">{p.status}</Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!confirmType}
        onOpenChange={(open) => !open && setConfirmType(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose: {confirmType?.name}</DialogTitle>
            <DialogDescription>{confirmType?.description}</DialogDescription>
          </DialogHeader>
          {confirmType && (
            <div className="space-y-3 text-sm">
              <Row
                label="Estimated cost"
                value={`$${finalCost(confirmType).toLocaleString()}`}
              />
              <Row
                label="Duration"
                value={`${confirmType.duration_days} days`}
              />
              <Row
                label="Approval impact"
                value={`+${confirmType.approval_change}`}
              />
              <div className="rounded-lg border p-3">
                <div className="mb-2 text-xs font-medium text-muted-foreground">City effects on completion</div>
                <div className="flex flex-wrap gap-1">
                  {visibleEffects(confirmType.effects).map(([key, value]) => (
                    <Badge key={key} variant="secondary">
                      {effectLabel(key)}: {effectValue(key, Number(value))}
                    </Badge>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                City Hall verifies the skill discount and price, then reserves the
                funds atomically. Completion and settlement are processed by the
                city governance worker even if no mayor has the page open.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmType(null)}>
              Cancel
            </Button>
            <Button
              disabled={propose.isPending}
              onClick={async () => {
                if (!confirmType) return;
                await propose.mutateAsync({
                  cityId,
                  projectTypeId: confirmType.id,
                });
                setConfirmType(null);
              }}
            >
              {propose.isPending && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Confirm & Reserve Funds
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActiveProjectCard({
  project,
  onCancel,
  cancelling,
}: {
  project: CityProject;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const start = new Date(project.started_at).getTime();
  const end = new Date(project.completes_at).getTime();
  const now = Date.now();
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const eta =
    end > now
      ? formatDistanceToNowStrict(new Date(end), { addSuffix: true })
      : "awaiting City Hall processing";

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-sm">{project.name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {eta} · $
              {project.cost.toLocaleString()}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            disabled={cancelling}
          >
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
        </div>
        <Progress value={pct} className="h-2" />
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center text-sm text-muted-foreground py-8">{text}</div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
