import { useMemo } from "react";
import type { CharacterSprite, CharacterConfig } from "@/hooks/useCharacterSprites";
import { SKIN_TONES } from "@/hooks/useCharacterSprites";

// Import local sprite assets
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

// Map database asset names to imported images
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

// Resolve asset URL - use imported image if available, otherwise use URL directly
const resolveAssetUrl = (url: string): string => {
  return ASSET_MAP[url] || url;
};

interface SpriteLayerCanvasProps {
  sprites: CharacterSprite[];
  config: CharacterConfig | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'h-32 w-24',
  md: 'h-48 w-36',
  lg: 'h-64 w-48',
  xl: 'h-96 w-72',
};

// Layer ordering for proper sprite stacking
const LAYER_ORDER = [
  'body',      // 1 - base
  'shoes',     // 1 - base level
  'trousers',  // 2
  'shirt',     // 2
  'jacket',    // 3
  'eyes',      // 4
  'nose',      // 5
  'mouth',     // 6
  'facial_hair', // 7
  'hair',      // 9 - front hair pieces
  'hat',       // 10
  'glasses',   // 10
];

export const SpriteLayerCanvas = ({ 
  sprites, 
  config, 
  className = '',
  size = 'lg' 
}: SpriteLayerCanvasProps) => {
  // Get the skin tone filter
  const skinToneFilter = useMemo(() => {
    if (!config?.selected_skin_tone) return '';
    const tone = SKIN_TONES.find(t => t.id === config.selected_skin_tone);
    return tone?.filter || '';
  }, [config?.selected_skin_tone]);

  // Build ordered layer stack
  const layers = useMemo(() => {
    if (!config || !sprites || sprites.length === 0) return [];

    const result: Array<{ sprite: CharacterSprite; zIndex: number; filter?: string }> = [];

    LAYER_ORDER.forEach((category, index) => {
      const spriteIdKey = `${category}_sprite_id` as keyof CharacterConfig;
      const spriteId = config[spriteIdKey] as string | null;
      
      if (!spriteId) return;

      const sprite = sprites.find(s => s.id === spriteId);
      if (!sprite) return;

      // Apply skin tone filter only to body sprite
      const filter = category === 'body' ? skinToneFilter : undefined;

      result.push({
        sprite,
        zIndex: sprite.layer_order || (index + 1),
        filter,
      });
    });

    // Sort by layer order
    return result.sort((a, b) => a.zIndex - b.zIndex);
  }, [config, sprites, skinToneFilter]);

  if (!config || layers.length === 0) {
    // Show placeholder silhouette with punk style
    return (
      <div className={`${sizeClasses[size]} ${className} relative bg-gradient-to-b from-muted/10 to-muted/30 rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/20`}>
        <div className="text-muted-foreground text-center p-4">
          <svg viewBox="0 0 100 180" className="w-20 h-32 mx-auto opacity-40">
            {/* Punk silhouette with mohawk */}
            <path 
              d="M50 10 L45 5 L50 0 L55 5 Z M40 15 L35 8 L40 3 L45 8 Z M60 15 L55 8 L60 3 L65 8 Z" 
              fill="currentColor" 
            />
            <circle cx="50" cy="30" r="15" fill="currentColor" />
            <rect x="35" cy="48" width="30" height="45" rx="5" fill="currentColor" />
            <rect x="30" cy="95" width="15" height="50" rx="3" fill="currentColor" />
            <rect x="55" cy="95" width="15" height="50" rx="3" fill="currentColor" />
          </svg>
          <p className="text-xs mt-2 font-medium">Select options to<br/>build your character</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} ${className} relative`}>
      {layers.map(({ sprite, zIndex, filter }) => (
        <img
          key={sprite.id}
          src={resolveAssetUrl(sprite.asset_url)}
          alt={sprite.name}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ 
            zIndex,
            filter: filter || undefined,
          }}
          draggable={false}
          onError={(e) => {
            // Hide broken images
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ))}
    </div>
  );
};

// Simplified version for gig viewer / avatars
export const CharacterAvatar = ({ 
  renderedUrl,
  fallbackSprites,
  fallbackConfig,
  className = '',
  size = 'lg',
}: {
  renderedUrl?: string | null;
  fallbackSprites?: CharacterSprite[];
  fallbackConfig?: CharacterConfig | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) => {
  // If we have a pre-rendered composite, use it
  if (renderedUrl) {
    return (
      <div className={`${sizeClasses[size]} ${className} relative`}>
        <img
          src={renderedUrl}
          alt="Character"
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>
    );
  }

  // Otherwise render layers client-side
  if (fallbackSprites && fallbackConfig) {
    return (
      <SpriteLayerCanvas 
        sprites={fallbackSprites} 
        config={fallbackConfig}
        className={className}
        size={size}
      />
    );
  }

  // No character available - show punk silhouette
  return (
    <div className={`${sizeClasses[size]} ${className} relative bg-muted/20 rounded-lg flex items-center justify-center`}>
      <svg viewBox="0 0 100 180" className="w-16 h-24 opacity-30">
        <path 
          d="M50 10 L45 5 L50 0 L55 5 Z M40 15 L35 8 L40 3 L45 8 Z M60 15 L55 8 L60 3 L65 8 Z" 
          fill="currentColor" 
        />
        <circle cx="50" cy="30" r="15" fill="currentColor" />
        <rect x="35" y="48" width="30" height="45" rx="5" fill="currentColor" />
        <rect x="30" y="95" width="15" height="50" rx="3" fill="currentColor" />
        <rect x="55" y="95" width="15" height="50" rx="3" fill="currentColor" />
      </svg>
    </div>
  );
};
