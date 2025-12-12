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

// Hair type mapping
const hairStyleKeyToType: Record<string, 'short-spiky' | 'long-straight' | 'mohawk' | 'bald' | 'ponytail' | 'curly' | 'rocker' | 'messy'> = {
  'short-spiky': 'short-spiky',
  'long-straight': 'long-straight',
  'mohawk': 'mohawk',
  'bald': 'bald',
  'ponytail': 'ponytail',
  'curly': 'curly',
  'rocker': 'rocker',
  'messy': 'messy',
  'undercut': 'short-spiky',
  'dreadlocks': 'rocker',
  'buzz': 'bald',
  'braids': 'ponytail',
};

const AvatarCharacter = ({ config }: { config: Partial<AvatarConfig> }) => {
  const groupRef = useRef<Group>(null);

  const skinColor = config.skin_tone || '#e0ac69';
  const hairColor = config.hair_color || '#2d1a0a';
  const hairType = hairStyleKeyToType[config.hair_style_id || 'messy'] || 'messy';
  const bodyType = config.body_type || 'average';
  const height = config.height || 1.0;

  // Body dimensions based on body type
  const bodyDimensions = {
    slim: { width: 0.15, height: 0.5 },
    average: { width: 0.18, height: 0.55 },
    muscular: { width: 0.22, height: 0.55 },
    heavy: { width: 0.24, height: 0.5 },
  };

  const dims = bodyDimensions[bodyType];

  // Shirt color - could be dynamic based on config
  const shirtColor = '#2d0a0a';
  const pantsColor = '#1a1a1a';

  useFrame(({ clock }) => {
    if (groupRef.current) {
      // Subtle idle animation
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.02;
    }
  });

  return (
    <group ref={groupRef} scale={height}>
      {/* Body - torso */}
      <mesh position={[0, 1, 0]} castShadow>
        <capsuleGeometry args={[dims.width, dims.height, 8, 16]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>

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

      {/* Shoulders */}
      <mesh position={[-0.22, 1.2, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>
      <mesh position={[0.22, 1.2, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
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
        <cylinderGeometry args={[dims.width + 0.01, dims.width + 0.01, 0.05, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.1, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.5, 6, 10]} />
        <meshStandardMaterial color={pantsColor} roughness={0.6} />
      </mesh>
      <mesh position={[0.1, 0.4, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.5, 6, 10]} />
        <meshStandardMaterial color={pantsColor} roughness={0.6} />
      </mesh>

      {/* Boots/Shoes */}
      <mesh position={[-0.1, 0.08, 0.02]}>
        <boxGeometry args={[0.1, 0.08, 0.16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
      </mesh>
      <mesh position={[0.1, 0.08, 0.02]}>
        <boxGeometry args={[0.1, 0.08, 0.16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
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
