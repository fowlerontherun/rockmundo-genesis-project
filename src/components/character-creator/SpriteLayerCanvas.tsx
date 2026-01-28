import { useMemo } from "react";
import type { CharacterSprite, CharacterConfig } from "@/hooks/useCharacterSprites";
import { SKIN_TONES } from "@/hooks/useCharacterSprites";

// ============ NEW ALIGNED ASSETS (512x1024 canvas) ============
// Base Bodies
import alignedBaseMale from "@/assets/sprites/aligned-base-male.png";
import alignedBaseFemale from "@/assets/sprites/aligned-base-female.png";

// Hair
import alignedHairMohawk from "@/assets/sprites/aligned-hair-mohawk.png";
import alignedHairAfro from "@/assets/sprites/aligned-hair-afro.png";
import alignedHairEmo from "@/assets/sprites/aligned-hair-emo.png";
import alignedHairPixie from "@/assets/sprites/aligned-hair-pixie.png";

// Eyes
import alignedEyesNeutral from "@/assets/sprites/aligned-eyes-neutral.png";
import alignedEyesAngry from "@/assets/sprites/aligned-eyes-angry.png";

// Nose
import alignedNoseSmall from "@/assets/sprites/aligned-nose-small.png";

// Mouth
import alignedMouthNeutral from "@/assets/sprites/aligned-mouth-neutral.png";
import alignedMouthSmile from "@/assets/sprites/aligned-mouth-smile.png";

// Jackets/Tops
import alignedJacketLeather from "@/assets/sprites/aligned-jacket-leather.png";
import alignedJacketHoodie from "@/assets/sprites/aligned-jacket-hoodie.png";
import alignedJacketFlannel from "@/assets/sprites/aligned-jacket-flannel.png";

// Shirts
import alignedShirtBandtee from "@/assets/sprites/aligned-shirt-bandtee.png";

// Trousers/Bottoms
import alignedTrousersSkinny from "@/assets/sprites/aligned-trousers-skinny.png";
import alignedTrousersCargo from "@/assets/sprites/aligned-trousers-cargo.png";
import alignedTrousersPlaidskirt from "@/assets/sprites/aligned-trousers-plaidskirt.png";

// Shoes
import alignedShoesCombat from "@/assets/sprites/aligned-shoes-combat.png";
import alignedShoesHightops from "@/assets/sprites/aligned-shoes-hightops.png";

// Accessories
import alignedHatBeanie from "@/assets/sprites/aligned-hat-beanie.png";
import alignedGlassesAviator from "@/assets/sprites/aligned-glasses-aviator.png";
import alignedFacialhairBeard from "@/assets/sprites/aligned-facialhair-beard.png";

// Map database asset paths to imported images
const ASSET_MAP: Record<string, string> = {
  // ========== ALIGNED ASSETS (NEW SYSTEM) ==========
  // Base Bodies
  '/src/assets/sprites/aligned-base-male.png': alignedBaseMale,
  '/src/assets/sprites/aligned-base-female.png': alignedBaseFemale,
  
  // Hair
  '/src/assets/sprites/aligned-hair-mohawk.png': alignedHairMohawk,
  '/src/assets/sprites/aligned-hair-afro.png': alignedHairAfro,
  '/src/assets/sprites/aligned-hair-emo.png': alignedHairEmo,
  '/src/assets/sprites/aligned-hair-pixie.png': alignedHairPixie,
  
  // Eyes
  '/src/assets/sprites/aligned-eyes-neutral.png': alignedEyesNeutral,
  '/src/assets/sprites/aligned-eyes-angry.png': alignedEyesAngry,
  
  // Nose
  '/src/assets/sprites/aligned-nose-small.png': alignedNoseSmall,
  
  // Mouth
  '/src/assets/sprites/aligned-mouth-neutral.png': alignedMouthNeutral,
  '/src/assets/sprites/aligned-mouth-smile.png': alignedMouthSmile,
  
  // Jackets/Tops
  '/src/assets/sprites/aligned-jacket-leather.png': alignedJacketLeather,
  '/src/assets/sprites/aligned-jacket-hoodie.png': alignedJacketHoodie,
  '/src/assets/sprites/aligned-jacket-flannel.png': alignedJacketFlannel,
  
  // Shirts
  '/src/assets/sprites/aligned-shirt-bandtee.png': alignedShirtBandtee,
  
  // Trousers/Bottoms
  '/src/assets/sprites/aligned-trousers-skinny.png': alignedTrousersSkinny,
  '/src/assets/sprites/aligned-trousers-cargo.png': alignedTrousersCargo,
  '/src/assets/sprites/aligned-trousers-plaidskirt.png': alignedTrousersPlaidskirt,
  
  // Shoes
  '/src/assets/sprites/aligned-shoes-combat.png': alignedShoesCombat,
  '/src/assets/sprites/aligned-shoes-hightops.png': alignedShoesHightops,
  
  // Accessories
  '/src/assets/sprites/aligned-hat-beanie.png': alignedHatBeanie,
  '/src/assets/sprites/aligned-glasses-aviator.png': alignedGlassesAviator,
  '/src/assets/sprites/aligned-facialhair-beard.png': alignedFacialhairBeard,
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

// Layer ordering for proper sprite stacking (back to front)
const LAYER_ORDER = [
  'body',        // 0 - base body
  'shoes',       // 1 - shoes at feet
  'trousers',    // 2 - pants/skirt
  'shirt',       // 3 - shirt layer
  'jacket',      // 4 - outer layer
  'eyes',        // 5 - facial features
  'nose',        // 6
  'mouth',       // 7
  'facial_hair', // 8
  'hair',        // 9 - hair on top
  'hat',         // 10 - accessories on top
  'glasses',     // 11
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
        zIndex: index,
        filter,
      });
    });

    return result;
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
