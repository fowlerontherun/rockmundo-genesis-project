import { useMemo } from "react";
import { FaceFeatures } from "./FaceFeatures";
import { CharacterHair } from "./CharacterHair";

interface SimpleCrowdMemberProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  colorVariant: number;
  seed: number;
  showMerch: boolean;
  merchColor: string;
  bandName?: string;
  scale?: number;
  showDetails?: boolean; // Only render details for front row
}

export const SimpleCrowdMember = ({
  position,
  rotation = [0, 0, 0],
  colorVariant,
  seed,
  showMerch,
  merchColor,
  bandName = "BAND",
  scale = 1,
  showDetails = false
}: SimpleCrowdMemberProps) => {
  // Simplified color palettes
  const shirtColors = ['#1a1a1a', '#2d2d2d', '#4a4a4a', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
  const pantsColors = ['#1a1a1a', '#2d2d2d', '#0066cc', '#4a4a4a'];
  const skinTones = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac'];
  const hairColors = ['#1a1a1a', '#2d2d2d', '#4a3020', '#8b4513', '#daa520', '#ff6347', '#9400d3'];

  const appearance = useMemo(() => {
    const hairTypes: Array<'short-spiky' | 'long-straight' | 'mohawk' | 'bald' | 'ponytail' | 'curly' | 'rocker' | 'messy'> = 
      ['short-spiky', 'long-straight', 'mohawk', 'bald', 'ponytail', 'curly', 'rocker', 'messy'];
    
    return {
      shirtColor: showMerch ? merchColor : shirtColors[Math.floor(seed * shirtColors.length)],
      pantsColor: pantsColors[Math.floor((seed * 7) % pantsColors.length)],
      skinColor: skinTones[Math.floor((seed * 13) % skinTones.length)],
      hairType: hairTypes[Math.floor((seed * 11) % hairTypes.length)],
      hairColor: hairColors[Math.floor((seed * 17) % hairColors.length)],
      height: 0.8 + (seed * 0.4)
    };
  }, [seed, showMerch, merchColor]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Body - simplified geometry */}
      <mesh position={[0, 0.5, 0]}>
        <capsuleGeometry args={[0.15, 0.5, 4, 8]} />
        <meshStandardMaterial color={appearance.shirtColor} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color={appearance.skinColor} />
      </mesh>

      {/* Face and Hair - only for detailed view */}
      {showDetails && (
        <>
          <FaceFeatures skinColor={appearance.skinColor} />
          <CharacterHair hairType={appearance.hairType} color={appearance.hairColor} />
        </>
      )}

      {/* Arms - simplified */}
      <mesh position={[-0.2, 0.6, 0]}>
        <capsuleGeometry args={[0.04, 0.3, 3, 6]} />
        <meshStandardMaterial color={appearance.skinColor} />
      </mesh>
      <mesh position={[0.2, 0.6, 0]}>
        <capsuleGeometry args={[0.04, 0.3, 3, 6]} />
        <meshStandardMaterial color={appearance.skinColor} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.08, 0.15, 0]}>
        <capsuleGeometry args={[0.06, 0.3, 4, 6]} />
        <meshStandardMaterial color={appearance.pantsColor} />
      </mesh>
      <mesh position={[0.08, 0.15, 0]}>
        <capsuleGeometry args={[0.06, 0.3, 4, 6]} />
        <meshStandardMaterial color={appearance.pantsColor} />
      </mesh>
    </group>
  );
};
