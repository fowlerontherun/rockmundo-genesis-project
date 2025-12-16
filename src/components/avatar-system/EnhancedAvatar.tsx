import { useRef } from "react";
import { Group } from "three";
import { useFrame } from "@react-three/fiber";
import { AvatarConfig } from "@/hooks/usePlayerAvatar";
import { EnhancedBody } from "./EnhancedBody";
import { EnhancedFace } from "./EnhancedFace";
import { EnhancedHair } from "./EnhancedHair";

interface EnhancedAvatarProps {
  config: Partial<AvatarConfig>;
  animate?: boolean;
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

export const EnhancedAvatar = ({ config, animate = true }: EnhancedAvatarProps) => {
  const groupRef = useRef<Group>(null);

  // Extract config values with defaults
  const skinColor = config.skin_tone || '#e0ac69';
  const hairColor = config.hair_color || '#2d1a0a';
  const hairType = hairStyleKeyToType[config.hair_style_key || 'messy'] || 'messy';
  const bodyType = (config.body_type || 'average') as 'slim' | 'average' | 'muscular' | 'heavy';
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

  // Clothing
  const shirtColor = config.shirt_color || '#2d0a0a';
  const pantsColor = config.pants_color || '#1a1a1a';
  const shoesColor = config.shoes_color || '#1a1a1a';
  const jacketColor = config.jacket_color;
  const hasJacket = !!config.jacket_id;

  // Face structure
  const faceWidth = config.face_width ?? 1.0;
  const faceLength = config.face_length ?? 1.0;

  // Tattoos and scars
  const tattooStyle = config.tattoo_style;
  const scarStyle = config.scar_style;

  // Subtle breathing animation
  useFrame(({ clock }) => {
    if (animate && groupRef.current) {
      const breathe = Math.sin(clock.getElapsedTime() * 1.2) * 0.003;
      groupRef.current.position.y = breathe;
      // Subtle sway
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.02;
    }
  });

  const renderTattoo = () => {
    if (!tattooStyle || tattooStyle === 'No Tattoo') return null;
    const tattooColor = '#1a3a4a';
    switch (tattooStyle) {
      case 'Sleeve Tattoo':
        return (
          <group position={[-0.28 * armLength, 0.95 * height, 0]}>
            {/* Tattoo pattern - tribal style */}
            {[0, 0.05, 0.1].map((y, i) => (
              <mesh key={i} position={[0, y, 0]} rotation={[0, 0, 0.3 + i * 0.1]}>
                <torusGeometry args={[0.045 + i * 0.002, 0.006, 6, 12, Math.PI * 0.8]} />
                <meshStandardMaterial color={tattooColor} transparent opacity={0.7} />
              </mesh>
            ))}
          </group>
        );
      case 'Neck Tattoo':
        return (
          <mesh position={[0, 1.34 * torsoLength * height, 0.06]}>
            <boxGeometry args={[0.06, 0.04, 0.01]} />
            <meshStandardMaterial color={tattooColor} transparent opacity={0.6} />
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
          <mesh position={[0.11, 1.48 * height, 0.13]} rotation={[0, 0.3, 0.5]}>
            <boxGeometry args={[0.018, 0.05, 0.004]} />
            <meshStandardMaterial color={scarColor} roughness={0.8} />
          </mesh>
        );
      case 'Eye Scar':
        return (
          <mesh position={[0.07, 1.52 * height, 0.13]} rotation={[0, 0.2, -0.3]}>
            <boxGeometry args={[0.012, 0.06, 0.004]} />
            <meshStandardMaterial color={scarColor} roughness={0.8} />
          </mesh>
        );
      default:
        return null;
    }
  };

  return (
    <group ref={groupRef}>
      {/* Enhanced Body */}
      <EnhancedBody
        skinColor={skinColor}
        bodyType={bodyType}
        gender={gender}
        height={height}
        weight={weight}
        muscleDefinition={muscleDefinition}
        shoulderWidth={shoulderWidth}
        hipWidth={hipWidth}
        torsoLength={torsoLength}
        armLength={armLength}
        legLength={legLength}
        shirtColor={shirtColor}
        pantsColor={pantsColor}
        shoesColor={shoesColor}
        jacketColor={jacketColor}
        hasJacket={hasJacket}
      />

      {/* Head - higher poly */}
      <mesh position={[0, 1.5 * torsoLength * height, 0]} castShadow>
        <sphereGeometry args={[0.15 * faceWidth, 32, 32]} />
        <meshStandardMaterial color={skinColor} roughness={0.45} />
      </mesh>

      {/* Enhanced Face Features */}
      <group position={[0, 1.5 * torsoLength * height, 0]} scale={[faceWidth, faceLength, 1]}>
        <EnhancedFace
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
          jawShape={config.jaw_shape as any}
          cheekbone={config.cheekbone}
          chinProminence={config.chin_prominence}
        />
      </group>

      {/* Enhanced Hair */}
      <group position={[0, 1.5 * torsoLength * height, 0]}>
        <EnhancedHair hairType={hairType} color={hairColor} seed={0.5} />
      </group>

      {/* Tattoos and Scars */}
      {renderTattoo()}
      {renderScar()}
    </group>
  );
};
