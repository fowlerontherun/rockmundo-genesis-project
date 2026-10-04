import { useMemo, useState } from "react";
import { Guitar, Lock, PackageCheck, Sparkles, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getQualityLabel } from "@/data/craftingMaterials";
import {
  DEFAULT_LUTHIERY_SELECTION,
  LUTHIERY_COLOURS,
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
  type LuthieryBuildSelection,
  type LuthieryInstrumentKind,
  type LuthieryPartSlot,
  type LuthieryProjectedStats,
} from "@/data/luthieryWorkbench";
import type { CraftingMaterial, PlayerCraftingMaterial } from "@/hooks/useCraftingSystem";
import { useSkillSystem } from "@/hooks/useSkillSystem";

interface LuthieryWorkbenchProps {
  materialsCatalog: CraftingMaterial[];
  playerMaterials: PlayerCraftingMaterial[];
}

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
}: LuthieryWorkbenchProps) => {
  const { progress } = useSkillSystem();
  const [selection, setSelection] = useState<LuthieryBuildSelection>(DEFAULT_LUTHIERY_SELECTION);
  const [activePart, setActivePart] = useState<LuthieryPartSlot>("body");

  const luthieryProgress = useMemo(() => getLuthieryProgress(progress), [progress]);
  const shape = useMemo(() => getShapeForSelection(selection), [selection]);
  const outcome = useMemo(
    () => calculateProjectedLuthieryOutcome(selection, materialsCatalog, progress),
    [selection, materialsCatalog, progress],
  );
  const quality = getQualityLabel(outcome.quality);

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

  const selectedFinish = getMaterialOption(selection.finishId);
  const neckLength = selection.instrumentKind === "electric_bass" ? 244 : 211;
  const fretLength = neckLength - 8;
  const pickupCount = selection.instrumentKind === "electric_bass" ? 2 : 2;
  const stringCount = selection.instrumentKind === "electric_bass" ? 4 : 6;

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
              <svg
                viewBox="0 0 440 220"
                role="img"
                aria-label={`Preview of ${shape.name} ${selection.instrumentKind === "electric_bass" ? "bass" : "guitar"}`}
                className="mx-auto h-auto w-full max-w-[680px]"
              >
                <defs>
                  <linearGradient id="luthiery-finish" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor={selection.colour} />
                    <stop
                      offset="60%"
                      stopColor={selection.colour}
                      stopOpacity={selectedFinish?.id === "finish-metalflake" ? 0.74 : 0.92}
                    />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={selectedFinish?.id === "finish-gloss" ? 0.2 : 0.06} />
                  </linearGradient>
                </defs>

                <g
                  role="button"
                  tabIndex={0}
                  aria-label="Select body"
                  onClick={() => setActivePart("body")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setActivePart("body");
                  }}
                  className="cursor-pointer"
                >
                  <path
                    d={shape.bodyPath}
                    transform="translate(12 38) scale(0.96)"
                    fill="url(#luthiery-finish)"
                    stroke={activePart === "body" ? "hsl(var(--primary))" : "hsl(var(--border))"}
                    strokeWidth={activePart === "body" ? 4 : 2}
                  />
                  {selectedFinish?.id === "finish-burst" && (
                    <path
                      d={shape.bodyPath}
                      transform="translate(12 38) scale(0.96)"
                      fill="none"
                      stroke="#24170f"
                      strokeOpacity="0.65"
                      strokeWidth="11"
                    />
                  )}
                  {selectedFinish?.id === "finish-artwork" && (
                    <path d="M52 130 C72 103 105 154 139 111" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="5" />
                  )}
                </g>

                <g
                  role="button"
                  tabIndex={0}
                  aria-label="Select neck"
                  onClick={() => setActivePart("neck")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setActivePart("neck");
                  }}
                  className="cursor-pointer"
                >
                  <rect
                    x="124"
                    y="100"
                    width={neckLength}
                    height="29"
                    rx="4"
                    fill="#b9844d"
                    stroke={activePart === "neck" ? "hsl(var(--primary))" : "hsl(var(--border))"}
                    strokeWidth={activePart === "neck" ? 4 : 2}
                  />
                  <path
                    d={`M${123 + neckLength} 97 L${157 + neckLength} 91 L${173 + neckLength} 102 L${167 + neckLength} 132 L${125 + neckLength} 132 Z`}
                    fill="#a36d39"
                    stroke="hsl(var(--border))"
                    strokeWidth="2"
                  />
                </g>

                <g
                  role="button"
                  tabIndex={0}
                  aria-label="Select fretboard"
                  onClick={() => setActivePart("fretboard")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setActivePart("fretboard");
                  }}
                  className="cursor-pointer"
                >
                  <rect
                    x="131"
                    y="104"
                    width={fretLength}
                    height="20"
                    rx="2"
                    fill="#422b22"
                    stroke={activePart === "fretboard" ? "hsl(var(--primary))" : "#5e4438"}
                    strokeWidth={activePart === "fretboard" ? 4 : 1}
                  />
                  {Array.from({ length: 13 }).map((_, index) => {
                    const x = 145 + index * (fretLength / 14);
                    return <line key={x} x1={x} y1="104" x2={x} y2="124" stroke="#b8a89a" strokeOpacity="0.7" strokeWidth="1" />;
                  })}
                </g>

                <g
                  role="button"
                  tabIndex={0}
                  aria-label="Select electronics"
                  onClick={() => setActivePart("electronics")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setActivePart("electronics");
                  }}
                  className="cursor-pointer"
                >
                  {Array.from({ length: pickupCount }).map((_, index) => (
                    <rect
                      key={index}
                      x={82 + index * 27}
                      y="108"
                      width="15"
                      height="25"
                      rx="2"
                      fill="#1d2229"
                      stroke={activePart === "electronics" ? "hsl(var(--primary))" : "#6b7280"}
                      strokeWidth={activePart === "electronics" ? 3 : 1.5}
                    />
                  ))}
                </g>

                <g
                  role="button"
                  tabIndex={0}
                  aria-label="Select hardware"
                  onClick={() => setActivePart("hardware")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setActivePart("hardware");
                  }}
                  className="cursor-pointer"
                >
                  <rect
                    x="116"
                    y="105"
                    width="10"
                    height="32"
                    rx="2"
                    fill={selection.parts.hardware === "hw-gold" ? "#cfaa4b" : "#a7adb5"}
                    stroke={activePart === "hardware" ? "hsl(var(--primary))" : "#555d68"}
                    strokeWidth={activePart === "hardware" ? 3 : 1.5}
                  />
                  <circle cx="70" cy="142" r="4" fill="#c8ccd2" />
                  <circle cx="92" cy="149" r="4" fill="#c8ccd2" />
                </g>

                {Array.from({ length: stringCount }).map((_, index) => {
                  const startY = 109 + (index * 18) / Math.max(1, stringCount - 1);
                  return (
                    <line
                      key={index}
                      x1="76"
                      y1={startY}
                      x2={292 + (selection.instrumentKind === "electric_bass" ? 31 : 0)}
                      y2={110 + (index * 10) / Math.max(1, stringCount - 1)}
                      stroke="#d8d8d8"
                      strokeOpacity="0.75"
                      strokeWidth="0.9"
                      pointerEvents="none"
                    />
                  );
                })}
              </svg>
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

            <div>
              <p className="mb-2 text-xs font-medium">Body colour</p>
              <div className="flex flex-wrap gap-2">
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
              </div>
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
                      onClick={() => setSelection((current) => ({ ...current, finishId: option.id }))}
                      className="h-auto min-h-12 flex-col items-start px-2 py-2 text-left"
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
                      <button
                        key={option.id}
                        type="button"
                        disabled={!unlocked || !material}
                        onClick={() =>
                          setSelection((current) => ({
                            ...current,
                            parts: { ...current.parts, [activePart]: option.id },
                          }))
                        }
                        className={`flex items-center justify-between gap-3 rounded-md border p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected ? "border-primary bg-primary/10" : "border-border/60 hover:bg-muted/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {!unlocked && <Lock className="h-3 w-3 shrink-0" />}
                            <span className="truncate text-xs font-medium">{option.label}</span>
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
                                  ? `${owned} in material inventory`
                                  : "Available to design with — buy this material before final crafting."}
                          </p>
                        </div>
                        {selected ? (
                          <PackageCheck className="h-4 w-4 shrink-0 text-primary" />
                        ) : (
                          <span className="shrink-0 text-[10px] text-muted-foreground">{material ? `$${material.base_cost}` : "—"}</span>
                        )}
                      </button>
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
                Preview estimate only. Phase 3 does not consume materials or mint equipment. The final confirm step will use the server-authoritative crafting transaction so quality and boosts cannot be chosen by the browser.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
