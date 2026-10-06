import { useMemo, useState } from "react";
import { CheckCircle2, Guitar, Lock, PackageCheck, Sparkles, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getQualityLabel } from "@/data/craftingMaterials";
import {
  DEFAULT_LUTHIERY_SELECTION,
  LUTHIERY_COLOURS,
  LUTHIERY_DECALS,
  LUTHIERY_MATERIAL_OPTIONS,
  LUTHIERY_PART_LABELS,
  LUTHIERY_PART_ORDER,
  LUTHIERY_SHAPES,
  calculateProjectedLuthieryOutcome,
  formatLuthieryRequirement,
  getLuthieryProgress,
  getMaterialOption,
  getShapeForSelection,
  isLuthieryRequirementMet,
  resolveCatalogMaterial,
  type LuthieryBuildPreviewSpec,
  type LuthieryBuildSelection,
  type LuthieryInstrumentKind,
  type LuthieryPartSlot,
  type LuthieryProjectedStats,
} from "@/data/luthieryWorkbench";
import type { CraftingMaterial, LuthieryCraftResult, PlayerCraftingMaterial } from "@/hooks/useCraftingSystem";
import { useSkillSystem } from "@/hooks/useSkillSystem";
import { LuthieryInstrumentPreview } from "@/components/crafting/LuthieryInstrumentPreview";
import { LuthieryBuildReviewDialog } from "@/components/crafting/LuthieryBuildReviewDialog";

interface LuthieryWorkbenchProps {
  materialsCatalog: CraftingMaterial[];
  playerMaterials: PlayerCraftingMaterial[];
  isCrafting?: boolean;
  onCraft?: (selection: LuthieryBuildSelection, idempotencyKey: string) => Promise<LuthieryCraftResult>;
  onCrafted?: (result: LuthieryCraftResult) => void;
}

const createCraftRequestKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `luthiery-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const STAT_LABELS: Array<[keyof LuthieryProjectedStats, string]> = [
  ["tone", "Tone"],
  ["sustain", "Sustain"],
  ["stability", "Stability"],
  ["output", "Output"],
  ["stagePresence", "Stage Presence"],
];

const qualityTone = (quality: number) => {
  if (quality >= 95) return "border-amber-400/50 bg-amber-400/10";
  if (quality >= 80) return "border-yellow-400/40 bg-yellow-400/10";
  if (quality >= 60) return "border-purple-400/40 bg-purple-400/10";
  if (quality >= 40) return "border-blue-400/40 bg-blue-400/10";
  if (quality >= 20) return "border-border bg-muted/30";
  return "border-red-400/40 bg-red-400/10";
};

export const LuthieryWorkbench = ({
  materialsCatalog,
  playerMaterials,
  isCrafting = false,
  onCraft,
  onCrafted,
}: LuthieryWorkbenchProps) => {
  const { progress, refreshProgress } = useSkillSystem();
  const [selection, setSelection] = useState<LuthieryBuildSelection>(DEFAULT_LUTHIERY_SELECTION);
  const [activePart, setActivePart] = useState<LuthieryPartSlot>("body");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [confirmedSpec, setConfirmedSpec] = useState<LuthieryBuildPreviewSpec | null>(null);
  const [confirmedFingerprint, setConfirmedFingerprint] = useState<string | null>(null);
  const [confirmedCraftKey, setConfirmedCraftKey] = useState<string | null>(null);
  const [craftedFingerprint, setCraftedFingerprint] = useState<string | null>(null);

  const luthieryProgress = useMemo(() => getLuthieryProgress(progress), [progress]);
  const shape = useMemo(() => getShapeForSelection(selection), [selection]);
  const outcome = useMemo(
    () => calculateProjectedLuthieryOutcome(selection, materialsCatalog, progress),
    [selection, materialsCatalog, progress],
  );
  const quality = getQualityLabel(outcome.quality);
  const selectionFingerprint = JSON.stringify(selection);
  const confirmedCurrent = confirmedFingerprint === selectionFingerprint && confirmedSpec !== null;
  const craftedCurrent = craftedFingerprint === selectionFingerprint;

  const handleCraft = async () => {
    if (!onCraft || !confirmedCurrent || !confirmedCraftKey || craftedCurrent || isCrafting) return;
    try {
      const result = await onCraft(selection, confirmedCraftKey);
      setCraftedFingerprint(selectionFingerprint);
      await refreshProgress();
      onCrafted?.(result);
    } catch {
      // The mutation owns player-facing error feedback; keep the confirmed request key
      // so a network retry remains idempotent.
    }
  };

  const ownedQuantity = (material: CraftingMaterial | undefined) => {
    if (!material) return 0;
    return playerMaterials.find((item) => item.material_id === material.id)?.quantity ?? 0;
  };

  const changeInstrument = (instrumentKind: LuthieryInstrumentKind) => {
    setSelection((current) => {
      const currentShape = LUTHIERY_SHAPES.find((candidate) => candidate.id === current.shapeId);
      if (
        currentShape?.instrumentKinds.includes(instrumentKind) &&
        isLuthieryRequirementMet(currentShape.requirement, progress)
      ) {
        return { ...current, instrumentKind };
      }

      const fallback =
        LUTHIERY_SHAPES.find(
          (candidate) =>
            candidate.instrumentKinds.includes(instrumentKind) &&
            isLuthieryRequirementMet(candidate.requirement, progress),
        ) ??
        LUTHIERY_SHAPES.find((candidate) => candidate.instrumentKinds.includes(instrumentKind)) ??
        LUTHIERY_SHAPES[0];

      return { ...current, instrumentKind, shapeId: fallback.id };
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {([
          ["basic", "Luthiery Basics"],
          ["professional", "Professional"],
          ["mastery", "Master Luthier"],
        ] as const).map(([tier, label]) => (
          <Card key={tier} className="border-border/60">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Badge variant="secondary">Lv {Math.round(luthieryProgress[tier])}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Guitar className="h-4 w-4" />
                  Visual Luthiery Workbench
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Build the instrument on screen. Selecting the body, neck, fretboard, pickups or bridge also selects that part below.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={selection.instrumentKind === "electric_guitar" ? "default" : "outline"}
                  onClick={() => changeInstrument("electric_guitar")}
                >
                  Guitar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={selection.instrumentKind === "electric_bass" ? "default" : "outline"}
                  onClick={() => changeInstrument("electric_bass")}
                >
                  Bass
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-gradient-to-b from-muted/20 to-background p-3">
              <LuthieryInstrumentPreview
                selection={selection}
                shape={shape}
                activePart={activePart}
                onSelectPart={setActivePart}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="luthiery-instrument-name" className="text-xs">Instrument name</Label>
              <Input
                id="luthiery-instrument-name"
                value={selection.instrumentName}
                onChange={(event) =>
                  setSelection((current) => ({ ...current, instrumentName: event.target.value.slice(0, 40) }))
                }
                maxLength={40}
                placeholder={selection.instrumentKind === "electric_bass" ? "Name your bass..." : "Name your guitar..."}
                aria-describedby="luthiery-instrument-name-help"
              />
              <p id="luthiery-instrument-name-help" className="text-[10px] text-muted-foreground">
                2–40 characters. The reviewed name will be part of the future immutable crafted-item specification.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium">Body shape</p>
                <Badge variant="outline">{shape.name}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {LUTHIERY_SHAPES.filter((candidate) =>
                  candidate.instrumentKinds.includes(selection.instrumentKind),
                ).map((candidate) => {
                  const unlocked = isLuthieryRequirementMet(candidate.requirement, progress);
                  return (
                    <Button
                      key={candidate.id}
                      type="button"
                      size="sm"
                      variant={selection.shapeId === candidate.id ? "default" : "outline"}
                      disabled={!unlocked}
                      onClick={() => setSelection((current) => ({ ...current, shapeId: candidate.id }))}
                      className="h-auto min-h-10 whitespace-normal px-2 py-2 text-xs"
                      title={!unlocked ? formatLuthieryRequirement(candidate.requirement) : candidate.name}
                    >
                      <span className="flex min-w-0 flex-col items-center leading-tight">
                        <svg viewBox="15 35 150 145" className="mb-1 h-9 w-12" aria-hidden="true"><path d={candidate.bodyPath} fill="currentColor" opacity=".75" /></svg>
                        <span className="flex items-center gap-1">
                          {!unlocked && <Lock className="h-3 w-3 shrink-0" />}
                          <span>{candidate.name}</span>
                        </span>
                        <span className="mt-0.5 text-[9px] opacity-70">
                          {unlocked ? "Unlocked" : formatLuthieryRequirement(candidate.requirement)}
                        </span>
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="luthiery-body-colour" className="text-xs font-medium">Body colour</Label>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">{selection.colour}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {LUTHIERY_COLOURS.map((colour) => (
                  <button
                    key={colour.id}
                    type="button"
                    aria-label={colour.label}
                    title={colour.label}
                    onClick={() => setSelection((current) => ({ ...current, colour: colour.value }))}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      selection.colour === colour.value ? "border-primary ring-2 ring-primary/30" : "border-border"
                    }`}
                    style={{ backgroundColor: colour.value }}
                  />
                ))}
                <label className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 text-xs">
                  <span>Custom</span>
                  <Input
                    id="luthiery-body-colour"
                    type="color"
                    value={selection.colour}
                    onChange={(event) =>
                      setSelection((current) => ({ ...current, colour: event.target.value.toLowerCase() }))
                    }
                    className="h-8 w-12 cursor-pointer border-0 bg-transparent p-0"
                    aria-label="Custom body colour"
                  />
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Choose a preset or use the colour picker for any custom finish colour.
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium">Finish</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {LUTHIERY_MATERIAL_OPTIONS.filter((option) => option.slot === "finish").map((option) => {
                  const unlocked = isLuthieryRequirementMet(option.requirement, progress);
                  const material = resolveCatalogMaterial(option, materialsCatalog);
                  const owned = ownedQuantity(material);
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      size="sm"
                      variant={selection.finishId === option.id ? "default" : "outline"}
                      disabled={!unlocked || !material}
                      onClick={() =>
                        setSelection((current) => ({
                          ...current,
                          finishId: option.id,
                          decal: option.id === "finish-artwork" ? current.decal : { ...current.decal, id: "none" },
                        }))
                      }
                      className="h-auto min-h-12 whitespace-normal flex-col items-start px-2 py-2 text-left"
                    >
                      <span className="flex w-full items-center gap-1 text-xs font-medium">
                        {!unlocked && <Lock className="h-3 w-3" />}
                        {option.label}
                      </span>
                      <span className="text-[10px] opacity-70">
                        {!material
                          ? "Not stocked"
                          : unlocked
                            ? `${owned} owned`
                            : formatLuthieryRequirement(option.requirement)}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 rounded-md border border-border/60 p-3">
              <div>
                <p className="text-xs font-medium">Artwork / decal placement</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Select Custom Artwork finish to place an on-body decal and tune its position, size and rotation.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {LUTHIERY_DECALS.map((decal) => (
                  <Button
                    key={decal.id}
                    type="button"
                    size="sm"
                    variant={selection.decal.id === decal.id ? "default" : "outline"}
                    disabled={decal.id !== "none" && selection.finishId !== "finish-artwork"}
                    onClick={() =>
                      setSelection((current) => ({
                        ...current,
                        decal: { ...current.decal, id: decal.id },
                      }))
                    }
                    className="h-auto min-h-9 whitespace-normal px-2 py-1.5 text-xs"
                  >
                    {decal.label}
                  </Button>
                ))}
              </div>

              {selection.finishId === "finish-artwork" && selection.decal.id !== "none" && (
                <div className="grid gap-3 sm:grid-cols-2" data-testid="decal-placement-controls">
                  <label className="space-y-1 text-[10px] text-muted-foreground">
                    <span className="flex justify-between"><span>Horizontal</span><span>{selection.decal.x}%</span></span>
                    <input
                      aria-label="Decal horizontal position"
                      className="w-full accent-primary"
                      type="range"
                      min="0"
                      max="100"
                      value={selection.decal.x}
                      onChange={(event) =>
                        setSelection((current) => ({
                          ...current,
                          decal: { ...current.decal, x: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-[10px] text-muted-foreground">
                    <span className="flex justify-between"><span>Vertical</span><span>{selection.decal.y}%</span></span>
                    <input
                      aria-label="Decal vertical position"
                      className="w-full accent-primary"
                      type="range"
                      min="0"
                      max="100"
                      value={selection.decal.y}
                      onChange={(event) =>
                        setSelection((current) => ({
                          ...current,
                          decal: { ...current.decal, y: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-[10px] text-muted-foreground">
                    <span className="flex justify-between"><span>Size</span><span>{selection.decal.scale}%</span></span>
                    <input
                      aria-label="Decal size"
                      className="w-full accent-primary"
                      type="range"
                      min="50"
                      max="160"
                      value={selection.decal.scale}
                      onChange={(event) =>
                        setSelection((current) => ({
                          ...current,
                          decal: { ...current.decal, scale: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-[10px] text-muted-foreground">
                    <span className="flex justify-between"><span>Rotation</span><span>{selection.decal.rotation}°</span></span>
                    <input
                      aria-label="Decal rotation"
                      className="w-full accent-primary"
                      type="range"
                      min="-180"
                      max="180"
                      value={selection.decal.rotation}
                      onChange={(event) =>
                        setSelection((current) => ({
                          ...current,
                          decal: { ...current.decal, rotation: Number(event.target.value) },
                        }))
                      }
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <p className="mb-1 text-[10px] text-muted-foreground">Decal colour</p>
                    <div className="flex flex-wrap gap-2">
                      {["#f5f5f5", "#111827", "#e11d48", "#f59e0b", "#38bdf8"].map((colour) => (
                        <button
                          key={colour}
                          type="button"
                          aria-label={`Decal colour ${colour}`}
                          onClick={() =>
                            setSelection((current) => ({
                              ...current,
                              decal: { ...current.decal, colour },
                            }))
                          }
                          className={`h-7 w-7 rounded-full border-2 ${
                            selection.decal.colour === colour ? "border-primary ring-2 ring-primary/30" : "border-border"
                          }`}
                          style={{ backgroundColor: colour }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wrench className="h-4 w-4" />
                Five-part assembly
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-5 gap-1">
                {LUTHIERY_PART_ORDER.map((slot, index) => {
                  const selected = getMaterialOption(selection.parts[slot]);
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setActivePart(slot)}
                      className={`rounded-md border p-2 text-center transition-colors ${
                        activePart === slot ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted/50"
                      }`}
                    >
                      <span className="block text-[10px] text-muted-foreground">Part {index + 1}</span>
                      <span className="block truncate text-xs font-medium">{LUTHIERY_PART_LABELS[slot]}</span>
                      <span className="mt-1 block truncate text-[10px] text-muted-foreground">{selected?.label ?? "Choose"}</span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-md border border-border/60 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{LUTHIERY_PART_LABELS[activePart]}</p>
                    <p className="text-xs text-muted-foreground">Choose the material/component used for this part.</p>
                  </div>
                  <Badge variant="secondary">Part {LUTHIERY_PART_ORDER.indexOf(activePart) + 1} / 5</Badge>
                </div>

                <div className="grid gap-2">
                  {LUTHIERY_MATERIAL_OPTIONS.filter((option) => option.slot === activePart).map((option) => {
                    const unlocked = isLuthieryRequirementMet(option.requirement, progress);
                    const material = resolveCatalogMaterial(option, materialsCatalog);
                    const owned = ownedQuantity(material);
                    const selected = selection.parts[activePart] === option.id;
                    return (
                      <Button
                        variant="outline"
                        key={option.id}
                        type="button"
                        disabled={!unlocked || !material}
                        onClick={() =>
                          setSelection((current) => ({
                            ...current,
                            parts: { ...current.parts, [activePart]: option.id },
                          }))
                        }
                        className={`h-auto whitespace-normal flex items-center justify-between gap-3 rounded-md border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {!unlocked && <Lock className="h-3 w-3 shrink-0" />}
                            <span className="text-xs font-medium">{option.label}</span>
                            {material && (
                              <Badge variant="outline" className="h-5 text-[10px]">
                                Tier {material.quality_tier}
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {!material
                              ? "Material is not available in the current catalogue."
                              : !unlocked
                                ? `Unlock: ${formatLuthieryRequirement(option.requirement)}`
                                : owned > 0
                                  ? `${material.name} · ${owned} owned`
                                  : "Available to design with — buy this material before final crafting."}
                          </p>
                        </div>
                        {selected ? (
                          <PackageCheck className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <span className="shrink-0 text-[10px] text-muted-foreground">{material ? `$${material.base_cost}` : "—"}</span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={qualityTone(outcome.quality)}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Projected result
                </span>
                <Badge variant="outline">{quality.label} · {outcome.quality}%</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-background/60 p-2">
                  <p className="text-muted-foreground">Material quality</p>
                  <p className="font-semibold">{outcome.materialQuality}%</p>
                </div>
                <div className="rounded-md bg-background/60 p-2">
                  <p className="text-muted-foreground">Luthier contribution</p>
                  <p className="font-semibold">{outcome.skillScore}%</p>
                </div>
              </div>

              {STAT_LABELS.map(([key, label]) => (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span>{label}</span>
                    <span className="font-medium">{outcome.stats[key]}</span>
                  </div>
                  <Progress value={outcome.stats[key]} className="h-1.5" />
                </div>
              ))}

              <p className="rounded-md border border-border/60 bg-background/70 p-2 text-[11px] leading-relaxed text-muted-foreground">
                Preview estimate only. The final quality roll, boosts, inventory consumption and equipment creation are resolved by the server when you craft.
              </p>

              {confirmedCurrent && (
                <div className="rounded-md border border-green-500/40 bg-green-500/10 p-2 text-xs" role="status">
                  <p className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Design confirmed: {confirmedSpec?.instrumentName}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {craftedCurrent
                      ? "This exact design has been crafted and added to this character's equipment."
                      : "No materials are consumed until you press Craft instrument below."}
                  </p>
                </div>
              )}

              <Button type="button" className="w-full" variant={confirmedCurrent ? "outline" : "default"} onClick={() => setReviewOpen(true)}>
                Review build
              </Button>
              {confirmedCurrent && onCraft && (
                <Button
                  type="button"
                  className="w-full"
                  disabled={isCrafting || craftedCurrent}
                  onClick={handleCraft}
                >
                  {craftedCurrent ? "Instrument crafted" : isCrafting ? "Crafting instrument..." : "Craft instrument"}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <LuthieryBuildReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        selection={selection}
        materialsCatalog={materialsCatalog}
        playerMaterials={playerMaterials}
        progress={progress}
        onConfirm={(spec) => {
          setConfirmedSpec(spec);
          setConfirmedFingerprint(selectionFingerprint);
          setConfirmedCraftKey(createCraftRequestKey());
          setCraftedFingerprint(null);
        }}
      />
    </div>
  );
};
