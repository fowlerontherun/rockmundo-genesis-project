import { useState } from "react";
import { Check, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { CharacterSprite, SpriteCategory } from "@/hooks/useCharacterSprites";

// Import local sprite assets for mapping
import bodyMaleSlim from "@/assets/sprites/body-male-slim.png";
import bodyFemaleSlim from "@/assets/sprites/body-female-slim.png";
import hairMohawkRed from "@/assets/sprites/hair-mohawk-red.png";
import hairMessyBlack from "@/assets/sprites/hair-messy-black.png";
import eyesAngry from "@/assets/sprites/eyes-angry.png";
import eyesNeutral from "@/assets/sprites/eyes-neutral.png";
import noseMedium from "@/assets/sprites/nose-medium.png";
import mouthSneer from "@/assets/sprites/mouth-sneer.png";
import mouthNeutral from "@/assets/sprites/mouth-neutral.png";
import jacketLeather from "@/assets/sprites/jacket-leather-black.png";
import shirtBandTee from "@/assets/sprites/shirt-band-tee-black.png";
import trousersPlaid from "@/assets/sprites/trousers-plaid-red.png";
import shoesCombatBoots from "@/assets/sprites/shoes-combat-boots.png";

// Map database asset paths to imported images
const ASSET_MAP: Record<string, string> = {
  '/src/assets/sprites/body-male-slim.png': bodyMaleSlim,
  '/src/assets/sprites/body-female-slim.png': bodyFemaleSlim,
  '/src/assets/sprites/hair-mohawk-red.png': hairMohawkRed,
  '/src/assets/sprites/hair-messy-black.png': hairMessyBlack,
  '/src/assets/sprites/eyes-angry.png': eyesAngry,
  '/src/assets/sprites/eyes-neutral.png': eyesNeutral,
  '/src/assets/sprites/nose-medium.png': noseMedium,
  '/src/assets/sprites/mouth-sneer.png': mouthSneer,
  '/src/assets/sprites/mouth-neutral.png': mouthNeutral,
  '/src/assets/sprites/jacket-leather-black.png': jacketLeather,
  '/src/assets/sprites/shirt-band-tee-black.png': shirtBandTee,
  '/src/assets/sprites/trousers-plaid-red.png': trousersPlaid,
  '/src/assets/sprites/shoes-combat-boots.png': shoesCombatBoots,
};

const resolveAssetUrl = (url: string): string => ASSET_MAP[url] || url;

interface SpriteCategoryPickerProps {
  category: SpriteCategory;
  sprites: CharacterSprite[];
  selectedSpriteId: string | null;
  onSelect: (spriteId: string | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
}

export const SpriteCategoryPicker = ({
  category,
  sprites,
  selectedSpriteId,
  onSelect,
  allowNone = true,
  noneLabel = 'None',
}: SpriteCategoryPickerProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const categoryLabels: Record<SpriteCategory, string> = {
    body: 'Body Type',
    eyes: 'Eyes',
    nose: 'Nose',
    mouth: 'Mouth',
    hair: 'Hair Style',
    jacket: 'Jacket',
    shirt: 'Shirt',
    trousers: 'Trousers',
    shoes: 'Shoes',
    hat: 'Hat',
    glasses: 'Glasses',
    facial_hair: 'Facial Hair',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{categoryLabels[category]}</h3>
        {selectedSpriteId && allowNone && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onSelect(null)}
            className="h-6 px-2 text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
      
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {/* None option for optional categories */}
          {allowNone && category !== 'body' && (
            <button
              onClick={() => onSelect(null)}
              className={cn(
                "flex-shrink-0 w-16 h-16 rounded-lg border-2 transition-all",
                "flex items-center justify-center text-xs text-muted-foreground",
                "hover:border-primary/50 hover:bg-muted/50",
                selectedSpriteId === null 
                  ? "border-primary bg-primary/10" 
                  : "border-border bg-card"
              )}
            >
              {selectedSpriteId === null && (
                <Check className="h-4 w-4 text-primary" />
              )}
              {selectedSpriteId !== null && noneLabel}
            </button>
          )}
          
          {sprites.map((sprite) => (
            <button
              key={sprite.id}
              onClick={() => onSelect(sprite.id)}
              onMouseEnter={() => setHoveredId(sprite.id)}
              onMouseLeave={() => setHoveredId(null)}
              disabled={sprite.is_premium}
              className={cn(
                "relative flex-shrink-0 w-16 h-16 rounded-lg border-2 transition-all overflow-hidden",
                "hover:border-primary/50 hover:scale-105",
                selectedSpriteId === sprite.id 
                  ? "border-primary ring-2 ring-primary/30" 
                  : "border-border",
                sprite.is_premium && "opacity-60 cursor-not-allowed"
              )}
            >
              {/* Sprite preview */}
              <img
                src={resolveAssetUrl(sprite.asset_url)}
                alt={sprite.name}
                className="w-full h-full object-contain bg-muted/20"
                onError={(e) => {
                  // Show placeholder on error
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
              
              {/* Selected indicator */}
              {selectedSpriteId === sprite.id && (
                <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
              
              {/* Premium lock */}
              {sprite.is_premium && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Lock className="h-4 w-4 text-white" />
                </div>
              )}
              
              {/* Hover tooltip */}
              {hoveredId === sprite.id && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-popover border rounded text-xs whitespace-nowrap z-50 shadow-lg">
                  {sprite.name}
                  {sprite.is_premium && sprite.price > 0 && (
                    <span className="ml-1 text-muted-foreground">${sprite.price}</span>
                  )}
                </div>
              )}
            </button>
          ))}
          
          {sprites.length === 0 && (
            <div className="flex-1 h-16 flex items-center justify-center text-sm text-muted-foreground bg-muted/20 rounded-lg">
              No options available
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
