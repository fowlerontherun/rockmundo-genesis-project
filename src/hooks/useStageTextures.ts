import { useTexture } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

// Import all generated textures
import stageFloorWood from '@/assets/textures/floors/stage-floor-wood.png';
import stageFloorMetal from '@/assets/textures/floors/stage-floor-metal.png';
import stageFloorRubber from '@/assets/textures/floors/stage-floor-rubber.png';
import stageFloorConcrete from '@/assets/textures/floors/stage-floor-concrete.png';

import backdropCurtainRed from '@/assets/textures/backdrops/backdrop-curtain-red.png';
import backdropCurtainBlack from '@/assets/textures/backdrops/backdrop-curtain-black.png';
import backdropLedGrid from '@/assets/textures/backdrops/backdrop-led-grid.png';
import backdropBrick from '@/assets/textures/backdrops/backdrop-brick.png';

import speakerGrille from '@/assets/textures/equipment/speaker-grille.png';
import ampStack from '@/assets/textures/equipment/amp-stack.png';
import drumKit from '@/assets/textures/equipment/drum-kit.png';

import crowdStanding from '@/assets/textures/crowd/crowd-standing.png';
import crowdArmsUp from '@/assets/textures/crowd/crowd-arms-up.png';
import crowdJumping from '@/assets/textures/crowd/crowd-jumping.png';
import crowdBouncing from '@/assets/textures/crowd/crowd-bouncing.png';
import crowdPhone from '@/assets/textures/crowd/crowd-phone.png';
import crowdMoshing from '@/assets/textures/crowd/crowd-moshing.png';

import fogSprite from '@/assets/textures/effects/fog-sprite.png';
import goboPattern from '@/assets/textures/effects/gobo-pattern-1.png';
import lensFlare from '@/assets/textures/effects/lens-flare.png';
import neonGlow from '@/assets/textures/effects/neon-glow.png';

export interface TextureSet {
  floor: string;
  backdrop: string;
  equipment: {
    speaker: string;
    amp: string;
    drum: string;
  };
  crowd: {
    standing: string;
    armsUp: string;
    jumping: string;
    bouncing: string;
    phone: string;
    moshing: string;
  };
  effects: {
    fog: string;
    gobo: string;
    flare: string;
    neon: string;
  };
}

// Texture library mapping
const TEXTURE_LIBRARY = {
  floors: {
    wood: stageFloorWood,
    metal: stageFloorMetal,
    rubber: stageFloorRubber,
    concrete: stageFloorConcrete,
  },
  backdrops: {
    'curtain-red': backdropCurtainRed,
    'curtain-black': backdropCurtainBlack,
    'led-grid': backdropLedGrid,
    brick: backdropBrick,
  },
  equipment: {
    speaker: speakerGrille,
    amp: ampStack,
    drum: drumKit,
  },
  crowd: {
    standing: crowdStanding,
    armsUp: crowdArmsUp,
    jumping: crowdJumping,
    bouncing: crowdBouncing,
    phone: crowdPhone,
    moshing: crowdMoshing,
  },
  effects: {
    fog: fogSprite,
    gobo: goboPattern,
    flare: lensFlare,
    neon: neonGlow,
  },
};

export function useStageTextures(
  floorType: string = 'wood',
  backdropType: string = 'curtain-black'
) {
  // Get texture paths
  const floorPath = TEXTURE_LIBRARY.floors[floorType as keyof typeof TEXTURE_LIBRARY.floors] || TEXTURE_LIBRARY.floors.wood;
  const backdropPath = TEXTURE_LIBRARY.backdrops[backdropType as keyof typeof TEXTURE_LIBRARY.backdrops] || TEXTURE_LIBRARY.backdrops['curtain-black'];

  // Load textures
  const [floorTexture, backdropTexture] = useTexture([floorPath, backdropPath]);

  // Configure textures
  const configuredTextures = useMemo(() => {
    if (floorTexture) {
      floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
      floorTexture.repeat.set(4, 4);
    }
    if (backdropTexture) {
      backdropTexture.wrapS = backdropTexture.wrapT = THREE.RepeatWrapping;
      backdropTexture.repeat.set(2, 2);
    }
    return { floorTexture, backdropTexture };
  }, [floorTexture, backdropTexture]);

  return configuredTextures;
}

export function useCrowdTextures() {
  const textures = useTexture([
    TEXTURE_LIBRARY.crowd.standing,
    TEXTURE_LIBRARY.crowd.armsUp,
    TEXTURE_LIBRARY.crowd.jumping,
    TEXTURE_LIBRARY.crowd.bouncing,
    TEXTURE_LIBRARY.crowd.phone,
    TEXTURE_LIBRARY.crowd.moshing,
  ]);

  return {
    standing: textures[0],
    armsUp: textures[1],
    jumping: textures[2],
    bouncing: textures[3],
    phone: textures[4],
    moshing: textures[5],
  };
}

export function useEffectTextures() {
  const textures = useTexture([
    TEXTURE_LIBRARY.effects.fog,
    TEXTURE_LIBRARY.effects.gobo,
    TEXTURE_LIBRARY.effects.flare,
    TEXTURE_LIBRARY.effects.neon,
  ]);

  return {
    fog: textures[0],
    gobo: textures[1],
    flare: textures[2],
    neon: textures[3],
  };
}
