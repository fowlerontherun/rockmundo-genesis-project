import { useRef } from "react";
import { Mesh, Group } from "three";
import { useFrame } from "@react-three/fiber";
import { CharacterHair } from "./CharacterHair";
import { FaceFeatures } from "./FaceFeatures";
import { Instruments3D } from "./Instruments3D";

// Avatar config type for player customization
interface AvatarConfig {
  skin_tone?: string;
  hair_style_key?: string;
  hair_color?: string;
  shirt_color?: string;
  pants_color?: string;
  shoes_color?: string;
  jacket_color?: string | null;
  body_type?: 'slim' | 'average' | 'muscular' | 'heavy';
  height?: number;
  gender?: string;
}

interface BandMember3DProps {
  position: [number, number, number];
  instrument: 'vocalist' | 'guitarist' | 'bassist' | 'drummer' | 'keyboardist';
  animationState: 'idle' | 'intro' | 'playing' | 'solo' | 'outro';
  intensity: number;
  seed: number;
  avatarConfig?: AvatarConfig; // Optional player avatar customization
}

// Hair type mapping for CharacterHair component
const hairStyleKeyToType: Record<string, 'short-spiky' | 'long-straight' | 'mohawk' | 'bald' | 'ponytail' | 'curly' | 'rocker' | 'messy' | 'undercut' | 'dreadlocks' | 'braids' | 'buzzcut' | 'afro' | 'slickedback' | 'topheavy'> = {
  'short-spiky': 'short-spiky',
  'long-straight': 'long-straight',
  'mohawk': 'mohawk',
  'bald': 'bald',
  'ponytail': 'ponytail',
  'curly': 'curly',
  'rocker': 'rocker',
  'messy': 'messy',
  'undercut': 'undercut',
  'dreadlocks': 'dreadlocks',
  'braids': 'braids',
  'buzzcut': 'buzzcut',
  'afro': 'afro',
  'slickedback': 'slickedback',
  'topheavy': 'topheavy',
};

