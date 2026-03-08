import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BODY_SLOTS, CATEGORY_LABELS, type TattooDesign } from "@/data/tattooDesigns";

interface TattooDesignCardProps {
  design: TattooDesign;
  parlourPriceMultiplier?: number;
  onSelect?: (design: TattooDesign) => void;
  selected?: boolean;
}

export const TattooDesignCard = ({ design, parlourPriceMultiplier = 1.0, onSelect, selected }: TattooDesignCardProps) => {
  const price = Math.round(design.base_price * parlourPriceMultiplier);
  const slotLabel = BODY_SLOTS[design.body_slot]?.label || design.body_slot;
  
  // Get top genre effects
  const effects = Object.entries(design.genre_affinity)
    .filter(([_, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 4);

  return (
    <Card 
      className={`cursor-pointer transition-all hover:scale-[1.02] ${selected ? 'ring-2 ring-primary' : ''}`}
      onClick={() => onSelect?.(design)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Design preview circle */}
        <div className="w-full aspect-square rounded-lg flex items-center justify-center relative overflow-hidden bg-muted/50">
          <div 
            className="w-3/4 h-3/4 rounded-full border-2"
            style={{ 
              borderColor: design.ink_color_primary,
              background: `radial-gradient(circle, ${design.ink_color_secondary || design.ink_color_primary}22, ${design.ink_color_primary}44)`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold opacity-60"
            style={{ color: design.ink_color_primary }}>
            {CATEGORY_LABELS[design.category]?.split(' ')[0]}
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold text-sm">{design.name}</h4>
          <p className="text-xs text-muted-foreground">{design.description}</p>
        </div>

        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">{slotLabel}</Badge>
          <span className="text-sm font-bold text-primary">${price}</span>
        </div>

        {/* Genre effects */}
        <div className="flex flex-wrap gap-1">
          {effects.map(([genre, value]) => (
            <Badge 
              key={genre} 
              variant="secondary"
              className={`text-[10px] ${value > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
            >
              {genre}: {value > 0 ? '+' : ''}{Math.round(value * 100)}%
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
