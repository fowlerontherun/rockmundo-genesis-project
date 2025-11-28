import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sprite, SpriteMaterial, Texture } from "three";
import { useCrowdTextures } from "@/hooks/useStageTextures";

interface CrowdSpriteProps {
  position: [number, number, number];
  mood: number; // 0-100
  wearsMerch: boolean;
  merchColor?: string;
  seed: number;
}

type AnimationType = 'tired' | 'bored' | 'bouncing' | 'jumping' | 'handsUp' | 'ecstatic';

export const CrowdSprite = ({ 
  position, 
  mood, 
  wearsMerch, 
  merchColor = "#ff0000",
  seed 
}: CrowdSpriteProps) => {
  const spriteRef = useRef<Sprite>(null);
  const textures = useCrowdTextures();

  const getAnimationType = (mood: number): AnimationType => {
    if (mood < 20) return 'tired';
    if (mood < 40) return 'bored';
    if (mood < 60) return 'bouncing';
    if (mood < 75) return 'jumping';
    if (mood < 90) return 'handsUp';
    return 'ecstatic';
  };

  const getCurrentTexture = (animType: AnimationType): Texture => {
    switch (animType) {
      case 'tired':
      case 'bored':
        return textures.standing;
      case 'bouncing':
        return textures.bouncing;
      case 'jumping':
        return textures.jumping;
      case 'handsUp':
        return textures.armsUp;
      case 'ecstatic':
        return Math.random() > 0.5 ? textures.jumping : textures.armsUp;
    }
  };

  const animType = useMemo(() => getAnimationType(mood), [mood]);
  const texture = useMemo(() => getCurrentTexture(animType), [animType, textures]);

  useFrame(({ clock }) => {
    if (!spriteRef.current) return;

    const time = clock.getElapsedTime();
    const offset = seed * Math.PI * 2;

    let y = position[1];
    let scale = 1.2;

    switch (animType) {
      case 'tired':
        y += Math.sin(time * 0.5 + offset) * 0.05;
        scale = 1.0;
        break;
      case 'bored':
        y += Math.sin(time * 0.8 + offset) * 0.08;
        break;
      case 'bouncing':
        y += Math.abs(Math.sin(time * 2 + offset)) * 0.2;
        break;
      case 'jumping':
        y += Math.abs(Math.sin(time * 3 + offset)) * 0.4;
        scale = 1.0 + Math.sin(time * 3 + offset) * 0.1;
        break;
      case 'handsUp':
        y += Math.sin(time * 2.5 + offset) * 0.3;
        scale = 1.3;
        break;
      case 'ecstatic':
        y += Math.abs(Math.sin(time * 4 + offset)) * 0.5;
        scale = 1.2 + Math.sin(time * 4 + offset) * 0.15;
        break;
    }

    spriteRef.current.position.y = y;
    spriteRef.current.scale.setScalar(scale);
  });

  return (
    <sprite ref={spriteRef} position={position}>
      <spriteMaterial 
        map={texture} 
        transparent
        opacity={0.9}
        color={wearsMerch ? merchColor : "#ffffff"}
      />
    </sprite>
  );
};