export const BandMember3D = ({
  position,
  instrument,
  animationState,
  intensity,
  seed,
  avatarConfig
}: BandMember3DProps) => {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Mesh>(null);
  const headRef = useRef<Mesh>(null);
  const leftArmRef = useRef<Mesh>(null);
  const rightArmRef = useRef<Mesh>(null);
  const leftLegRef = useRef<Mesh>(null);
  const rightLegRef = useRef<Mesh>(null);

  // Default random values based on seed (fallback if no avatar config)
  const hairTypes: Array<'short-spiky' | 'long-straight' | 'mohawk' | 'bald' | 'ponytail' | 'curly' | 'rocker' | 'messy'> = [
    'rocker', 'messy', 'mohawk', 'long-straight', 'short-spiky', 'curly', 'ponytail', 'bald'
  ];
  const defaultHairType = hairTypes[Math.floor(seed * 8) % 8];
  const defaultHairColors = ['#1a1a1a', '#3d2616', '#8b4513', '#daa520', '#a52a2a', '#4a3728'];
  const defaultHairColor = defaultHairColors[Math.floor(seed * 6) % 6];
  const defaultShirtColors = ['#1a1a1a', '#2d0a0a', '#0a0a2d', '#1a0a1a', '#0a1a0a', '#2d2d2d'];
  const defaultShirtColor = defaultShirtColors[Math.floor(seed * 6) % 6];
  const defaultSkinTones = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524'];
  const defaultSkinColor = defaultSkinTones[Math.floor(seed * 5) % 5];

  // Use avatar config if provided, otherwise use random defaults
  const hairType = avatarConfig?.hair_style_key 
    ? (hairStyleKeyToType[avatarConfig.hair_style_key] || defaultHairType)
    : defaultHairType;
  const hairColor = avatarConfig?.hair_color || defaultHairColor;
  const skinColor = avatarConfig?.skin_tone || defaultSkinColor;
  const shirtColor = avatarConfig?.shirt_color || defaultShirtColor;
  const pantsColor = avatarConfig?.pants_color || '#000000';
  const shoesColor = avatarConfig?.shoes_color || '#1a1a1a';
  const hasJacket = !!avatarConfig?.jacket_color;
  const jacketColor = avatarConfig?.jacket_color || null;
  
  // Body dimensions based on body type
  const bodyType = avatarConfig?.body_type || 'average';
  const bodyDimensions = {
    slim: { width: 0.15, height: 0.5 },
    average: { width: 0.18, height: 0.55 },
    muscular: { width: 0.22, height: 0.55 },
    heavy: { width: 0.24, height: 0.5 },
  };
  const dims = bodyDimensions[bodyType];
  const heightScale = avatarConfig?.height || 1.0;

  // Animation based on instrument and state
  useFrame(({ clock }) => {
    if (!groupRef.current || !bodyRef.current || !headRef.current) return;

    const time = clock.getElapsedTime() + seed * 5;
    const power = intensity * 0.5;

    if (animationState === 'idle' || animationState === 'intro') {
      bodyRef.current.position.y = 1 + Math.sin(time * 0.5) * 0.02;
      return;
    }

    switch (instrument) {
      case 'vocalist':
        bodyRef.current.position.y = 1 + Math.sin(time * 2) * 0.05 * power;
        headRef.current.rotation.x = Math.sin(time * 1.5) * 0.1 * power;
        headRef.current.rotation.y = Math.sin(time * 0.8) * 0.15 * power;
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.z = 1.2 + Math.sin(time * 2) * 0.3 * power;
          rightArmRef.current.rotation.z = -1.2 - Math.sin(time * 2.5) * 0.3 * power;
          leftArmRef.current.rotation.x = Math.sin(time * 1.5) * 0.2 * power;
        }
        if (leftLegRef.current && rightLegRef.current) {
          leftLegRef.current.rotation.x = Math.sin(time * 2) * 0.1 * power;
          rightLegRef.current.rotation.x = -Math.sin(time * 2) * 0.1 * power;
        }
        break;

      case 'guitarist':
      case 'bassist':
        bodyRef.current.position.y = 1 + Math.sin(time * 1.5) * 0.03 * power;
        bodyRef.current.rotation.z = Math.sin(time * 0.8) * 0.08 * power;
        headRef.current.rotation.x = Math.sin(time * 2) * 0.12 * power;
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.z = 0.6 + Math.sin(time * 4) * 0.15 * power;
          rightArmRef.current.rotation.z = -0.5 - Math.sin(time * 6) * 0.25 * power;
          rightArmRef.current.rotation.x = Math.sin(time * 8) * 0.15 * power;
        }
        if (animationState === 'solo') {
          bodyRef.current.rotation.y = Math.sin(time * 0.5) * 0.3 * power;
          headRef.current.rotation.y = Math.sin(time * 1) * 0.2 * power;
        }
        break;

      case 'drummer':
        bodyRef.current.position.y = 1 + Math.abs(Math.sin(time * 3)) * 0.06 * power;
        headRef.current.rotation.x = Math.sin(time * 3) * 0.2 * power;
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.z = 0.4 + Math.sin(time * 6) * 0.6 * power;
          rightArmRef.current.rotation.z = -0.4 - Math.sin(time * 6 + 1.5) * 0.6 * power;
          leftArmRef.current.rotation.x = -0.3 + Math.abs(Math.sin(time * 6)) * 0.4 * power;
          rightArmRef.current.rotation.x = -0.3 + Math.abs(Math.sin(time * 6 + 1.5)) * 0.4 * power;
        }
        if (rightLegRef.current) {
          rightLegRef.current.rotation.x = Math.abs(Math.sin(time * 4)) * 0.15 * power;
        }
        break;

      case 'keyboardist':
        bodyRef.current.position.y = 1 + Math.sin(time * 1) * 0.02 * power;
        bodyRef.current.rotation.z = Math.sin(time * 0.5) * 0.05 * power;
        headRef.current.rotation.y = Math.sin(time * 0.8) * 0.1 * power;
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.z = 0.35 + Math.sin(time * 5) * 0.12 * power;
          rightArmRef.current.rotation.z = -0.35 - Math.sin(time * 5 + 0.3) * 0.12 * power;
          leftArmRef.current.rotation.x = -0.3 + Math.sin(time * 8) * 0.08 * power;
          rightArmRef.current.rotation.x = -0.3 + Math.sin(time * 8 + 0.5) * 0.08 * power;
        }
        break;
    }
  });

  const instrumentColors = {
    bassist: ['#8b0000', '#000080', '#2f4f4f'][Math.floor(seed * 3) % 3],
    guitarist: ['#ff4500', '#ffd700', '#1e90ff'][Math.floor(seed * 3) % 3],
    default: '#1a1a2e'
  };
  const instrumentColor = instrument === 'bassist' ? instrumentColors.bassist : 
                          instrument === 'guitarist' ? instrumentColors.guitarist : 
                          instrumentColors.default;

  const faceExpression = animationState === 'playing' || animationState === 'solo' ? 
    (instrument === 'vocalist' ? 'singing' : 'intense') : 'neutral';

  return (
    <group ref={groupRef} position={position} scale={heightScale}>
      {/* Body - torso with shirt */}
      <mesh ref={bodyRef} position={[0, 1, 0]} castShadow>
        <capsuleGeometry args={[dims.width, dims.height, 8, 16]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>

      {/* Jacket overlay (if equipped) */}
      {hasJacket && jacketColor && (
        <mesh position={[0, 1, 0]} castShadow>
          <capsuleGeometry args={[dims.width + 0.02, dims.height - 0.05, 8, 16]} />
          <meshStandardMaterial color={jacketColor} roughness={0.6} />
        </mesh>
      )}

      {/* Neck */}
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.1, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>

      {/* Face */}
      <group position={[0, 1.5, 0]}>
        <FaceFeatures skinColor={skinColor} expression={faceExpression} />
      </group>

      {/* Hair */}
      <group position={[0, 1.5, 0]}>
        <CharacterHair hairType={hairType} color={hairColor} seed={seed} />
      </group>

      {/* Shoulders */}
      <mesh position={[-0.22, 1.2, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={hasJacket && jacketColor ? jacketColor : shirtColor} roughness={0.7} />
      </mesh>
      <mesh position={[0.22, 1.2, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={hasJacket && jacketColor ? jacketColor : shirtColor} roughness={0.7} />
      </mesh>

      {/* Left Arm */}
      <mesh ref={leftArmRef} position={[-0.28, 1.1, 0]} rotation={[0, 0, 0.3]} castShadow>
        <capsuleGeometry args={[0.045, 0.35, 6, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Right Arm */}
      <mesh ref={rightArmRef} position={[0.28, 1.1, 0]} rotation={[0, 0, -0.3]} castShadow>
        <capsuleGeometry args={[0.045, 0.35, 6, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Hands */}
      <mesh position={[-0.35, 0.85, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      <mesh position={[0.35, 0.85, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Belt */}
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[dims.width + 0.01, dims.width + 0.01, 0.05, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
      </mesh>

      {/* Legs with pants */}
      <mesh ref={leftLegRef} position={[-0.1, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.5, 6, 10]} />
        <meshStandardMaterial color={pantsColor} roughness={0.6} />
      </mesh>
      <mesh ref={rightLegRef} position={[0.1, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.5, 6, 10]} />
        <meshStandardMaterial color={pantsColor} roughness={0.6} />
      </mesh>

      {/* Shoes */}
      <mesh position={[-0.1, 0.08, 0.02]}>
        <boxGeometry args={[0.1, 0.08, 0.16]} />
        <meshStandardMaterial color={shoesColor} roughness={0.5} />
      </mesh>
      <mesh position={[0.1, 0.08, 0.02]}>
        <boxGeometry args={[0.1, 0.08, 0.16]} />
        <meshStandardMaterial color={shoesColor} roughness={0.5} />
      </mesh>

      {/* Instruments */}
      {instrument === 'guitarist' && (
        <Instruments3D 
          type="electric-guitar" 
          color={instrumentColor}
          position={[0.15, 0.85, 0.12]} 
          rotation={[0, 0, -0.35]} 
        />
      )}

      {instrument === 'bassist' && (
        <Instruments3D 
          type="bass-guitar" 
          color={instrumentColor}
          position={[0.15, 0.85, 0.12]} 
          rotation={[0, 0, -0.35]} 
        />
      )}

      {instrument === 'drummer' && (
        <Instruments3D 
          type="drum-kit" 
          position={[0, 0, 1]} 
        />
      )}

      {instrument === 'vocalist' && (
        <Instruments3D 
          type="microphone" 
          position={[0, 0, 0.3]} 
        />
      )}

      {instrument === 'keyboardist' && (
        <Instruments3D 
          type="keyboard" 
          position={[0, 0.85, 0.4]} 
          rotation={[0, 0, 0]} 
        />
      )}
    </group>
  );
};
