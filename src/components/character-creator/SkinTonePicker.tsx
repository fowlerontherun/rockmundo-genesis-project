import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SKIN_TONES } from "@/hooks/useCharacterSprites";

interface SkinTonePickerProps {
  selectedTone: string;
  onSelect: (toneId: string) => void;
}

// Visual preview colors for skin tone selector (approximate)
const toneColors: Record<string, string> = {
  very_light: '#ffecd2',
  light: '#f5d5b8',
  light_medium: '#e5c4a1',
  medium: '#d4a574',
  olive: '#c9a66b',
  tan: '#b5885a',
  brown: '#8d6346',
  dark_brown: '#6b4930',
  deep: '#4a3020',
};

export const SkinTonePicker = ({ selectedTone, onSelect }: SkinTonePickerProps) => {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Skin Tone</h3>
      <div className="flex gap-1.5 flex-wrap">
        {SKIN_TONES.map((tone) => (
          <button
            key={tone.id}
            onClick={() => onSelect(tone.id)}
            className={cn(
              "w-8 h-8 rounded-full border-2 transition-all relative",
              "hover:scale-110 hover:ring-2 hover:ring-primary/30",
              selectedTone === tone.id 
                ? "border-primary ring-2 ring-primary/50" 
                : "border-border/50"
            )}
            style={{ backgroundColor: toneColors[tone.id] || '#d4a574' }}
            title={tone.name}
          >
            {selectedTone === tone.id && (
              <Check 
                className={cn(
                  "absolute inset-0 m-auto h-4 w-4",
                  // Use white check on darker tones, dark check on lighter
                  ['brown', 'dark_brown', 'deep'].includes(tone.id) 
                    ? "text-white" 
                    : "text-black/70"
                )} 
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
