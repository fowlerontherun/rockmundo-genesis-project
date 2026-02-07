import React, { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SKILL_TREE_DEFINITIONS } from "@/data/skillTree";
import { Zap, Heart, Star, Sparkles, Music, Mic, Guitar, Trophy } from "lucide-react";

/**
 * All supported effect keys with metadata for dropdown rendering.
 * Admin selects effects from this list — no JSON editing required.
 */
export const EFFECT_DEFINITIONS = [
  // Instant stat effects
  { key: "health", label: "Health Restore", group: "Instant Stats", icon: Heart, unit: "HP", step: 5, min: -100, max: 100 },
  { key: "energy", label: "Energy Restore", group: "Instant Stats", icon: Zap, unit: "EN", step: 5, min: -100, max: 100 },
  { key: "xp", label: "XP Bonus", group: "Instant Stats", icon: Star, unit: "XP", step: 50, min: 0, max: 10000 },
  { key: "fame", label: "Fame Bonus", group: "Instant Stats", icon: Sparkles, unit: "Fame", step: 10, min: 0, max: 5000 },
  
  // Multiplier boosts (timed)
  { key: "xp_multiplier", label: "XP Multiplier", group: "Multiplier Boosts", icon: Star, unit: "x", step: 0.1, min: 1, max: 5, isFloat: true },
  { key: "fame_multiplier", label: "Fame Multiplier", group: "Multiplier Boosts", icon: Sparkles, unit: "x", step: 0.1, min: 1, max: 5, isFloat: true },
  
  // Activity boosts (next session)
  { key: "gig_quality_boost", label: "Next Gig Quality Boost", group: "Activity Boosts", icon: Guitar, unit: "%", step: 5, min: 1, max: 100, description: "Boosts crowd satisfaction & earnings for the next gig" },
  { key: "gig_earnings_boost", label: "Next Gig Earnings Boost", group: "Activity Boosts", icon: Trophy, unit: "%", step: 5, min: 1, max: 200, description: "Bonus cash earnings from the next gig" },
  { key: "recording_quality_boost", label: "Next Recording Quality Boost", group: "Activity Boosts", icon: Mic, unit: "%", step: 5, min: 1, max: 100, description: "Improves recording quality score for the next session" },
  { key: "songwriting_quality_boost", label: "Next Songwriting Quality Boost", group: "Activity Boosts", icon: Music, unit: "%", step: 5, min: 1, max: 100, description: "Boosts lyric & composition quality for the next song" },
  { key: "creativity_boost", label: "Creativity Boost", group: "Activity Boosts", icon: Sparkles, unit: "pts", step: 5, min: 1, max: 100, description: "Temporary creativity stat boost" },
  
  // Skill XP (special — needs skill_slug pairing)
  { key: "skill_xp", label: "Skill XP Amount", group: "Skill Effects", icon: Star, unit: "XP", step: 50, min: 0, max: 5000 },
] as const;

export type EffectKey = typeof EFFECT_DEFINITIONS[number]["key"];

export interface ProductEffects {
  health: number;
  energy: number;
  xp: number;
  fame: number;
  xp_multiplier: number;
  fame_multiplier: number;
  gig_quality_boost: number;
  gig_earnings_boost: number;
  recording_quality_boost: number;
  songwriting_quality_boost: number;
  creativity_boost: number;
  skill_slug: string;
  skill_xp: number;
}

export const DEFAULT_EFFECTS: ProductEffects = {
  health: 0,
  energy: 0,
  xp: 0,
  fame: 0,
  xp_multiplier: 0,
  fame_multiplier: 0,
  gig_quality_boost: 0,
  gig_earnings_boost: 0,
  recording_quality_boost: 0,
  songwriting_quality_boost: 0,
  creativity_boost: 0,
  skill_slug: "",
  skill_xp: 0,
};

