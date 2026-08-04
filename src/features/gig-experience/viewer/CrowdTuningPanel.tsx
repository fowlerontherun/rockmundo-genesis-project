import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  CROWD_TUNING_PRESETS,
  CROWD_TUNING_STORAGE_KEY,
  DEFAULT_CROWD_TUNING,
  crowdTuningSignature,
  normalizeCrowdTuning,
  type CrowdTuningOptions,
  type CrowdTuningPresetKey,
} from "./engine/CrowdTuning";

export function isGigViewerDemoRoute() {
  return typeof window !== "undefined" && window.location.pathname.includes("/admin/gig-viewer-demo");
}

export function useDemoCrowdTuning() {
  const demoMode = isGigViewerDemoRoute();
  const [value, setValue] = useState<CrowdTuningOptions>(() => loadStoredTuning());

  useEffect(() => {
    if (!demoMode) return;
    try {
      window.localStorage.setItem(CROWD_TUNING_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Local persistence is a convenience only; rendering must still work.
    }
  }, [demoMode, value]);

  return { demoMode, value, setValue };
}

export function CrowdTuningPanel({
  value,
  onChange,
  attendance,
  capacity,
}: {
  value: CrowdTuningOptions;
  onChange: (value: CrowdTuningOptions) => void;
  attendance: number;
  capacity: number;
}) {
  const [copied, setCopied] = useState(false);
  const selectedPreset = useMemo(() => {
    const signature = crowdTuningSignature(value);
    const match = Object.entries(CROWD_TUNING_PRESETS).find(
      ([, preset]) => crowdTuningSignature(preset.values) === signature,
    );
    return (match?.[0] ?? "custom") as CrowdTuningPresetKey | "custom";
  }, [value]);
  const visualFans = Math.max(0, Math.ceil(attendance * value.densityMultiplier));
  const fillPercent = capacity > 0 ? Math.round((attendance / capacity) * 100) : 0;

  const update = <Key extends keyof CrowdTuningOptions>(key: Key, next: CrowdTuningOptions[Key]) => {
    onChange(normalizeCrowdTuning({ ...value, [key]: next }));
  };

  const choosePreset = (key: string) => {
    if (key === "custom") return;
    const preset = CROWD_TUNING_PRESETS[key as CrowdTuningPresetKey];
    if (preset) onChange(normalizeCrowdTuning(preset.values));
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="mb-3 space-y-4 rounded-xl border bg-background/95 p-4 shadow-sm" aria-label="Crowd packing tuning controls">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Crowd packing lab</h3>
          <p className="text-sm text-muted-foreground">
            Demo-only overrides update the canvas live. Real gig replays continue using production defaults.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{visualFans.toLocaleString()} visual fans</Badge>
          <Badge variant="outline">{fillPercent}% attendance</Badge>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_auto_auto] md:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="crowd-tuning-preset">Tuning preset</Label>
          <Select value={selectedPreset} onValueChange={choosePreset}>
            <SelectTrigger id="crowd-tuning-preset" aria-label="Crowd tuning preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectedPreset === "custom" ? <SelectItem value="custom">Custom settings</SelectItem> : null}
              {Object.entries(CROWD_TUNING_PRESETS).map(([key, preset]) => (
                <SelectItem key={key} value={key}>{preset.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {selectedPreset === "custom"
              ? "Custom values saved in this browser."
              : CROWD_TUNING_PRESETS[selectedPreset].description}
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => onChange({ ...DEFAULT_CROWD_TUNING })}>
          Reset defaults
        </Button>
        <Button type="button" variant="outline" onClick={copyJson}>
          {copied ? "Copied" : "Copy JSON"}
        </Button>
      </div>

      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
        <TuningSlider
          label="Visual density"
          value={value.densityMultiplier}
          min={0.5}
          max={4}
          step={0.25}
          suffix="×"
          description="How many visible fan markers represent the recorded attendance."
          onChange={(next) => update("densityMultiplier", next)}
        />
        <TuningSlider
          label="Front-to-back spread"
          value={value.depthSpread}
          min={0.45}
          max={1.5}
          step={0.05}
          suffix="×"
          description="Lower values keep the audience close to the stage; higher values use more venue depth."
          onChange={(next) => update("depthSpread", next)}
        />
        <TuningSlider
          label="Side-to-side spread"
          value={value.lateralSpread}
          min={0.45}
          max={1.5}
          step={0.05}
          suffix="×"
          description="Lower values favour the centre; higher values push fans toward the venue sides."
          onChange={(next) => update("lateralSpread", next)}
        />
        <TuningSlider
          label="Stage pull"
          value={value.stagePull}
          min={0}
          max={1}
          step={0.05}
          description="Pulls all occupied packing cells toward the stage edge without crossing the barrier."
          onChange={(next) => update("stagePull", next)}
        />
        <TuningSlider
          label="Position randomness"
          value={value.randomness}
          min={0}
          max={0.8}
          step={0.05}
          description="Adds deterministic variation so rows look less uniform while remaining replay-safe."
          onChange={(next) => update("randomness", next)}
        />
        <TuningSlider
          label="Fan marker size"
          value={value.fanScale}
          min={0.6}
          max={1.6}
          step={0.05}
          suffix="×"
          description="Changes the rendered fan size without changing attendance or crowd behaviour."
          onChange={(next) => update("fanScale", next)}
        />
        <TuningSlider
          label="Arrival speed"
          value={value.arrivalSpeed}
          min={0.5}
          max={2}
          step={0.05}
          suffix="×"
          description="Controls how quickly fans travel from entrances to their assigned packing cells."
          onChange={(next) => update("arrivalSpeed", next)}
        />
      </div>
    </section>
  );
}

function TuningSlider({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  description,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  description: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <Badge variant="outline" className="tabular-nums">{formatValue(value)}{suffix}</Badge>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onChange(next)}
        aria-label={label}
      />
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function loadStoredTuning(): CrowdTuningOptions {
  if (typeof window === "undefined") return { ...DEFAULT_CROWD_TUNING };
  try {
    const stored = window.localStorage.getItem(CROWD_TUNING_STORAGE_KEY);
    return stored ? normalizeCrowdTuning(JSON.parse(stored)) : { ...DEFAULT_CROWD_TUNING };
  } catch {
    return { ...DEFAULT_CROWD_TUNING };
  }
}

function formatValue(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0$/, "");
}
