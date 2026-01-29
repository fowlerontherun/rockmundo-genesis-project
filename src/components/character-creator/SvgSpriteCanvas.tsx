import { useMemo, type FC } from "react";
import type { CharacterConfig } from "@/hooks/useCharacterSprites";
import { SKIN_TONES } from "@/hooks/useCharacterSprites";

// Import all SVG sprite components
import { BaseMaleSvg, BaseFemaleSvg } from "./svg-sprites";
import { SkinnyJeansSvg, CombatBootsSvg, BandTeeSvg, LeatherJacketSvg, HoodieSvg } from "./svg-sprites";
import { MohawkHairSvg, AfroHairSvg, EmoHairSvg, PixieHairSvg } from "./svg-sprites";
import { NeutralEyesSvg, AngryEyesSvg, SmallNoseSvg, NeutralMouthSvg, SmileMouthSvg, BeardSvg } from "./svg-sprites";
import { BeanieSvg, AviatorGlassesSvg, HighTopsSvg, CargoShortsSvg } from "./svg-sprites";

// Import expanded content
import {
  LibertySpikesSvg, DreadlocksSvg, LongRockerSvg, MulletSvg, BuzzCutSvg,
  PompadourSvg, UndercutSvg, BraidsSvg, PigtailsSvg, MessyBobSvg,
  CurtainsSvg, ShaggySvg, SlickedBackSvg, CornrowsSvg, VikingSvg, BunSvg,
} from "./svg-sprites";

import {
  IntenseEyesSvg, WideEyesSvg, SleepyEyesSvg, WinkingEyesSvg,
  CatEyesSvg, SmokyEyesSvg, StarryEyesSvg,
  SingingMouthSvg, SmirkMouthSvg, PoutMouthSvg, GrinMouthSvg, ShoutingMouthSvg, KissMouthSvg,
  GoateeSvg, StubbleSvg, HandlebarSvg, SoulPatchSvg, MuttonChopsSvg,
} from "./svg-sprites";

import {
  FlannelShirtSvg, HawaiianShirtSvg, RippedTeeSvg, PoloShirtSvg,
  CropTopSvg, TankTopSvg, TurtleneckSvg, JerseySvg, TieDyeSvg, BlazerShirtSvg, MeshTopSvg,
  DenimVestSvg, VarsityJacketSvg, MilitaryJacketSvg, TrenchCoatSvg, TrackJacketSvg, CardiganSvg,
  RippedJeansSvg, LeatherPantsSvg, TrackPantsSvg, PleatedSkirtSvg, KiltSvg, BellBottomsSvg,
  CowboyBootsSvg, PlatformBootsSvg, SandalsSvg, DressShoesSvg, SneakersSvg, CreepersSvg,
} from "./svg-sprites";

import {
  FedoraSvg, CowboyHatSvg, BandanaSvg, TopHatSvg, SnapbackSvg, BeretSvg, BucketHatSvg,
  RoundLennonsSvg, CatEyeGlassesSvg, SportWrapSvg, TinyOvalsSvg, NeonShuttersSvg,
  HoopEarringsSvg, StudEarringsSvg, NoseRingSvg, LipRingSvg,
  ChainNecklaceSvg, ChokerSvg, BandannaNeckSvg, HeadphonesSvg,
} from "./svg-sprites";

