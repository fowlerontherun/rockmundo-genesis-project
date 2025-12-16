import { useRef, Suspense, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";
import { AvatarConfig } from "@/hooks/usePlayerAvatar";
import { CharacterHair } from "@/components/gig-viewer/CharacterHair";
import { FaceFeatures } from "@/components/gig-viewer/FaceFeatures";
import { ViewControls } from "./ViewControls";

interface AvatarPreview3DProps {
  config: Partial<AvatarConfig>;
  autoRotate?: boolean;
}

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
  
  // Advanced body params
  const weight = config.weight ?? 1.0;
  const muscleDefinition = config.muscle_definition ?? 0.5;
  const shoulderWidth = config.shoulder_width ?? 1.0;
  const hipWidth = config.hip_width ?? 1.0;
  const torsoLength = config.torso_length ?? 1.0;
  const armLength = config.arm_length ?? 1.0;
  const legLength = config.leg_length ?? 1.0;

  const shirtColor = config.shirt_color || '#2d0a0a';
  const pantsColor = config.pants_color || '#1a1a1a';
  const shoesColor = config.shoes_color || '#1a1a1a';
  const jacketColor = config.jacket_color;
  const hasJacket = !!config.jacket_id;

  const tattooStyle = config.tattoo_style;
  const scarStyle = config.scar_style;

  const getBodyDimensions = () => {
    const base = {
      slim: { width: 0.15, height: 0.5 },
      average: { width: 0.18, height: 0.55 },
      muscular: { width: 0.22, height: 0.55 },
      heavy: { width: 0.24, height: 0.5 },
    };
    
    const dims = base[bodyType];
    const weightMod = 0.7 + weight * 0.6;
    const muscleMod = 1 + muscleDefinition * 0.15;
    
    if (gender === 'female') {
      return {
        width: dims.width * 0.9 * weightMod,
        height: dims.height * 0.95 * torsoLength,
        hipWidth: dims.width * 1.05 * hipWidth * weightMod,
        shoulderWidth: dims.width * 0.85 * shoulderWidth,
      };
    }
    
    return {
      width: dims.width * weightMod * muscleMod,
      height: dims.height * torsoLength,
      hipWidth: dims.width * 0.95 * hipWidth * weightMod,
      shoulderWidth: dims.width * 1.1 * shoulderWidth * muscleMod,
    };
  };

  const dims = getBodyDimensions();

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.01;
    }
  });

  const renderTattoo = () => {
    if (!tattooStyle || tattooStyle === 'No Tattoo') return null;
    const tattooColor = '#1a3a4a';
    switch (tattooStyle) {
      case 'Sleeve Tattoo':
        return (
          <mesh position={[-0.28 * armLength, 0.95, 0]} rotation={[0, 0, 0.3]}>
            <cylinderGeometry args={[0.048, 0.048, 0.3, 8]} />
            <meshStandardMaterial color={tattooColor} transparent opacity={0.6} />
          </mesh>
        );
      case 'Neck Tattoo':
        return (
          <mesh position={[0, 1.32 * torsoLength, 0.05]}>
            <boxGeometry args={[0.08, 0.06, 0.01]} />
            <meshStandardMaterial color={tattooColor} transparent opacity={0.5} />
          </mesh>
        );
      default:
        return null;
    }
  };

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
      default:
        return null;
    }
  };

  // Face structure
  const faceWidth = config.face_width ?? 1.0;
  const faceLength = config.face_length ?? 1.0;

  return (
    <group ref={groupRef} scale={height}>
      {/* Body */}
      <mesh position={[0, 1 * torsoLength, 0]} castShadow>
        <capsuleGeometry args={[dims.width, dims.height, 8, 16]} />
        <meshStandardMaterial color={shirtColor} roughness={0.7} />
      </mesh>

      {hasJacket && jacketColor && (
        <mesh position={[0, 1 * torsoLength, 0]} castShadow>
          <capsuleGeometry args={[dims.width + 0.02, dims.height - 0.05, 8, 16]} />
          <meshStandardMaterial color={jacketColor} roughness={0.6} />
        </mesh>
      )}

      {/* Neck */}
      <mesh position={[0, 1.35 * torsoLength, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.1, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.5 * torsoLength, 0]} castShadow>
        <sphereGeometry args={[0.15 * faceWidth, 16, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>

      {/* Face Features */}
      <group position={[0, 1.5 * torsoLength, 0]} scale={[faceWidth, faceLength, 1]}>
        <FaceFeatures 
          skinColor={skinColor} 
          expression="neutral"
          eyeColor={config.eye_color}
          eyeSize={config.eye_size}
          eyeSpacing={config.eye_spacing}
          eyeTilt={config.eye_tilt}
          eyebrowStyle={config.eyebrow_style as any}
          eyebrowColor={config.eyebrow_color}
          eyebrowThickness={config.eyebrow_thickness}
          noseWidth={config.nose_width}
          noseLength={config.nose_length}
          noseBridge={config.nose_bridge}
          lipFullness={config.lip_fullness}
          lipWidth={config.lip_width}
          lipColor={config.lip_color}
          earSize={config.ear_size}
          earAngle={config.ear_angle}
        />
      </group>

      {/* Hair */}
      <group position={[0, 1.5 * torsoLength, 0]}>
        <CharacterHair hairType={hairType} color={hairColor} seed={0.5} />
      </group>

      {renderScar()}
      {renderTattoo()}

      {/* Shoulders */}
      <mesh position={[-dims.shoulderWidth * 1.2, 1.2 * torsoLength, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={hasJacket && jacketColor ? jacketColor : shirtColor} roughness={0.7} />
      </mesh>
      <mesh position={[dims.shoulderWidth * 1.2, 1.2 * torsoLength, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={hasJacket && jacketColor ? jacketColor : shirtColor} roughness={0.7} />
      </mesh>

      {/* Arms */}
      <mesh position={[-0.28, 1.0 * torsoLength, 0]} rotation={[0, 0, 0.3]} castShadow>
        <capsuleGeometry args={[0.045, 0.35 * armLength, 6, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>
      <mesh position={[0.28, 1.0 * torsoLength, 0]} rotation={[0, 0, -0.3]} castShadow>
        <capsuleGeometry args={[0.045, 0.35 * armLength, 6, 10]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Hands */}
      <mesh position={[-0.35, 0.75 * armLength, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      <mesh position={[0.35, 0.75 * armLength, 0]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>

      {/* Belt */}
      <mesh position={[0, 0.68 * torsoLength, 0]}>
        <cylinderGeometry args={[dims.hipWidth + 0.01, dims.hipWidth + 0.01, 0.05, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.1, 0.4 * legLength, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.5 * legLength, 6, 10]} />
        <meshStandardMaterial color={pantsColor} roughness={0.6} />
      </mesh>
      <mesh position={[0.1, 0.4 * legLength, 0]} castShadow>
        <capsuleGeometry args={[0.065, 0.5 * legLength, 6, 10]} />
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

const CameraController = ({ 
  targetPosition, 
  targetZoom 
}: { 
  targetPosition: [number, number, number]; 
  targetZoom: number;
}) => {
  const { camera } = useThree();
  
  useFrame(() => {
    camera.position.lerp({ x: targetPosition[0], y: targetPosition[1], z: targetPosition[2] }, 0.05);
  });
  
  return null;
};

export const AvatarPreview3D = ({ config, autoRotate: initialAutoRotate = false }: AvatarPreview3DProps) => {
  const [autoRotate, setAutoRotate] = useState(initialAutoRotate);
  const [cameraTarget, setCameraTarget] = useState<[number, number, number]>([0, 1.4, 2.5]);
  const controlsRef = useRef<any>(null);

  const handleZoomIn = useCallback(() => {
    if (controlsRef.current) {
      const currentDistance = controlsRef.current.getDistance();
      controlsRef.current.dollyTo(Math.max(1.2, currentDistance - 0.5), true);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (controlsRef.current) {
      const currentDistance = controlsRef.current.getDistance();
      controlsRef.current.dollyTo(Math.min(5, currentDistance + 0.5), true);
    }
  }, []);

  const handleResetView = useCallback(() => {
    setCameraTarget([0, 1.4, 2.5]);
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }, []);

  const handleSetView = useCallback((view: 'face' | 'upper' | 'full') => {
    switch (view) {
      case 'face':
        setCameraTarget([0, 1.5, 1.5]);
        break;
      case 'upper':
        setCameraTarget([0, 1.3, 2]);
        break;
      case 'full':
        setCameraTarget([0, 0.8, 3]);
        break;
    }
  }, []);

  return (
    <div className="relative w-full h-full min-h-[550px] rounded-lg overflow-hidden bg-gradient-to-b from-card to-background">
      <Canvas
        camera={{ position: [0, 1.4, 2.5], fov: 40 }}
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

          <CameraController targetPosition={cameraTarget} targetZoom={2.5} />
          <AvatarCharacter config={config} />

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[10, 10]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.8} />
          </mesh>

          <OrbitControls
            ref={controlsRef}
            autoRotate={autoRotate}
            autoRotateSpeed={1}
            enablePan={false}
            minDistance={1.2}
            maxDistance={5}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI * 0.75}
            target={[0, 1, 0]}
          />
          <Environment preset="city" />
        </Suspense>
      </Canvas>
      
      <ViewControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
        onSetView={handleSetView}
        autoRotate={autoRotate}
      />
    </div>
  );
};