/** Parse raw effects JSON from DB into typed ProductEffects */
export function parseEffects(raw: Record<string, number | string> | null | undefined): ProductEffects {
  if (!raw) return { ...DEFAULT_EFFECTS };
  return {
    health: (raw.health as number) || 0,
    energy: (raw.energy as number) || 0,
    xp: (raw.xp as number) || 0,
    fame: (raw.fame as number) || 0,
    xp_multiplier: (raw.xp_multiplier as number) || 0,
    fame_multiplier: (raw.fame_multiplier as number) || 0,
    gig_quality_boost: (raw.gig_quality_boost as number) || 0,
    gig_earnings_boost: (raw.gig_earnings_boost as number) || 0,
    recording_quality_boost: (raw.recording_quality_boost as number) || 0,
    songwriting_quality_boost: (raw.songwriting_quality_boost as number) || 0,
    creativity_boost: (raw.creativity_boost as number) || 0,
    skill_slug: (raw.skill_slug as string) || "",
    skill_xp: (raw.skill_xp as number) || 0,
  };
}

/** Convert ProductEffects back to a clean JSON object (strips zeroes) */
export function serializeEffects(effects: ProductEffects): Record<string, number | string> {
  const result: Record<string, number | string> = {};
  if (effects.health) result.health = effects.health;
  if (effects.energy) result.energy = effects.energy;
  if (effects.xp) result.xp = effects.xp;
  if (effects.fame) result.fame = effects.fame;
  if (effects.xp_multiplier) result.xp_multiplier = effects.xp_multiplier;
  if (effects.fame_multiplier) result.fame_multiplier = effects.fame_multiplier;
  if (effects.gig_quality_boost) result.gig_quality_boost = effects.gig_quality_boost;
  if (effects.gig_earnings_boost) result.gig_earnings_boost = effects.gig_earnings_boost;
  if (effects.recording_quality_boost) result.recording_quality_boost = effects.recording_quality_boost;
  if (effects.songwriting_quality_boost) result.songwriting_quality_boost = effects.songwriting_quality_boost;
  if (effects.creativity_boost) result.creativity_boost = effects.creativity_boost;
  if (effects.skill_slug && effects.skill_xp) {
    result.skill_slug = effects.skill_slug;
    result.skill_xp = effects.skill_xp;
  }
  return result;
}

/** Build a human-readable list of active effects for display */
export function getEffectLabels(effects: Record<string, number | string>): string[] {
  const labels: string[] = [];
  if (effects.health) labels.push(`${Number(effects.health) > 0 ? '+' : ''}${effects.health} HP`);
  if (effects.energy) labels.push(`${Number(effects.energy) > 0 ? '+' : ''}${effects.energy} EN`);
  if (effects.xp) labels.push(`+${effects.xp} XP`);
  if (effects.fame) labels.push(`+${effects.fame} Fame`);
  if (effects.xp_multiplier) labels.push(`${((effects.xp_multiplier as number) - 1) * 100}% XP`);
  if (effects.fame_multiplier) labels.push(`${((effects.fame_multiplier as number) - 1) * 100}% Fame`);
  if (effects.gig_quality_boost) labels.push(`+${effects.gig_quality_boost}% Gig Quality`);
  if (effects.gig_earnings_boost) labels.push(`+${effects.gig_earnings_boost}% Gig Earnings`);
  if (effects.recording_quality_boost) labels.push(`+${effects.recording_quality_boost}% Recording`);
  if (effects.songwriting_quality_boost) labels.push(`+${effects.songwriting_quality_boost}% Songwriting`);
  if (effects.creativity_boost) labels.push(`+${effects.creativity_boost} Creativity`);
  if (effects.skill_xp) labels.push(`+${effects.skill_xp} Skill XP`);
  return labels;
}

interface EffectsEditorProps {
  effects: ProductEffects;
  onChange: (effects: ProductEffects) => void;
}

/**
 * Dropdown-based effects editor for underworld admin.
 * Groups effects by category with toggle switches to enable/disable each one,
 * then shows a value input (number or slider) for enabled effects.
 */
