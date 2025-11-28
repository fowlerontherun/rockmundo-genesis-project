import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TShirtColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
}

const TSHIRT_COLORS = [
  { name: "White", value: "#ffffff", border: "#e5e5e5" },
  { name: "Black", value: "#000000", border: undefined },
  { name: "Navy", value: "#1e3a8a", border: undefined },
  { name: "Gray", value: "#6b7280", border: undefined },
  { name: "Red", value: "#dc2626", border: undefined },
  { name: "Burgundy", value: "#7f1d1d", border: undefined },
  { name: "Royal Blue", value: "#2563eb", border: undefined },
  { name: "Forest Green", value: "#15803d", border: undefined },
  { name: "Yellow", value: "#eab308", border: undefined },
  { name: "Orange", value: "#ea580c", border: undefined },
  { name: "Pink", value: "#ec4899", border: undefined },
  { name: "Purple", value: "#9333ea", border: undefined },
] as const;

export const TShirtColorPicker = ({ selectedColor, onColorChange }: TShirtColorPickerProps) => {
  return (
    <div className="space-y-3">
      <Label>T-Shirt Color</Label>
      <div className="grid grid-cols-6 gap-3">
        {TSHIRT_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => onColorChange(color.value)}
            className={cn(
              "group relative aspect-square w-full rounded-lg border-2 transition-all hover:scale-105",
              selectedColor === color.value
                ? "border-primary ring-2 ring-primary ring-offset-2"
                : "border-border hover:border-primary/50"
            )}
            title={color.name}
          >
            <div
              className="h-full w-full rounded-md"
              style={{
                backgroundColor: color.value,
                border: color.border ? `1px solid ${color.border}` : undefined,
              }}
            />
            {selectedColor === color.value && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-primary shadow-lg" />
              </div>
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Selected: <span className="font-medium">{TSHIRT_COLORS.find(c => c.value === selectedColor)?.name || "Custom"}</span>
      </p>
    </div>
  );
};