// Mapping from sprite IDs to SVG components
const SVG_COMPONENT_MAP: Record<string, FC> = {
  // Bodies
  'base-male': BaseMaleSvg,
  'base-female': BaseFemaleSvg,
  
  // Hair - Original 4
  'hair-mohawk': MohawkHairSvg,
  'hair-afro': AfroHairSvg,
  'hair-emo': EmoHairSvg,
  'hair-pixie': PixieHairSvg,
  // Hair - Expanded 16
  'hair-libertyspikes': LibertySpikesSvg,
  'hair-dreadlocks': DreadlocksSvg,
  'hair-longrocker': LongRockerSvg,
  'hair-mullet': MulletSvg,
  'hair-buzzcut': BuzzCutSvg,
  'hair-pompadour': PompadourSvg,
  'hair-undercut': UndercutSvg,
  'hair-braids': BraidsSvg,
  'hair-pigtails': PigtailsSvg,
  'hair-messybob': MessyBobSvg,
  'hair-curtains': CurtainsSvg,
  'hair-shaggy': ShaggySvg,
  'hair-slickedback': SlickedBackSvg,
  'hair-cornrows': CornrowsSvg,
  'hair-viking': VikingSvg,
  'hair-bun': BunSvg,
  
  // Eyes - Original 2
  'eyes-neutral': NeutralEyesSvg,
  'eyes-angry': AngryEyesSvg,
  // Eyes - Expanded 6
  'eyes-intense': IntenseEyesSvg,
  'eyes-wide': WideEyesSvg,
  'eyes-sleepy': SleepyEyesSvg,
  'eyes-winking': WinkingEyesSvg,
  'eyes-cat': CatEyesSvg,
  'eyes-smoky': SmokyEyesSvg,
  'eyes-starry': StarryEyesSvg,
  
  // Nose
  'nose-small': SmallNoseSvg,
  
  // Mouth - Original 2
  'mouth-neutral': NeutralMouthSvg,
  'mouth-smile': SmileMouthSvg,
  // Mouth - Expanded 6
  'mouth-singing': SingingMouthSvg,
  'mouth-smirk': SmirkMouthSvg,
  'mouth-pout': PoutMouthSvg,
  'mouth-grin': GrinMouthSvg,
  'mouth-shouting': ShoutingMouthSvg,
  'mouth-kiss': KissMouthSvg,
  
  // Facial Hair - Original 1
  'beard': BeardSvg,
  // Facial Hair - Expanded 5
  'facialhair-goatee': GoateeSvg,
  'facialhair-stubble': StubbleSvg,
  'facialhair-handlebar': HandlebarSvg,
  'facialhair-soulpatch': SoulPatchSvg,
  'facialhair-muttonchops': MuttonChopsSvg,
  
  // Shirts - Original 1
  'shirt-bandtee': BandTeeSvg,
  // Shirts - Expanded 11
  'shirt-flannel': FlannelShirtSvg,
  'shirt-hawaiian': HawaiianShirtSvg,
  'shirt-rippedtee': RippedTeeSvg,
  'shirt-polo': PoloShirtSvg,
  'shirt-croptop': CropTopSvg,
  'shirt-tanktop': TankTopSvg,
  'shirt-turtleneck': TurtleneckSvg,
  'shirt-jersey': JerseySvg,
  'shirt-tiedye': TieDyeSvg,
  'shirt-blazer': BlazerShirtSvg,
  'shirt-mesh': MeshTopSvg,
  
  // Jackets - Original 2
  'jacket-leather': LeatherJacketSvg,
  'jacket-hoodie': HoodieSvg,
  // Jackets - Expanded 6
  'jacket-denimvest': DenimVestSvg,
  'jacket-varsity': VarsityJacketSvg,
  'jacket-military': MilitaryJacketSvg,
  'jacket-trench': TrenchCoatSvg,
  'jacket-track': TrackJacketSvg,
  'jacket-cardigan': CardiganSvg,
  
  // Trousers - Original 2
  'trousers-skinny': SkinnyJeansSvg,
  'trousers-cargo': CargoShortsSvg,
  // Trousers - Expanded 6
  'trousers-ripped': RippedJeansSvg,
  'trousers-leather': LeatherPantsSvg,
  'trousers-track': TrackPantsSvg,
  'trousers-pleatedskirt': PleatedSkirtSvg,
  'trousers-kilt': KiltSvg,
  'trousers-bellbottoms': BellBottomsSvg,
  
  // Shoes - Original 2
  'shoes-combat': CombatBootsSvg,
  'shoes-hightops': HighTopsSvg,
  // Shoes - Expanded 6
  'shoes-cowboy': CowboyBootsSvg,
  'shoes-platform': PlatformBootsSvg,
  'shoes-sandals': SandalsSvg,
  'shoes-dress': DressShoesSvg,
  'shoes-sneakers': SneakersSvg,
  'shoes-creepers': CreepersSvg,
  
  // Hats - Original 1
  'hat-beanie': BeanieSvg,
  // Hats - Expanded 7
  'hat-fedora': FedoraSvg,
  'hat-cowboy': CowboyHatSvg,
  'hat-bandana': BandanaSvg,
  'hat-tophat': TopHatSvg,
  'hat-snapback': SnapbackSvg,
  'hat-beret': BeretSvg,
  'hat-bucket': BucketHatSvg,
  
  // Glasses - Original 1
  'glasses-aviator': AviatorGlassesSvg,
  // Glasses - Expanded 5
  'glasses-lennon': RoundLennonsSvg,
  'glasses-cateye': CatEyeGlassesSvg,
  'glasses-sportwrap': SportWrapSvg,
  'glasses-tinyovals': TinyOvalsSvg,
  'glasses-neonshutter': NeonShuttersSvg,
  
  // Extras (piercings, jewelry)
  'extra-hoopearrings': HoopEarringsSvg,
  'extra-studearrings': StudEarringsSvg,
  'extra-nosering': NoseRingSvg,
  'extra-lipring': LipRingSvg,
  'extra-chain': ChainNecklaceSvg,
  'extra-choker': ChokerSvg,
  'extra-bandannaneck': BandannaNeckSvg,
  'extra-headphones': HeadphonesSvg,
};

// Layer ordering (back to front)
const LAYER_ORDER = [
  'body',        // 0
  'shoes',       // 1
  'trousers',    // 2
  'shirt',       // 3
  'jacket',      // 4
  'extra',       // 5 - necklaces, etc.
  'eyes',        // 6
  'nose',        // 7
  'mouth',       // 8
  'facial_hair', // 9
  'hair',        // 10
  'hat',         // 11
  'glasses',     // 12
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
    extra?: string;
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
      { category: 'extra', value: config.extra },
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
