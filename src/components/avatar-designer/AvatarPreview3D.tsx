import { useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";
import { AvatarConfig } from "@/hooks/usePlayerAvatar";
import { CharacterHair } from "@/components/gig-viewer/CharacterHair";
import { FaceFeatures } from "@/components/gig-viewer/FaceFeatures";

interface AvatarPreview3DProps {
  config: Partial<AvatarConfig>;
  autoRotate?: boolean;
}

// Hair type mapping from style_key to CharacterHair types
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

const AvatarCharacter = ({ config }: { config: Partial<AvatarConfig> }) => {
  const groupRef = useRef<Group>(null);

  const skinColor = config.skin_tone || '#e0ac69';
  const hairColor = config.hair_color || '#2d1a0a';
  const hairType = hairStyleKeyToType[config.hair_style_key || 'messy'] || 'messy';
  const bodyType = config.body_type || 'average';
  const height = config.height || 1.0;
  const gender = config.gender || 'male';

  // Dynamic clothing colors from config
  const shirtColor = config.shirt_color || '#2d0a0a';
  const pantsColor = config.pants_color || '#1a1a1a';
  const shoesColor = config.shoes_color || '#1a1a1a';
  const jacketColor = config.jacket_color;
  const hasJacket = !!config.jacket_id;

  // Tattoo and scar styles
  const tattooStyle = config.tattoo_style;
  const scarStyle = config.scar_style;

  // Body dimensions based on body type and gender
  const getBodyDimensions = () => {
    const base = {
      slim: { width: 0.15, height: 0.5 },
      average: { width: 0.18, height: 0.55 },
      muscular: { width: 0.22, height: 0.55 },
      heavy: { width: 0.24, height: 0.5 },
    };
    
    const dims = base[bodyType];
    
    // Adjust for gender
    if (gender === 'female') {
      return {
        width: dims.width * 0.9,
        height: dims.height * 0.95,
        hipWidth: dims.width * 1.05,
        shoulderWidth: dims.width * 0.85,
      };
    }
    
    return {
      width: dims.width,
      height: dims.height,
      hipWidth: dims.width * 0.95,
      shoulderWidth: dims.width * 1.1,
    };
  };

  const dims = getBodyDimensions();

  useFrame(({ clock }) => {
    if (groupRef.current) {
      // Subtle idle animation
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.02;
    }
  });

  // Render tattoo markings
  const renderTattoo = () => {
    if (!tattooStyle || tattooStyle === 'No Tattoo') return null;
    
    const tattooColor = '#1a3a4a';
    
    switch (tattooStyle) {
      case 'Sleeve Tattoo':
        return (
          <>
            <mesh position={[-0.28, 0.95, 0]} rotation={[0, 0, 0.3]}>
              <cylinderGeometry args={[0.048, 0.048, 0.3, 8]} />
              <meshStandardMaterial color={tattooColor} transparent opacity={0.6} />
            </mesh>
          </>
        );
      case 'Neck Tattoo':
        return (
          <mesh position={[0, 1.32, 0.05]}>
            <boxGeometry args={[0.08, 0.06, 0.01]} />
            <meshStandardMaterial color={tattooColor} transparent opacity={0.5} />
          </mesh>
        );
      default:
        return null;
    }
  };

  // Render scar markings
  const renderScar = () => {
    if (!scarStyle || scarStyle === 'No Scar') return null;
    
    const scarColor = '#d4a5a5';
    
    switch (scarStyle) {
      case 'Cheek Scar':
        return (
          <mesh position={[0.12, 1.48, 0.12]} rotation={[0, 0.3, 0.5]}>
            <boxGeometry args={[0.02, 0.06, 0.005]} />
            <meshStandardMaterial color={scarColor} />
          </mesh>
        );
      case 'Eye Scar':
        return (
          <mesh position={[0.08, 1.52, 0.12]} rotation={[0, 0.2, -0.3]}>
            <boxGeometry args={[0.015, 0.08, 0.005]} />
            <meshStandardMaterial color={scarColor} />
          </mesh>
        );
      case 'Lip Scar':
        return (
          <mesh position={[0.02, 1.42, 0.13]} rotation={[0, 0, 0.2]}>
            <boxGeometry args={[0.015, 0.03, 0.005]} />
            <meshStandardMaterial color={scarColor} />
          </mesh>
        );
      case 'Forehead Scar':
        return (
          <mesh position={[-0.02, 1.58, 0.12]} rotation={[0, 0, 0.4]}>
            <boxGeometry args={[0.015, 0.05, 0.005]} />
            <meshStandardMaterial color={scarColor} />
          </mesh>
        );
      default:
        return null;
    }
  };

  return (
    <group ref={groupRef} scale={height}>
      {/* Body - torso with shirt */}
      <mesh position={[0, 1, 0]} castShadow>
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
      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>

      {/* Face */}
      <group position={[0, 1.5, 0]}>
        <FaceFeatures skinColor={skinColor} expression="neutral" />
      </group>

      {/* Hair */}
      <group position={[0, 1.5, 0]}>
        <CharacterHair hairType={hairType} color={hairColor} seed={0.5} />
      </group>

      {/* Scars */}
      {renderScar()}

      {/* Tattoos */}
      {renderTattoo()}

      {/* Shoulders */}
      <mesh position={[-dims.shoulderWidth * 1.2, 1.2, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={hasJacket && jacketColor ? jacketColor : shirtColor} roughness={0.7} />
      </mesh>
      <mesh position={[dims.shoulderWidth * 1.2, 1.2, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={hasJacket && jacketColor ? jacketColor : shirtColor} roughness={0.7} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.28, 1.0, 0]} rotation={[0, 0, 0.3]} castShadow>
        <capsuleGeometry args={[0.045, 0.35, 6, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>
      <mesh position={[0.28, 1.0, 0]} rotation={[0, 0, -0.3]} castShadow>
        <capsuleGeometry args={[0.045, 0.35, 6, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Hands */}
      <mesh position={[-0.35, 0.75, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      <mesh position={[0.35, 0.75, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Belt */}
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[dims.hipWidth + 0.01, dims.hipWidth + 0.01, 0.05, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
      </mesh>

      {/* Legs with pants */}
      <mesh position={[-0.1, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.5, 6, 10]} />
        <meshStandardMaterial color={pantsColor} roughness={0.6} />
      </mesh>
      <mesh position={[0.1, 0.4, 0]} castShadow>
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
    </group>
  );
};

export const AvatarPreview3D = ({ config, autoRotate = true }: AvatarPreview3DProps) => {
  return (
    <div className="w-full h-full min-h-[400px] rounded-lg overflow-hidden bg-gradient-to-b from-card to-background">
      <Canvas
        camera={{ position: [0, 1.2, 3], fov: 45 }}
        shadows
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight 
            position={[5, 5, 5]} 
            intensity={1} 
            castShadow 
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <spotLight
            position={[0, 5, 2]}
            angle={0.5}
            penumbra={0.5}
            intensity={0.8}
            color="#ffffff"
          />

          <AvatarCharacter config={config} />

          {/* Ground plane */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[10, 10]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
          </mesh>

          <OrbitControls
            autoRotate={autoRotate}
            autoRotateSpeed={1}
            enablePan={false}
            minDistance={2}
            maxDistance={5}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 2}
          />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
    </div>
  );
};
