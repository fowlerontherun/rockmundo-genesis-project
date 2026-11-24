import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SongSoundProfile } from "../../../supabase/functions/_shared/songSoundPrompt";

type SoundField = Exclude<keyof SongSoundProfile, "bpm">;

const OPTIONS: { field: SoundField; label: string; values: { value: string; label: string }[] }[] = [
  { field: "energy", label: "Song energy", values: [
    { value: "mellow", label: "Mellow and relaxed" },
    { value: "building", label: "Build to a big chorus" },
    { value: "high", label: "High energy throughout" },
  ] },
  { field: "vocal_style", label: "Vocal delivery", values: [
    { value: "raw", label: "Raw and melodic" },
    { value: "smooth", label: "Smooth and gentle" },
    { value: "aggressive", label: "Aggressive" },
    { value: "intimate", label: "Intimate and breathy" },
  ] },
  { field: "guitar_tone", label: "Guitar sound", values: [
    { value: "jangly", label: "Jangly and clean" },
    { value: "crunchy", label: "Crunchy rhythm" },
    { value: "distorted", label: "Heavy distortion" },
    { value: "fingerstyle", label: "Acoustic fingerstyle" },
    { value: "none", label: "No featured guitar" },
  ] },
  { field: "production_style", label: "Production sound", values: [
    { value: "live", label: "Live studio" },
    { value: "modern", label: "Polished modern" },
    { value: "vintage", label: "Vintage analogue" },
    { value: "lofi", label: "Lo-fi bedroom" },
  ] },
  { field: "arrangement", label: "Song arrangement", values: [
    { value: "standard", label: "Verse / chorus / bridge" },
    { value: "anthem", label: "Big singalong chorus" },
    { value: "dynamic", label: "Building finale" },
    { value: "solo", label: "Instrumental solo" },
  ] },
];

const MUSICAL_KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];

interface Props {
  value: SongSoundProfile;
  onChange: (next: SongSoundProfile) => void;
}

export function SongSoundDesignFields({ value, onChange }: Props) {
  const set = (field: SoundField, next: string) => onChange({ ...value, [field]: next === "auto" ? undefined : next });

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4" data-testid="advanced-song-sound-design">
      <div>
        <h4 className="font-semibold">Define Your Sound</h4>
        <p className="text-xs text-muted-foreground">
          All settings are optional. They guide the AI recording; exact instrumental and vocal results can vary.
          Your character's writing quality is calculated separately.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sound-bpm">Tempo (BPM)</Label>
          <Input id="sound-bpm" type="number" min={60} max={200} step={1} placeholder="Let AI choose"
            value={value.bpm ?? ""}
            onChange={(event) => {
              const raw = event.target.value;
              onChange({ ...value, bpm: raw ? Math.min(200, Math.max(60, Math.round(Number(raw)))) : undefined });
            }} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sound-key">Musical key</Label>
          <Select value={value.musical_key || "auto"} onValueChange={(next) => set("musical_key", next)}>
            <SelectTrigger id="sound-key"><SelectValue placeholder="Let AI choose" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Let AI choose</SelectItem>
              {MUSICAL_KEYS.flatMap((key) => ["major", "minor"].map((mode) => (
                <SelectItem key={`${key}-${mode}`} value={`${key} ${mode}`}>{key} {mode}</SelectItem>
              )))}
            </SelectContent>
          </Select>
        </div>
        {OPTIONS.map(({ field, label, values }) => (
          <div className="space-y-2" key={field}>
            <Label htmlFor={`sound-${field}`}>{label}</Label>
            <Select value={value[field] || "auto"} onValueChange={(next) => set(field, next)}>
              <SelectTrigger id={`sound-${field}`}><SelectValue placeholder="Let AI choose" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Let AI choose</SelectItem>
                {values.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        You can leave everything on automatic or fine-tune just a few details. Instrument choices above also influence AI audio generation.
      </p>
    </div>
  );
}
