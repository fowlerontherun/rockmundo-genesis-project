import { useStageTextures } from '@/hooks/useStageTextures';

interface StageFloorProps {
  floorType?: string;
  backdropType?: string;
}

export const StageFloor = ({ floorType = 'wood', backdropType = 'curtain-black' }: StageFloorProps) => {
  // Load textures using hook
  const { floorTexture, backdropTexture } = useStageTextures(floorType, backdropType);

  return (
    <>
      {/* Main venue floor with realistic concrete texture */}
      <mesh position={[0, 0, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial 
          map={floorTexture}
          roughness={0.95}
          metalness={0.05}
        />
      </mesh>
      
      {/* Stage platform - elevated wooden stage */}
      <mesh position={[0, 0.05, -5]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial 
          color="#0a0a0a"
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>
      
      {/* Backdrop with realistic stage backdrop texture */}
      <mesh position={[0, 4, -8]} receiveShadow>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial 
          map={backdropTexture}
          roughness={0.7}
          metalness={0.4}
          emissive="#0a1a3a"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Removed black side walls - themed environments handle their own walls */}
    </>
  );
};
