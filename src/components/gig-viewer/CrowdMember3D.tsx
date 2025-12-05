import { useMemo } from "react";
import { CanvasTexture } from "three";

interface CrowdMember3DProps {
  position: [number, number, number];
  animationType: 'idle' | 'bouncing' | 'jumping' | 'handsup' | 'headbang' | 'sway';
  colorVariant: number;
  seed: number;
  showMerch: boolean;
  merchColor: string;
  bandName?: string;
  scale?: number;
}

export const CrowdMember3D = ({
  position,
  animationType,
  colorVariant,
  seed,
  showMerch,
  merchColor,
  bandName = "BAND",
  scale = 1
}: CrowdMember3DProps) => {
  // Color palettes for different crowd members
  const shirtColors = [
    '#1a1a2e', '#0f3460', '#16213e', '#2d4059', '#533483',
    '#8b0000', '#1b4332', '#432818', '#3d2645', '#1e3a5f'
  ];

  const pantsColors = [
    '#000000', '#1a1a1a', '#2a2a2a', '#0c1618', '#1b263b'
  ];

  const skinTones = [
    '#ffdbac', '#f1c27d', '#c68642', '#8d5524', '#a67c52',
    '#c09373', '#e0ac69', '#966f33', '#6f4e37', '#3b2414'
  ];

  const shirtColor = showMerch ? merchColor : shirtColors[colorVariant % shirtColors.length];
  const pantsColor = pantsColors[Math.floor(seed * 100) % pantsColors.length];
  const skinColor = skinTones[Math.floor(seed * 50) % skinTones.length];

  // Create band logo texture for merch
  const merchTexture = useMemo(() => {
    if (!showMerch) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = 128; // Reduced from 256
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = merchColor;
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bandName.toUpperCase(), 64, 64);
    }
    
    return new CanvasTexture(canvas);
  }, [showMerch, merchColor, bandName]);

  const height = 0.5 + (seed * 0.3);
  const width = 0.15 + (seed * 0.05);

  return (
    <group position={position} scale={scale}>
      {/* Body (torso) - simplified, no shadows, basic material */}
      <mesh position={[0, 0.35, 0]}>
        <capsuleGeometry args={[width, height, 4, 8]} />
        <meshBasicMaterial color={shirtColor} map={showMerch ? merchTexture : undefined} />
      </mesh>

      {/* Head - reduced segments */}
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial color={skinColor} />
      </mesh>

      {/* Left Arm - simplified */}
      <mesh position={[-width - 0.05, 0.5, 0]} rotation={[0, 0, 0.2]}>
        <capsuleGeometry args={[0.04, 0.35, 2, 4]} />
        <meshBasicMaterial color={skinColor} />
      </mesh>

      {/* Right Arm - simplified */}
      <mesh position={[width + 0.05, 0.5, 0]} rotation={[0, 0, -0.2]}>
        <capsuleGeometry args={[0.04, 0.35, 2, 4]} />
        <meshBasicMaterial color={skinColor} />
      </mesh>

      {/* Legs - simplified */}
      <mesh position={[-0.07, 0.15, 0]}>
        <capsuleGeometry args={[0.05, 0.3, 2, 4]} />
        <meshBasicMaterial color={pantsColor} />
      </mesh>
      <mesh position={[0.07, 0.15, 0]}>
        <capsuleGeometry args={[0.05, 0.3, 2, 4]} />
        <meshBasicMaterial color={pantsColor} />
      </mesh>
    </group>
  );
};
