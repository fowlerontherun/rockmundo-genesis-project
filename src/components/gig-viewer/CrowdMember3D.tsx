import { useRef, useMemo } from "react";
import { Mesh, CanvasTexture } from "three";
import { useFrame } from "@react-three/fiber";
import { CharacterHair } from "./CharacterHair";
import { FaceFeatures } from "./FaceFeatures";

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
  const bodyRef = useRef<Mesh>(null);
  const headRef = useRef<Mesh>(null);
  const leftArmRef = useRef<Mesh>(null);
  const rightArmRef = useRef<Mesh>(null);

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

  const hairColors = [
    '#1a1a1a', '#3d2616', '#8b4513', '#daa520', '#ff8c00', '#c0c0c0'
  ];

  const hairTypes: Array<'short-spiky' | 'long-straight' | 'mohawk' | 'bald' | 'ponytail' | 'curly' | 'rocker' | 'messy'> = [
    'short-spiky', 'long-straight', 'mohawk', 'bald', 'ponytail', 'curly', 'rocker', 'messy'
  ];

  const clothingTypes = ['tshirt', 'tank', 'hoodie', 'jacket'];

  const shirtColor = showMerch ? merchColor : shirtColors[colorVariant % shirtColors.length];
  const pantsColor = pantsColors[Math.floor(seed * 100) % pantsColors.length];
  const skinColor = skinTones[Math.floor(seed * 50) % skinTones.length];
  const hairType = hairTypes[Math.floor(seed * 80) % hairTypes.length];
  const hairColor = hairColors[Math.floor(seed * 60) % hairColors.length];
  const clothingType = clothingTypes[Math.floor(seed * 40) % clothingTypes.length];

  // Create band logo texture for merch
  const merchTexture = useMemo(() => {
    if (!showMerch) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = merchColor;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bandName.toUpperCase(), 128, 128);
    }
    
    return new CanvasTexture(canvas);
  }, [showMerch, merchColor, bandName]);

  // Animation based on type
  useFrame(({ clock }) => {
    if (!bodyRef.current || !headRef.current || !leftArmRef.current || !rightArmRef.current) return;

    const time = clock.getElapsedTime() + seed * 10;

    switch (animationType) {
      case 'bouncing':
        bodyRef.current.position.y = position[1] + Math.abs(Math.sin(time * 2)) * 0.15;
        headRef.current.position.y = 0.7 + Math.abs(Math.sin(time * 2)) * 0.05;
        break;

      case 'jumping':
        const jump = Math.max(0, Math.sin(time * 3)) * 0.3;
        bodyRef.current.position.y = position[1] + jump;
        headRef.current.position.y = 0.7 + jump * 0.3;
        leftArmRef.current.rotation.z = Math.sin(time * 3) * 0.3 + 0.3;
        rightArmRef.current.rotation.z = Math.sin(time * 3) * -0.3 - 0.3;
        break;

      case 'handsup':
        leftArmRef.current.rotation.z = 2.5;
        rightArmRef.current.rotation.z = -2.5;
        bodyRef.current.position.y = position[1] + Math.sin(time * 1) * 0.05;
        break;

      case 'headbang':
        headRef.current.rotation.x = Math.sin(time * 4) * 0.4;
        bodyRef.current.rotation.x = Math.sin(time * 4) * 0.2;
        leftArmRef.current.rotation.z = 0.5;
        rightArmRef.current.rotation.z = -0.5;
        break;

      case 'sway':
        bodyRef.current.rotation.z = Math.sin(time * 0.8) * 0.1;
        headRef.current.rotation.z = Math.sin(time * 0.8) * 0.05;
        leftArmRef.current.rotation.z = Math.sin(time * 0.8) * 0.2 + 0.2;
        rightArmRef.current.rotation.z = -Math.sin(time * 0.8) * 0.2 - 0.2;
        break;

      case 'idle':
      default:
        bodyRef.current.position.y = position[1] + Math.sin(time * 0.5) * 0.02;
        leftArmRef.current.rotation.z = 0.1;
        rightArmRef.current.rotation.z = -0.1;
        break;
    }
  });

  const height = 0.5 + (seed * 0.3); // Vary height
  const width = 0.15 + (seed * 0.05); // Vary width
  const isFemale = seed > 0.5;

  return (
    <group position={position} scale={scale}>
      {/* Body (torso) - varies by clothing type */}
      {clothingType === 'tank' ? (
        <mesh ref={bodyRef} position={[0, 0.35, 0]} castShadow>
          <capsuleGeometry args={[width, height * 0.9, 8, 16]} />
          <meshStandardMaterial color={shirtColor} map={showMerch ? merchTexture : undefined} />
        </mesh>
      ) : clothingType === 'hoodie' ? (
        <mesh ref={bodyRef} position={[0, 0.35, 0]} castShadow>
          <capsuleGeometry args={[width * 1.2, height * 1.1, 8, 16]} />
          <meshStandardMaterial color={shirtColor} map={showMerch ? merchTexture : undefined} />
        </mesh>
      ) : clothingType === 'jacket' ? (
        <>
          <mesh ref={bodyRef} position={[0, 0.35, 0]} castShadow>
            <capsuleGeometry args={[width * 1.15, height, 8, 16]} />
            <meshStandardMaterial color={shirtColor} roughness={0.3} metalness={0.2} />
          </mesh>
          {showMerch && (
            <mesh position={[0, 0.4, width * 0.5]}>
              <planeGeometry args={[width * 1.5, height * 0.6]} />
              <meshStandardMaterial map={merchTexture} transparent />
            </mesh>
          )}
        </>
      ) : (
        // Default t-shirt
        <>
          <mesh ref={bodyRef} position={[0, 0.35, 0]} castShadow>
            <capsuleGeometry args={[width, height, 8, 16]} />
            <meshStandardMaterial color={shirtColor} />
          </mesh>
          {showMerch && (
            <mesh position={[0, 0.4, width * 0.5]}>
              <planeGeometry args={[width * 1.8, height * 0.7]} />
              <meshStandardMaterial map={merchTexture} transparent />
            </mesh>
          )}
        </>
      )}

      {/* Head */}
      <mesh ref={headRef} position={[0, 0.7, 0]} castShadow>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Face */}
      <group position={[0, 0.7, 0]}>
        <FaceFeatures skinColor={skinColor} />
      </group>

      {/* Hair */}
      <group position={[0, 0.7, 0]}>
        <CharacterHair hairType={hairType} color={hairColor} />
      </group>

      {/* Left Arm */}
      <mesh ref={leftArmRef} position={[-width - 0.05, 0.5, 0]} rotation={[0, 0, 0.2]} castShadow>
        <capsuleGeometry args={[0.04, 0.35, 4, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Right Arm */}
      <mesh ref={rightArmRef} position={[width + 0.05, 0.5, 0]} rotation={[0, 0, -0.2]} castShadow>
        <capsuleGeometry args={[0.04, 0.35, 4, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.07, 0.15, 0]} castShadow>
        <capsuleGeometry args={[0.05, 0.3, 4, 8]} />
        <meshStandardMaterial color={pantsColor} />
      </mesh>
      <mesh position={[0.07, 0.15, 0]} castShadow>
        <capsuleGeometry args={[0.05, 0.3, 4, 8]} />
        <meshStandardMaterial color={pantsColor} />
      </mesh>
    </group>
  );
};
