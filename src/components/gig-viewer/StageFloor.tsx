import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";
import { useStageTextures } from "@/hooks/useStageTextures";

interface StageFloorProps {
  floorType?: string;
  backdropType?: string;
}

export const StageFloor = ({ floorType = 'wood', backdropType = 'curtain-black' }: StageFloorProps) => {
  const floorRef = useRef<Mesh>(null);
  const { floorTexture, backdropTexture } = useStageTextures(floorType, backdropType);

  // Don't render until textures are loaded
  if (!floorTexture || !backdropTexture) {
    return (
      <>
        {/* Fallback floor without textures */}
        <mesh position={[0, 0, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial 
            color="#1a0033"
            emissive="#1a0033"
            emissiveIntensity={0.1}
            roughness={0.8}
            metalness={0.2}
          />
        </mesh>
        
        <mesh position={[0, 0.05, -5]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[12, 6]} />
          <meshStandardMaterial 
            color="#330066"
            emissive="#330066"
            emissiveIntensity={0.15}
            roughness={0.6}
            metalness={0.4}
          />
        </mesh>
        
        <mesh position={[0, 4, -8]} receiveShadow>
          <planeGeometry args={[14, 8]} />
          <meshStandardMaterial 
            color="#000000"
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>
      </>
    );
  }

  // Subtle pulsing effect
  useFrame(({ clock }) => {
    if (!floorRef.current) return;
    
    const time = clock.getElapsedTime();
    const intensity = 0.1 + Math.sin(time * 0.5) * 0.05;
    
    // @ts-ignore - accessing material property
    if (floorRef.current.material) {
      // @ts-ignore
      floorRef.current.material.emissiveIntensity = intensity;
    }
  });

  return (
    <>
      {/* Main floor with texture */}
      <mesh ref={floorRef} position={[0, 0, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial 
          map={floorTexture}
          emissive="#1a0033"
          emissiveIntensity={0.1}
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>
      
      {/* Stage platform with texture */}
      <mesh position={[0, 0.05, -5]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial 
          map={floorTexture}
          emissive="#330066"
          emissiveIntensity={0.15}
          roughness={0.6}
          metalness={0.4}
        />
      </mesh>
      
      {/* Backdrop with texture */}
      <mesh position={[0, 4, -8]} receiveShadow>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial 
          map={backdropTexture}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
    </>
  );
};
