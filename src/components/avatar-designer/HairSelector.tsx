import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface HairStyle {
  id: string;
  name: string;
  style_key: string;
  price: number | null;
  is_premium: boolean | null;
  rarity: string | null;
  preview_color: string | null;
}

interface HairSelectorProps {
  hairStyles: HairStyle[];
  selectedStyleId: string | null;
  selectedColor: string;
  onStyleSelect: (styleId: string) => void;
  onColorSelect: (color: string) => void;
  isItemOwned: (id: string) => boolean;
  onPurchase: (id: string, price: number) => void;
}

const hairColors = [
  { name: 'Black', value: '#1a1a1a' },
  { name: 'Dark Brown', value: '#2d1a0a' },
  { name: 'Brown', value: '#4a3728' },
  { name: 'Light Brown', value: '#8b4513' },
  { name: 'Auburn', value: '#a52a2a' },
  { name: 'Ginger', value: '#b87333' },
  { name: 'Blonde', value: '#daa520' },
  { name: 'Platinum', value: '#e6be8a' },
  { name: 'White', value: '#f5f5f5' },
  { name: 'Red', value: '#800000' },
  { name: 'Purple', value: '#4b0082' },
  { name: 'Blue', value: '#000080' },
  { name: 'Green', value: '#006400' },
  { name: 'Pink', value: '#ff69b4' },
];

export const HairSelector = ({
  hairStyles,
  selectedStyleId,
  selectedColor,
  onStyleSelect,
  onColorSelect,
  isItemOwned,
  onPurchase,
}: HairSelectorProps) => {
  const getRarityColor = (rarity: string | null) => {
    switch (rarity) {
      case 'common': return 'bg-muted text-muted-foreground';
      case 'uncommon': return 'bg-green-600/20 text-green-400';
      case 'rare': return 'bg-blue-600/20 text-blue-400';
      case 'epic': return 'bg-purple-600/20 text-purple-400';
      case 'legendary': return 'bg-yellow-600/20 text-yellow-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Hair Color Picker */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Hair Color</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="grid grid-cols-7 gap-2">
            {hairColors.map((color) => (
              <button
                key={color.value}
                onClick={() => onColorSelect(color.value)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all",
                  selectedColor === color.value
                    ? "border-primary ring-2 ring-primary/50 scale-110"
                    : "border-transparent hover:border-muted-foreground/50"
                )}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hair Styles */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Hair Style</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {hairStyles?.map((style) => {
              const isOwned = style.price === 0 || style.price === null || isItemOwned(style.id);
              const isSelected = selectedStyleId === style.style_key;

              return (
                <div
                  key={style.id}
                  className={cn(
                    "relative p-3 rounded-lg border-2 cursor-pointer transition-all",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-muted-foreground/50"
                  )}
                  onClick={() => {
                    if (isOwned) {
                      onStyleSelect(style.style_key);
                    }
                  }}
                >
                  {/* Preview Circle */}
                  <div
                    className="w-12 h-12 mx-auto rounded-full mb-2"
                    style={{ backgroundColor: style.preview_color || selectedColor }}
                  />

                  <p className="text-xs font-medium text-center truncate">{style.name}</p>

                  {style.rarity && (
                    <Badge 
                      variant="secondary" 
                      className={cn("text-[10px] mt-1 mx-auto block w-fit", getRarityColor(style.rarity))}
                    >
                      {style.rarity}
                    </Badge>
                  )}

                  {/* Ownership/Purchase Status */}
                  {isOwned ? (
                    isSelected && (
                      <div className="absolute top-1 right-1">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    )
                  ) : (
                    <div className="absolute inset-0 bg-background/80 rounded-lg flex flex-col items-center justify-center">
                      <Lock className="h-4 w-4 text-muted-foreground mb-1" />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-xs h-6 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPurchase(style.id, style.price || 0);
                        }}
                      >
                        ${style.price}
                      </Button>
                    </div>
                  )}

                  {style.is_premium && (
                    <Sparkles className="absolute top-1 left-1 h-3 w-3 text-yellow-400" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
