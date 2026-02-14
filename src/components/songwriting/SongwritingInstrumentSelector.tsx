import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Guitar, Mic, Piano, Drum, Music } from "lucide-react";
import { useSkillSystem } from "@/hooks/useSkillSystem";
import { SkillSystemProvider } from "@/hooks/SkillSystemProvider";
import { useMemo } from "react";

// Instrument definitions from skill tree - basic tier slugs
const SONGWRITING_INSTRUMENTS = [
  // Strings
  { slug: "instruments_basic_acoustic_guitar", label: "Acoustic Guitar", icon: "guitar" },
  { slug: "instruments_basic_electric_guitar", label: "Electric Guitar", icon: "guitar" },
  { slug: "instruments_basic_classical_guitar", label: "Classical Guitar", icon: "guitar" },
  { slug: "instruments_basic_bass_guitar", label: "Bass Guitar", icon: "guitar" },
  { slug: "instruments_basic_violin", label: "Violin", icon: "strings" },
  { slug: "instruments_basic_cello", label: "Cello", icon: "strings" },
  { slug: "instruments_basic_ukulele", label: "Ukulele", icon: "strings" },
  { slug: "instruments_basic_banjo", label: "Banjo", icon: "strings" },
  { slug: "instruments_basic_mandolin", label: "Mandolin", icon: "strings" },
  { slug: "instruments_basic_upright_bass", label: "Upright Bass", icon: "guitar" },
  // Keys
  { slug: "instruments_basic_classical_piano", label: "Piano", icon: "keys" },
  { slug: "instruments_basic_jazz_piano", label: "Jazz Piano", icon: "keys" },
  { slug: "instruments_basic_hammond_organ", label: "Hammond Organ", icon: "keys" },
  { slug: "instruments_basic_rhodes", label: "Rhodes", icon: "keys" },
  { slug: "instruments_basic_synthesizer", label: "Synthesizer", icon: "keys" },
  // Drums & Percussion
  { slug: "instruments_basic_rock_drums", label: "Rock Drums", icon: "drums" },
  { slug: "instruments_basic_jazz_drums", label: "Jazz Drums", icon: "drums" },
  { slug: "instruments_basic_percussion", label: "Percussion", icon: "drums" },
  { slug: "instruments_basic_cajon", label: "Cajon", icon: "drums" },
  // Vocals
  { slug: "instruments_basic_lead_vocals", label: "Lead Vocals", icon: "vocals" },
  { slug: "instruments_basic_backup_vocals", label: "Backup Vocals", icon: "vocals" },
  { slug: "instruments_basic_rap_vocals", label: "Rap Vocals", icon: "vocals" },
  // Winds & Brass
  { slug: "instruments_basic_saxophone", label: "Saxophone", icon: "winds" },
  { slug: "instruments_basic_trumpet", label: "Trumpet", icon: "winds" },
  { slug: "instruments_basic_trombone", label: "Trombone", icon: "winds" },
  { slug: "instruments_basic_flute", label: "Flute", icon: "winds" },
  { slug: "instruments_basic_clarinet", label: "Clarinet", icon: "winds" },
  { slug: "instruments_basic_harmonica", label: "Harmonica", icon: "winds" },
];

export { SONGWRITING_INSTRUMENTS };

const getIconForType = (iconType: string) => {
  switch (iconType) {
    case "guitar":
    case "strings":
      return <Guitar className="h-3.5 w-3.5" />;
    case "vocals":
      return <Mic className="h-3.5 w-3.5" />;
    case "keys":
      return <Piano className="h-3.5 w-3.5" />;
    case "drums":
      return <Drum className="h-3.5 w-3.5" />;
    default:
      return <Music className="h-3.5 w-3.5" />;
  }
};

interface SongwritingInstrumentSelectorProps {
  selected: string[];
  onChange: (instruments: string[]) => void;
  disabled?: boolean;
}

export const SongwritingInstrumentSelector = (props: SongwritingInstrumentSelectorProps) => {
  return (
    <SkillSystemProvider>
      <SongwritingInstrumentSelectorInner {...props} />
    </SkillSystemProvider>
  );
};

const SongwritingInstrumentSelectorInner = ({
  selected,
  onChange,
  disabled,
}: SongwritingInstrumentSelectorProps) => {
  const { progress } = useSkillSystem();

  const getSkillLevel = (slug: string): number => {
    const skill = progress?.find((s) => s.skill_slug === slug);
    return skill?.current_level ?? 0;
  };

  const toggleInstrument = (slug: string) => {
    if (disabled) return;
    if (selected.includes(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  };

  const totalBonus = useMemo(() => {
    let bonus = 0;
    selected.forEach((slug, i) => {
      const level = getSkillLevel(slug);
      if (i < 4) {
        bonus += Math.min(30, level * 1.5);
      } else {
        bonus += Math.min(15, level * 0.75);
      }
    });
    return Math.round(bonus);
  }, [selected, progress]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Guitar className="h-4 w-4 text-primary" />
          Featured Instruments
        </Label>
        {selected.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            +{totalBonus} quality bonus
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Select instruments featured in this song. Higher skill levels = better quality.
      </p>
      <ScrollArea className="h-[200px] rounded-md border p-2">
        <div className="grid grid-cols-2 gap-1.5">
          {SONGWRITING_INSTRUMENTS.map((instrument) => {
            const isSelected = selected.includes(instrument.slug);
            const level = getSkillLevel(instrument.slug);
            return (
              <button
                key={instrument.slug}
                type="button"
                disabled={disabled}
                onClick={() => toggleInstrument(instrument.slug)}
                className={`flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors ${
                  isSelected
                    ? "bg-primary/10 border border-primary/30 text-foreground"
                    : "border border-transparent hover:bg-muted/50 text-muted-foreground"
                } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {getIconForType(instrument.icon)}
                <span className="flex-1 truncate text-xs">{instrument.label}</span>
                <Badge variant={level > 0 ? "default" : "outline"} className="text-[10px] px-1 py-0 h-4">
                  Lv.{level}
                </Badge>
              </button>
            );
          })}
        </div>
      </ScrollArea>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((slug) => {
            const inst = SONGWRITING_INSTRUMENTS.find((i) => i.slug === slug);
            return (
              <Badge
                key={slug}
                variant="secondary"
                className="text-xs cursor-pointer hover:bg-destructive/20"
                onClick={() => !disabled && toggleInstrument(slug)}
              >
                {inst?.label ?? slug} ×
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
};
