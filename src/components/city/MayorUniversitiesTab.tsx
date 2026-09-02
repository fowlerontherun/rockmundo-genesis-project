import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { GraduationCap, Loader2, LockKeyhole, PiggyBank, Sparkles } from "lucide-react";
import { useCityTreasury } from "@/hooks/useCityProjects";
import {
  getUniversityQualityUpgradeCost,
  useMayorUniversities,
  useSetUniversityCourseFees,
  useUpgradeUniversityQuality,
  type MayorUniversity,
} from "@/hooks/useMayorUniversities";

export function MayorUniversitiesTab({ cityId }: { cityId: string }) {
  const { data: universities = [], isLoading } = useMayorUniversities(cityId);
  const { data: treasury } = useCityTreasury(cityId);
  const setFees = useSetUniversityCourseFees();
  const upgradeQuality = useUpgradeUniversityQuality();
  const [feeDrafts, setFeeDrafts] = useState<Record<string, number>>({});

  useEffect(() => {
    setFeeDrafts(
      Object.fromEntries(universities.map((university) => [university.id, university.mayor_fee_modifier])),
    );
  }, [universities]);

  const availableTreasury = useMemo(
    () => Number(treasury?.balance ?? 0) - Number(treasury?.pending_commitments ?? 0),
    [treasury],
  );

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-24 rounded-lg bg-muted" />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="h-80 rounded-lg bg-muted" />
          <div className="h-80 rounded-lg bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <GraduationCap className="h-4 w-4" /> City universities
              </div>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Invest city funds to improve teaching quality, or adjust what students pay. Prestige represents the institution's long-term reputation and is locked from mayoral control.
              </p>
            </div>
            <Badge variant="secondary" className="w-fit text-sm">
              <PiggyBank className="mr-1.5 h-4 w-4" /> Available treasury: ${Math.max(0, availableTreasury).toLocaleString()}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {universities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            This city does not currently have a university to manage.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {universities.map((university) => (
            <UniversityManagementCard
              key={university.id}
              cityId={cityId}
              university={university}
              availableTreasury={availableTreasury}
              feeDraft={feeDrafts[university.id] ?? university.mayor_fee_modifier}
              onFeeDraftChange={(value) =>
                setFeeDrafts((current) => ({ ...current, [university.id]: value }))
              }
              onSaveFees={() =>
                setFees.mutate({
                  cityId,
                  universityId: university.id,
                  feeModifier: feeDrafts[university.id] ?? university.mayor_fee_modifier,
                })
              }
              onUpgrade={() => upgradeQuality.mutate({ cityId, universityId: university.id })}
              savingFees={setFees.isPending && setFees.variables?.universityId === university.id}
              upgrading={upgradeQuality.isPending && upgradeQuality.variables?.universityId === university.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UniversityManagementCard({
  cityId: _cityId,
  university,
  availableTreasury,
  feeDraft,
  onFeeDraftChange,
  onSaveFees,
  onUpgrade,
  savingFees,
  upgrading,
}: {
  cityId: string;
  university: MayorUniversity;
  availableTreasury: number;
  feeDraft: number;
  onFeeDraftChange: (value: number) => void;
  onSaveFees: () => void;
  onUpgrade: () => void;
  savingFees: boolean;
  upgrading: boolean;
}) {
  const upgradeCost = getUniversityQualityUpgradeCost(university.quality_of_learning);
  const feeChanged = Math.abs(feeDraft - university.mayor_fee_modifier) > 0.001;
  const estimatedEffective = Number((university.academic_cost_modifier * feeDraft).toFixed(2));
  const feePct = Math.round((feeDraft - 1) * 100);
  const canAffordUpgrade = upgradeCost !== null && availableTreasury >= upgradeCost;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{university.name}</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              {university.course_count.toLocaleString()} active course{university.course_count === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="secondary">Quality {university.quality_of_learning}</Badge>
            <Badge variant="outline">Prestige {university.prestige}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Teaching quality</span>
            <span className="text-muted-foreground">{university.quality_of_learning}/100</span>
          </div>
          <Progress value={university.quality_of_learning} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Higher quality improves course XP and shortens the time students need to complete new enrollments.
          </p>
        </div>

        <div className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Sparkles className="h-4 w-4" /> Quality investment
              </div>
              {upgradeCost === null ? (
                <div className="mt-1 text-xs text-muted-foreground">Maximum teaching quality reached.</div>
              ) : (
                <div className="mt-1 text-xs text-muted-foreground">
                  Improve quality {university.quality_of_learning} → {university.quality_of_learning + 1}. Cost rises as the university becomes stronger.
                </div>
              )}
            </div>
            {upgradeCost !== null && <Badge variant="outline">${upgradeCost.toLocaleString()}</Badge>}
          </div>

          <Button
            className="mt-3 w-full"
            size="sm"
            disabled={upgradeCost === null || !canAffordUpgrade || upgrading}
            onClick={onUpgrade}
          >
            {upgrading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
            {upgradeCost === null ? "Quality maxed" : "Fund +1 quality upgrade"}
          </Button>
          {upgradeCost !== null && !canAffordUpgrade && (
            <div className="mt-2 text-xs text-warning">
              Treasury short by ${Math.max(0, upgradeCost - availableTreasury).toLocaleString()}.
            </div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">
            City investment to date: ${university.quality_investment_total.toLocaleString()}
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Course fee policy</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Set student fees from 20% below to 20% above the university's academic baseline.
              </div>
            </div>
            <Badge variant={feePct > 0 ? "default" : feePct < 0 ? "secondary" : "outline"}>
              {feePct > 0 ? "+" : ""}{feePct}%
            </Badge>
          </div>

          <div className="mt-4 px-1">
            <Slider
              min={0.8}
              max={1.2}
              step={0.05}
              value={[feeDraft]}
              onValueChange={([value]) => onFeeDraftChange(Number(value.toFixed(2)))}
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>-20%</span>
              <span>Baseline</span>
              <span>+20%</span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <Metric label="Academic" value={`${university.academic_cost_modifier.toFixed(2)}x`} />
            <Metric label="Mayor fee" value={`${feeDraft.toFixed(2)}x`} />
            <Metric label="Effective" value={`${estimatedEffective.toFixed(2)}x`} />
          </div>

          <Button
            className="mt-3 w-full"
            size="sm"
            variant="outline"
            disabled={!feeChanged || savingFees}
            onClick={onSaveFees}
          >
            {savingFees && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save course fees
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Prestige is fixed at <strong className="text-foreground">{university.prestige}</strong>. Mayor actions can improve quality and change fees, but can never increase or decrease prestige.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/35 px-2 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}
