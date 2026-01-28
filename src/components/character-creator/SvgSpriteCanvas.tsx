import { useMemo, type FC } from "react";
import type { CharacterConfig } from "@/hooks/useCharacterSprites";
import { SKIN_TONES } from "@/hooks/useCharacterSprites";

// Import all SVG sprite components
import { BaseMaleSvg, BaseFemaleSvg } from "./svg-sprites";
import { SkinnyJeansSvg, CombatBootsSvg, BandTeeSvg, LeatherJacketSvg, HoodieSvg } from "./svg-sprites";
import { MohawkHairSvg, AfroHairSvg, EmoHairSvg, PixieHairSvg } from "./svg-sprites";
import { NeutralEyesSvg, AngryEyesSvg, SmallNoseSvg, NeutralMouthSvg, SmileMouthSvg, BeardSvg } from "./svg-sprites";
import { BeanieSvg, AviatorGlassesSvg, HighTopsSvg, CargoShortsSvg } from "./svg-sprites";

// Mapping from sprite IDs to SVG components
const SVG_COMPONENT_MAP: Record<string, FC> = {
  // Bodies
  'base-male': BaseMaleSvg,
  'base-female': BaseFemaleSvg,
  
  // Hair
  'hair-mohawk': MohawkHairSvg,
  'hair-afro': AfroHairSvg,
  'hair-emo': EmoHairSvg,
  'hair-pixie': PixieHairSvg,
  
  // Eyes
  'eyes-neutral': NeutralEyesSvg,
  'eyes-angry': AngryEyesSvg,
  
  // Nose
  'nose-small': SmallNoseSvg,
  
  // Mouth
  'mouth-neutral': NeutralMouthSvg,
  'mouth-smile': SmileMouthSvg,
  
  // Facial Hair
  'beard': BeardSvg,
  
  // Clothing
  'trousers-skinny': SkinnyJeansSvg,
  'trousers-cargo': CargoShortsSvg,
  'shoes-combat': CombatBootsSvg,
  'shoes-hightops': HighTopsSvg,
  'shirt-bandtee': BandTeeSvg,
  'jacket-leather': LeatherJacketSvg,
  'jacket-hoodie': HoodieSvg,
  
  // Accessories
  'hat-beanie': BeanieSvg,
  'glasses-aviator': AviatorGlassesSvg,
};

// Layer ordering (back to front)
const LAYER_ORDER = [
  'body',        // 0
  'shoes',       // 1
  'trousers',    // 2
  'shirt',       // 3
  'jacket',      // 4
  'eyes',        // 5
  'nose',        // 6
  'mouth',       // 7
  'facial_hair', // 8
  'hair',        // 9
  'hat',         // 10
  'glasses',     // 11
];

interface SvgSpriteCanvasProps {
  config: {
    gender: 'male' | 'female';
    body?: string;
    hair?: string;
    eyes?: string;
    nose?: string;
    mouth?: string;
    facial_hair?: string;
    shirt?: string;
    jacket?: string;
    trousers?: string;
    shoes?: string;
    hat?: string;
    glasses?: string;
    skinTone?: string;
  };
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: 'h-32 w-24',
  md: 'h-48 w-36',
  lg: 'h-64 w-48',
  xl: 'h-96 w-72',
};

// Map skin tone to CSS hue-rotate value
const getSkinToneStyle = (toneId?: string) => {
  const tone = SKIN_TONES.find(t => t.id === toneId);
  return tone?.filter || '';
};

export const SvgSpriteCanvas = ({ 
  config, 
  className = '',
  size = 'lg' 
}: SvgSpriteCanvasProps) => {
  // Build the layers based on config
  const layers = useMemo(() => {
    const result: Array<{ key: string; Component: FC; zIndex: number; filter?: string }> = [];
    
    // Body layer with skin tone
    const bodyKey = config.gender === 'female' ? 'base-female' : 'base-male';
    const BodyComponent = SVG_COMPONENT_MAP[bodyKey];
    if (BodyComponent) {
      result.push({
        key: 'body',
        Component: BodyComponent,
        zIndex: 0,
        filter: getSkinToneStyle(config.skinTone),
      });
    }
    
    // Add other layers
    const layerConfigs: Array<{ category: string; value?: string }> = [
      { category: 'shoes', value: config.shoes },
      { category: 'trousers', value: config.trousers },
      { category: 'shirt', value: config.shirt },
      { category: 'jacket', value: config.jacket },
      { category: 'eyes', value: config.eyes },
      { category: 'nose', value: config.nose },
      { category: 'mouth', value: config.mouth },
      { category: 'facial_hair', value: config.facial_hair },
      { category: 'hair', value: config.hair },
      { category: 'hat', value: config.hat },
      { category: 'glasses', value: config.glasses },
    ];
    
    layerConfigs.forEach(({ category, value }) => {
      if (!value) return;
      
      const Component = SVG_COMPONENT_MAP[value];
      if (!Component) return;
      
      const zIndex = LAYER_ORDER.indexOf(category);
      result.push({
        key: category,
        Component,
        zIndex: zIndex >= 0 ? zIndex : 5,
      });
    });
    
    return result.sort((a, b) => a.zIndex - b.zIndex);
  }, [config]);

  if (layers.length === 0) {
    return (
      <div className={`${sizeClasses[size]} ${className} relative bg-gradient-to-b from-muted/10 to-muted/30 rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/20`}>
        <div className="text-muted-foreground text-center p-4">
          <p className="text-xs font-medium">Select options to<br/>build your character</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${sizeClasses[size]} ${className} relative`}
      style={{ aspectRatio: '1 / 2' }}
    >
      {layers.map(({ key, Component, zIndex, filter }) => (
        <div
          key={key}
          className="absolute inset-0 w-full h-full"
          style={{ 
            zIndex,
            filter: filter || undefined,
          }}
        >
          <Component />
        </div>
      ))}
    </div>
  );
};

export default SvgSpriteCanvas;
