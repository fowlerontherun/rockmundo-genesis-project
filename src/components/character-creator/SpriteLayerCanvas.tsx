import { useMemo } from "react";
import type { CharacterSprite, CharacterConfig } from "@/hooks/useCharacterSprites";
import { SKIN_TONES } from "@/hooks/useCharacterSprites";

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
    // Show placeholder silhouette
    return (
      <div className={`${sizeClasses[size]} ${className} relative bg-muted/20 rounded-lg flex items-center justify-center`}>
        <div className="text-muted-foreground text-center p-4">
          <svg viewBox="0 0 100 150" className="w-16 h-24 mx-auto opacity-30">
            <circle cx="50" cy="25" r="18" fill="currentColor" />
            <ellipse cx="50" cy="80" rx="28" ry="40" fill="currentColor" />
          </svg>
          <p className="text-xs mt-2">No character created</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} ${className} relative`}>
      {layers.map(({ sprite, zIndex, filter }, i) => (
        <img
          key={sprite.id}
          src={sprite.asset_url}
          alt={sprite.name}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ 
            zIndex,
            filter: filter || undefined,
          }}
          draggable={false}
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

  // No character available
  return (
    <div className={`${sizeClasses[size]} ${className} relative bg-muted/20 rounded-lg flex items-center justify-center`}>
      <svg viewBox="0 0 100 150" className="w-16 h-24 opacity-30">
        <circle cx="50" cy="25" r="18" fill="currentColor" />
        <ellipse cx="50" cy="80" rx="28" ry="40" fill="currentColor" />
      </svg>
    </div>
  );
};