export function UnderworldEffectsEditor({ effects, onChange }: EffectsEditorProps) {
  // Build grouped skill options from skill tree
  const skillOptions = useMemo(() => {
    const grouped: Record<string, { slug: string; name: string }[]> = {};
    SKILL_TREE_DEFINITIONS.forEach(def => {
      const category = (def.metadata?.category as string) || "Other";
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push({ slug: def.slug, name: def.display_name });
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, skills]) => ({
        category,
        skills: skills.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, []);

  const groups = useMemo(() => {
    const map: Record<string, typeof EFFECT_DEFINITIONS[number][]> = {};
    for (const def of EFFECT_DEFINITIONS) {
      if (!map[def.group]) map[def.group] = [];
      map[def.group].push(def);
    }
    return Object.entries(map);
  }, []);

  const updateEffect = (key: string, value: number) => {
    onChange({ ...effects, [key]: value });
  };

  const toggleEffect = (key: string, enabled: boolean, def: typeof EFFECT_DEFINITIONS[number]) => {
    if (enabled) {
      // Set to a sensible default
      const defaultVal = def.key === "xp_multiplier" || def.key === "fame_multiplier" ? 1.5 : def.step;
      onChange({ ...effects, [key]: defaultVal });
    } else {
      onChange({ ...effects, [key]: 0 });
    }
  };

  return (
    <div className="space-y-4">
      {groups.map(([groupName, defs]) => (
        <div key={groupName} className="space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">{groupName}</h4>
            <Separator className="flex-1" />
          </div>

          <div className="space-y-2">
            {defs.map((def) => {
              const key = def.key as keyof ProductEffects;
              const currentValue = (effects[key] as number) || 0;
              const isActive = currentValue !== 0;
              const Icon = def.icon;

              // Skill XP needs special handling for skill_slug
              if (key === "skill_xp") {
                return (
                  <div key={key} className="rounded-md border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isActive}
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              onChange({ ...effects, skill_xp: 0, skill_slug: "" });
                            } else {
                              onChange({ ...effects, skill_xp: 100 });
                            }
                          }}
                        />
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{def.label}</span>
                      </div>
                      {isActive && (
                        <Badge variant="secondary" className="text-xs">
                          +{currentValue} {def.unit}
                        </Badge>
                      )}
                    </div>
                    {isActive && (
                      <div className="grid grid-cols-2 gap-3 pl-8">
                        <div>
                          <Label className="text-xs text-muted-foreground">Skill</Label>
                          <Select
                            value={effects.skill_slug || ""}
                            onValueChange={(v) =>
                              onChange({ ...effects, skill_slug: v === "__none__" ? "" : v })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select skill..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              <SelectItem value="__none__">None</SelectItem>
                              {skillOptions.map((group) => (
                                <React.Fragment key={group.category}>
                                  <SelectItem
                                    disabled
                                    value={`__group_${group.category}`}
                                    className="font-semibold text-muted-foreground"
                                  >
                                    ── {group.category} ──
                                  </SelectItem>
                                  {group.skills.map((skill) => (
                                    <SelectItem key={skill.slug} value={skill.slug}>
                                      {skill.name}
                                    </SelectItem>
                                  ))}
                                </React.Fragment>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Amount</Label>
                          <Input
                            type="number"
                            className="h-8 text-xs"
                            value={currentValue || ""}
                            step={def.step}
                            min={def.min}
                            max={def.max}
                            onChange={(e) => updateEffect(key, parseInt(e.target.value) || 0)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div key={key} className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                  <Checkbox
                    checked={isActive}
                    onCheckedChange={(checked) => toggleEffect(key, !!checked, def)}
                  />
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{def.label}</span>
                    {"description" in def && def.description && (
                      <p className="text-[10px] text-muted-foreground truncate">{def.description}</p>
                    )}
                  </div>
                  {isActive && (
                    <Input
                      type="number"
                      className="h-8 w-24 text-xs text-right"
                      value={currentValue || ""}
                      step={def.step}
                      min={def.min}
                      max={def.max}
                      onChange={(e) => {
                        const parser = "isFloat" in def && def.isFloat ? parseFloat : parseInt;
                        updateEffect(key, parser(e.target.value) || 0);
                      }}
                    />
                  )}
                  {isActive && (
                    <span className="text-xs text-muted-foreground w-8">{def.unit}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
