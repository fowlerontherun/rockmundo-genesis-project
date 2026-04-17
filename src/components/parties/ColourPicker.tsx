import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SUGGESTED_PARTY_COLOURS } from "@/types/political-party";

interface Props {
  value: string;
  onChange: (hex: string) => void;
  usedColours?: Set<string>;
}

export function ColourPicker({ value, onChange, usedColours }: Props) {
  const isUsed = usedColours?.has(value.toLowerCase()) ?? false;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PARTY_COLOURS.map((c) => {
          const taken = usedColours?.has(c.toLowerCase());
          const selected = c.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              disabled={taken && !selected}
              onClick={() => onChange(c)}
              className={cn(
                "h-8 w-8 rounded-full border-2 transition-all",
                selected ? "border-foreground scale-110" : "border-transparent",
                taken && !selected && "opacity-30 cursor-not-allowed"
              )}
              style={{ backgroundColor: c }}
              aria-label={`Select ${c}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 h-9 p-1"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#hex"
          maxLength={7}
          className="font-mono"
        />
      </div>
      {isUsed && <p className="text-xs text-destructive">This colour is already taken by another party.</p>}
    </div>
  );
}
