import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Sprite } from "three";
import { useEffectTextures } from "@/hooks/useStageTextures";

interface StageFogProps {
  intensity?: number; // 0-1
  color?: string;
  count?: number;
}

export const StageFog = ({ 
  intensity = 0.5, 
  color = "#ccccff",
  count = 8
}: StageFogProps) => {
  const textures = useEffectTextures();
  const fogSprites = useRef<Sprite[]>([]);

  // Don't render until textures are loaded
  if (!textures.fog) return null;

  const fogPositions = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      x: (Math.random() - 0.5) * 20,
      y: Math.random() * 2,
      z: Math.random() * 20 - 10,
      speed: 0.1 + Math.random() * 0.2,
      scale: 2 + Math.random() * 3,
      offset: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    fogSprites.current.forEach((sprite, i) => {
      if (!sprite) return;
      const fog = fogPositions[i];
      
      // Drift movement
      sprite.position.x = fog.x + Math.sin(time * fog.speed + fog.offset) * 2;
      sprite.position.y = fog.y + Math.sin(time * fog.speed * 0.5 + fog.offset) * 0.5;
      sprite.position.z = fog.z + Math.cos(time * fog.speed + fog.offset) * 2;
      
      // Pulsing opacity
      const opacity = intensity * (0.3 + Math.sin(time * 0.5 + fog.offset) * 0.2);
      if (sprite.material) {
        // @ts-ignore
        sprite.material.opacity = opacity;
      }
    });
  });

  return (
    <group>
      {fogPositions.map((fog, i) => (
        <sprite 
          key={i} 
          ref={(el) => {
            if (el) fogSprites.current[i] = el;
          }}
          position={[fog.x, fog.y, fog.z]}
          scale={[fog.scale, fog.scale, 1]}
        >
          <spriteMaterial 
            map={textures.fog}
            transparent
            opacity={intensity * 0.4}
            color={color}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
};
