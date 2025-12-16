import { useRef } from "react";
import { Mesh, Group } from "three";
import { useFrame } from "@react-three/fiber";
import { EnhancedFace } from "@/components/avatar-system/EnhancedFace";
import { EnhancedHair } from "@/components/avatar-system/EnhancedHair";
import { Instruments3D } from "./Instruments3D";

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
  weight?: number;
  muscle_definition?: number;
  shoulder_width?: number;
  hip_width?: number;
  eye_color?: string;
  eyebrow_color?: string;
  lip_color?: string;
}

interface EnhancedBandMember3DProps {
  position: [number, number, number];
  instrument: 'vocalist' | 'guitarist' | 'bassist' | 'drummer' | 'keyboardist';
  animationState: 'idle' | 'intro' | 'playing' | 'solo' | 'outro';
  intensity: number;
  seed: number;
  avatarConfig?: AvatarConfig;
}

const hairStyleKeyToType: Record<string, string> = {
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

export const EnhancedBandMember3D = ({
  position,
  instrument,
  animationState,
  intensity,
  seed,
  avatarConfig,
}: EnhancedBandMember3DProps) => {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Mesh>(null);
  const headRef = useRef<Mesh>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Mesh>(null);
  const rightLegRef = useRef<Mesh>(null);

  // Default values based on seed
  const hairTypes = ['rocker', 'messy', 'mohawk', 'long-straight', 'short-spiky', 'curly', 'ponytail', 'bald'];
  const defaultHairType = hairTypes[Math.floor(seed * 8) % 8];
  const defaultHairColors = ['#1a1a1a', '#3d2616', '#8b4513', '#daa520', '#a52a2a', '#4a3728'];
  const defaultHairColor = defaultHairColors[Math.floor(seed * 6) % 6];
  const defaultShirtColors = ['#1a1a1a', '#2d0a0a', '#0a0a2d', '#1a0a1a', '#0a1a0a', '#2d2d2d'];
  const defaultShirtColor = defaultShirtColors[Math.floor(seed * 6) % 6];
  const defaultSkinTones = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524'];
  const defaultSkinColor = defaultSkinTones[Math.floor(seed * 5) % 5];

  // Use config or defaults
  const hairType = avatarConfig?.hair_style_key
    ? (hairStyleKeyToType[avatarConfig.hair_style_key] || defaultHairType)
    : defaultHairType;
  const hairColor = avatarConfig?.hair_color || defaultHairColor;
  const skinColor = avatarConfig?.skin_tone || defaultSkinColor;
  const shirtColor = avatarConfig?.shirt_color || defaultShirtColor;
  const pantsColor = avatarConfig?.pants_color || '#0a0a0a';
  const shoesColor = avatarConfig?.shoes_color || '#1a1a1a';
  const hasJacket = !!avatarConfig?.jacket_color;
  const jacketColor = avatarConfig?.jacket_color || null;

  // Body dimensions
  const bodyType = avatarConfig?.body_type || 'average';
  const weight = avatarConfig?.weight ?? 1.0;
  const muscleDefinition = avatarConfig?.muscle_definition ?? 0.5;
  const shoulderWidth = avatarConfig?.shoulder_width ?? 1.0;
  const heightScale = avatarConfig?.height || 1.0;

  const getDimensions = () => {
    const base = {
      slim: { torsoW: 0.14, torsoH: 0.4 },
      average: { torsoW: 0.17, torsoH: 0.42 },
      muscular: { torsoW: 0.2, torsoH: 0.44 },
      heavy: { torsoW: 0.22, torsoH: 0.4 },
    };
    const b = base[bodyType];
    const weightMod = 0.75 + weight * 0.5;
    const muscleMod = 1 + muscleDefinition * 0.2;
    return {
      torsoW: b.torsoW * weightMod * muscleMod,
      torsoH: b.torsoH,
      shoulderW: 0.26 * shoulderWidth * muscleMod,
      armRadius: 0.04 * weightMod * muscleMod,
    };
  };

  const dims = getDimensions();
  const clothingColor = hasJacket && jacketColor ? jacketColor : shirtColor;

  // Animation
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
          leftArmRef.current.rotation.z = 0.3 + Math.sin(time * 2) * 0.4 * power;
          rightArmRef.current.rotation.z = -0.3 - Math.sin(time * 2.5) * 0.4 * power;
        }
        break;

      case 'guitarist':
      case 'bassist':
        bodyRef.current.position.y = 1 + Math.sin(time * 1.5) * 0.03 * power;
        bodyRef.current.rotation.z = Math.sin(time * 0.8) * 0.08 * power;
        headRef.current.rotation.x = Math.sin(time * 2) * 0.12 * power;
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.z = 0.5 + Math.sin(time * 4) * 0.15 * power;
          rightArmRef.current.rotation.z = -0.4 - Math.sin(time * 6) * 0.25 * power;
        }
        if (animationState === 'solo') {
          bodyRef.current.rotation.y = Math.sin(time * 0.5) * 0.3 * power;
        }
        break;

      case 'drummer':
        bodyRef.current.position.y = 1 + Math.abs(Math.sin(time * 3)) * 0.06 * power;
        headRef.current.rotation.x = Math.sin(time * 3) * 0.2 * power;
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.z = 0.4 + Math.sin(time * 6) * 0.6 * power;
          rightArmRef.current.rotation.z = -0.4 - Math.sin(time * 6 + 1.5) * 0.6 * power;
        }
        break;

      case 'keyboardist':
        bodyRef.current.position.y = 1 + Math.sin(time * 1) * 0.02 * power;
        headRef.current.rotation.y = Math.sin(time * 0.8) * 0.1 * power;
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.z = 0.35 + Math.sin(time * 5) * 0.12 * power;
          rightArmRef.current.rotation.z = -0.35 - Math.sin(time * 5 + 0.3) * 0.12 * power;
        }
        break;
    }
  });

  const instrumentColors = {
    bassist: ['#8b0000', '#000080', '#2f4f4f'][Math.floor(seed * 3) % 3],
    guitarist: ['#ff4500', '#ffd700', '#1e90ff'][Math.floor(seed * 3) % 3],
    default: '#1a1a2e',
  };
  const instrumentColor =
    instrument === 'bassist' ? instrumentColors.bassist :
    instrument === 'guitarist' ? instrumentColors.guitarist :
    instrumentColors.default;

  const faceExpression = animationState === 'playing' || animationState === 'solo'
    ? (instrument === 'vocalist' ? 'singing' : 'intense')
    : 'neutral';

  return (
    <group ref={groupRef} position={position} scale={heightScale}>
      {/* Enhanced Torso */}
      <group>
        <mesh ref={bodyRef} position={[0, 1, 0]} castShadow>
          <capsuleGeometry args={[dims.torsoW, dims.torsoH, 12, 24]} />
          <meshStandardMaterial color={shirtColor} roughness={0.7} />
        </mesh>
        {/* Chest definition */}
        <mesh position={[0, 1.08, dims.torsoW * 0.5]} castShadow>
          <sphereGeometry args={[dims.torsoW * 0.6, 12, 12]} />
          <meshStandardMaterial color={shirtColor} roughness={0.7} />
        </mesh>
        {/* Jacket */}
        {hasJacket && jacketColor && (
          <>
            <mesh position={[0, 1, 0]} castShadow>
              <capsuleGeometry args={[dims.torsoW + 0.015, dims.torsoH - 0.02, 12, 24]} />
              <meshStandardMaterial color={jacketColor} roughness={0.5} />
            </mesh>
            <mesh position={[0, 1, dims.torsoW + 0.02]}>
              <boxGeometry args={[0.015, dims.torsoH * 0.7, 0.008]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.3} />
            </mesh>
          </>
        )}
      </group>

      {/* Enhanced Neck */}
      <mesh position={[0, 1.38, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.065, 0.12, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>

      {/* Enhanced Head */}
      <mesh ref={headRef} position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.15, 32, 32]} />
        <meshStandardMaterial color={skinColor} roughness={0.45} />
      </mesh>

      {/* Enhanced Face */}
      <group position={[0, 1.5, 0]}>
        <EnhancedFace
          skinColor={skinColor}
          expression={faceExpression as any}
          eyeColor={avatarConfig?.eye_color}
          eyebrowColor={avatarConfig?.eyebrow_color || hairColor}
          lipColor={avatarConfig?.lip_color}
        />
      </group>

      {/* Enhanced Hair */}
      <group position={[0, 1.5, 0]}>
        <EnhancedHair hairType={hairType} color={hairColor} seed={seed} />
      </group>

      {/* Enhanced Shoulders */}
      <group position={[-dims.shoulderW * 0.85, 1.22, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color={clothingColor} roughness={0.6} />
        </mesh>
      </group>
      <group position={[dims.shoulderW * 0.85, 1.22, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color={clothingColor} roughness={0.6} />
        </mesh>
      </group>

      {/* Enhanced Left Arm */}
      <group ref={leftArmRef} position={[-dims.shoulderW, 1.05, 0]}>
        <mesh position={[0, 0, 0]} rotation={[0, 0, 0.25]} castShadow>
          <capsuleGeometry args={[dims.armRadius, 0.16, 8, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        <mesh position={[-0.06, -0.12, 0]}>
          <sphereGeometry args={[dims.armRadius * 0.9, 12, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        <mesh position={[-0.1, -0.22, 0]} rotation={[0, 0, 0.15]} castShadow>
          <capsuleGeometry args={[dims.armRadius * 0.85, 0.14, 8, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        {/* Hand with fingers */}
        <group position={[-0.14, -0.36, 0]}>
          <mesh>
            <boxGeometry args={[0.05, 0.055, 0.025]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>
          {[0.012, 0.004, -0.004, -0.012].map((x, i) => (
            <mesh key={i} position={[x, -0.035, 0]}>
              <capsuleGeometry args={[0.006, 0.018, 4, 6]} />
              <meshStandardMaterial color={skinColor} roughness={0.5} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Enhanced Right Arm */}
      <group ref={rightArmRef} position={[dims.shoulderW, 1.05, 0]}>
        <mesh position={[0, 0, 0]} rotation={[0, 0, -0.25]} castShadow>
          <capsuleGeometry args={[dims.armRadius, 0.16, 8, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        <mesh position={[0.06, -0.12, 0]}>
          <sphereGeometry args={[dims.armRadius * 0.9, 12, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        <mesh position={[0.1, -0.22, 0]} rotation={[0, 0, -0.15]} castShadow>
          <capsuleGeometry args={[dims.armRadius * 0.85, 0.14, 8, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        <group position={[0.14, -0.36, 0]}>
          <mesh>
            <boxGeometry args={[0.05, 0.055, 0.025]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>
          {[-0.012, -0.004, 0.004, 0.012].map((x, i) => (
            <mesh key={i} position={[x, -0.035, 0]}>
              <capsuleGeometry args={[0.006, 0.018, 4, 6]} />
              <meshStandardMaterial color={skinColor} roughness={0.5} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Belt */}
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[dims.torsoW * 0.95, dims.torsoW * 0.95, 0.045, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.7, dims.torsoW + 0.01]}>
        <boxGeometry args={[0.04, 0.035, 0.01]} />
        <meshStandardMaterial color="#8a8a8a" metalness={0.7} roughness={0.2} />
      </mesh>

      {/* Enhanced Legs */}
      <group position={[-0.08, 0.42, 0]}>
        <mesh ref={leftLegRef} position={[0, 0.08, 0]} castShadow>
          <capsuleGeometry args={[0.058, 0.18, 10, 16]} />
          <meshStandardMaterial color={pantsColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.12, 0.01]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={pantsColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.32, 0]} castShadow>
          <capsuleGeometry args={[0.048, 0.16, 10, 16]} />
          <meshStandardMaterial color={pantsColor} roughness={0.6} />
        </mesh>
      </group>
      <group position={[0.08, 0.42, 0]}>
        <mesh ref={rightLegRef} position={[0, 0.08, 0]} castShadow>
          <capsuleGeometry args={[0.058, 0.18, 10, 16]} />
          <meshStandardMaterial color={pantsColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.12, 0.01]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={pantsColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.32, 0]} castShadow>
          <capsuleGeometry args={[0.048, 0.16, 10, 16]} />
          <meshStandardMaterial color={pantsColor} roughness={0.6} />
        </mesh>
      </group>

      {/* Enhanced Shoes */}
      <group position={[-0.08, 0.06, 0.02]}>
        <mesh castShadow>
          <boxGeometry args={[0.085, 0.07, 0.15]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.01, 0.06]}>
          <sphereGeometry args={[0.042, 12, 12]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.03, 0]}>
          <boxGeometry args={[0.09, 0.015, 0.16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
      </group>
      <group position={[0.08, 0.06, 0.02]}>
        <mesh castShadow>
          <boxGeometry args={[0.085, 0.07, 0.15]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.01, 0.06]}>
          <sphereGeometry args={[0.042, 12, 12]} />
          <meshStandardMaterial color={shoesColor} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.03, 0]}>
          <boxGeometry args={[0.09, 0.015, 0.16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
        </mesh>
      </group>

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
        <Instruments3D type="drum-kit" position={[0, 0, 1]} />
      )}
      {instrument === 'vocalist' && (
        <Instruments3D type="microphone" position={[0, 0, 0.3]} />
      )}
      {instrument === 'keyboardist' && (
        <Instruments3D type="keyboard" position={[0, 0.85, 0.4]} rotation={[0, 0, 0]} />
      )}
    </group>
  );
};
