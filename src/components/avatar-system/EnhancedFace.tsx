import { useMemo } from "react";

interface EnhancedFaceProps {
  skinColor: string;
  expression?: 'neutral' | 'happy' | 'singing' | 'intense';
  eyeColor?: string;
  eyeSize?: number;
  eyeSpacing?: number;
  eyeTilt?: number;
  eyebrowStyle?: 'thin' | 'normal' | 'thick' | 'arched' | 'straight';
  eyebrowColor?: string;
  eyebrowThickness?: number;
  noseWidth?: number;
  noseLength?: number;
  noseBridge?: number;
  lipFullness?: number;
  lipWidth?: number;
  lipColor?: string;
  earSize?: number;
  earAngle?: number;
  jawShape?: 'round' | 'square' | 'pointed' | 'oval';
  cheekbone?: number;
  chinProminence?: number;
}

export const EnhancedFace = ({
  skinColor,
  expression = 'neutral',
  eyeColor = '#4a3728',
  eyeSize = 1.0,
  eyeSpacing = 1.0,
  eyeTilt = 0,
  eyebrowStyle = 'normal',
  eyebrowColor = '#1a1a1a',
  eyebrowThickness = 1.0,
  noseWidth = 1.0,
  noseLength = 1.0,
  noseBridge = 0.5,
  lipFullness = 1.0,
  lipWidth = 1.0,
  lipColor = '#c4777f',
  earSize = 1.0,
  earAngle = 0,
  jawShape = 'oval',
  cheekbone = 0.5,
  chinProminence = 0.5,
}: EnhancedFaceProps) => {
  // Calculate eye positions with improved geometry
  const eyeX = 0.042 * eyeSpacing;
  const baseEyeSize = 0.018 * eyeSize;
  const eyeWhiteSize = 0.026 * eyeSize;
  
  // Enhanced eyebrow dimensions
  const eyebrowDims = useMemo(() => {
    const baseWidth = 0.04;
    const baseHeight = 0.008 * eyebrowThickness;
    const baseDepth = 0.012;
    
    switch (eyebrowStyle) {
      case 'thin': return { width: baseWidth * 0.75, height: baseHeight * 0.5, depth: baseDepth, arch: 0.15 };
      case 'thick': return { width: baseWidth * 1.15, height: baseHeight * 1.6, depth: baseDepth * 1.2, arch: 0.1 };
      case 'arched': return { width: baseWidth, height: baseHeight, depth: baseDepth, arch: 0.25 };
      case 'straight': return { width: baseWidth * 1.1, height: baseHeight, depth: baseDepth, arch: 0 };
      default: return { width: baseWidth, height: baseHeight, depth: baseDepth, arch: 0.12 };
    }
  }, [eyebrowStyle, eyebrowThickness]);

  // Mouth state based on expression
  const mouthState = useMemo(() => {
    switch (expression) {
      case 'singing':
        return { open: true, width: lipWidth * 0.9, height: 0.02 * lipFullness };
      case 'happy':
        return { open: false, width: lipWidth * 1.1, height: 0.008 * lipFullness, smile: true };
      case 'intense':
        return { open: false, width: lipWidth * 0.85, height: 0.006 * lipFullness, tight: true };
      default:
        return { open: false, width: lipWidth, height: 0.007 * lipFullness };
    }
  }, [expression, lipWidth, lipFullness]);

  // Cheekbone and jaw modifications
  const cheekScale = 1 + (cheekbone - 0.5) * 0.15;
  const chinScale = 1 + (chinProminence - 0.5) * 0.2;

  return (
    <group>
      {/* Enhanced Eye Sockets - slight indentation */}
      <mesh position={[-eyeX, 0.02, 0.1]}>
        <sphereGeometry args={[0.032, 16, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.7} />
      </mesh>
      <mesh position={[eyeX, 0.02, 0.1]}>
        <sphereGeometry args={[0.032, 16, 16]} />
        <meshStandardMaterial color={skinColor} roughness={0.7} />
      </mesh>

      {/* Eye Whites - higher poly for smoother look */}
      <mesh position={[-eyeX, 0.02, 0.115]} rotation={[0, 0, eyeTilt]}>
        <sphereGeometry args={[eyeWhiteSize, 24, 24]} />
        <meshStandardMaterial color="#f8f8f8" roughness={0.1} />
      </mesh>
      <mesh position={[eyeX, 0.02, 0.115]} rotation={[0, 0, -eyeTilt]}>
        <sphereGeometry args={[eyeWhiteSize, 24, 24]} />
        <meshStandardMaterial color="#f8f8f8" roughness={0.1} />
      </mesh>

      {/* Iris - with depth */}
      <mesh position={[-eyeX, 0.02, 0.132]} rotation={[0, 0, eyeTilt]}>
        <sphereGeometry args={[baseEyeSize, 24, 24]} />
        <meshStandardMaterial color={eyeColor} roughness={0.3} />
      </mesh>
      <mesh position={[eyeX, 0.02, 0.132]} rotation={[0, 0, -eyeTilt]}>
        <sphereGeometry args={[baseEyeSize, 24, 24]} />
        <meshStandardMaterial color={eyeColor} roughness={0.3} />
      </mesh>

      {/* Pupils */}
      <mesh position={[-eyeX, 0.02, 0.142]}>
        <sphereGeometry args={[baseEyeSize * 0.45, 16, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} />
      </mesh>
      <mesh position={[eyeX, 0.02, 0.142]}>
        <sphereGeometry args={[baseEyeSize * 0.45, 16, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.1} />
      </mesh>

      {/* Eye highlights - glossy */}
      <mesh position={[-eyeX - 0.004, 0.025, 0.145]}>
        <sphereGeometry args={[0.004, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[eyeX - 0.004, 0.025, 0.145]}>
        <sphereGeometry args={[0.004, 8, 8]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
      </mesh>

      {/* Upper Eyelids */}
      <mesh position={[-eyeX, 0.035, 0.12]} rotation={[0.3, 0, eyeTilt]}>
        <boxGeometry args={[0.035, 0.008, 0.02]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>
      <mesh position={[eyeX, 0.035, 0.12]} rotation={[0.3, 0, -eyeTilt]}>
        <boxGeometry args={[0.035, 0.008, 0.02]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Lower Eyelids */}
      <mesh position={[-eyeX, 0.005, 0.12]} rotation={[-0.2, 0, eyeTilt]}>
        <boxGeometry args={[0.03, 0.005, 0.015]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>
      <mesh position={[eyeX, 0.005, 0.12]} rotation={[-0.2, 0, -eyeTilt]}>
        <boxGeometry args={[0.03, 0.005, 0.015]} />
        <meshStandardMaterial color={skinColor} roughness={0.6} />
      </mesh>

      {/* Enhanced Eyebrows with arch */}
      <group position={[-eyeX, 0.052, 0.12]}>
        <mesh rotation={[0, 0, eyebrowDims.arch + eyeTilt]}>
          <boxGeometry args={[eyebrowDims.width, eyebrowDims.height, eyebrowDims.depth]} />
          <meshStandardMaterial color={eyebrowColor} roughness={0.9} />
        </mesh>
        {/* Eyebrow hair texture */}
        {[...Array(5)].map((_, i) => (
          <mesh
            key={`left-brow-${i}`}
            position={[
              -eyebrowDims.width / 2 + (eyebrowDims.width / 4) * i,
              eyebrowDims.height / 2,
              0
            ]}
            rotation={[0, 0, -0.2 + i * 0.1]}
          >
            <boxGeometry args={[0.002, eyebrowDims.height * 0.8, 0.004]} />
            <meshStandardMaterial color={eyebrowColor} />
          </mesh>
        ))}
      </group>
      <group position={[eyeX, 0.052, 0.12]}>
        <mesh rotation={[0, 0, -eyebrowDims.arch - eyeTilt]}>
          <boxGeometry args={[eyebrowDims.width, eyebrowDims.height, eyebrowDims.depth]} />
          <meshStandardMaterial color={eyebrowColor} roughness={0.9} />
        </mesh>
        {[...Array(5)].map((_, i) => (
          <mesh
            key={`right-brow-${i}`}
            position={[
              -eyebrowDims.width / 2 + (eyebrowDims.width / 4) * i,
              eyebrowDims.height / 2,
              0
            ]}
            rotation={[0, 0, 0.2 - i * 0.1]}
          >
            <boxGeometry args={[0.002, eyebrowDims.height * 0.8, 0.004]} />
            <meshStandardMaterial color={eyebrowColor} />
          </mesh>
        ))}
      </group>

      {/* Enhanced Nose Structure */}
      <group position={[0, -0.01, 0.12]}>
        {/* Nose bridge */}
        <mesh position={[0, 0.02 + noseBridge * 0.015, -0.02]}>
          <boxGeometry args={[0.018, 0.03, 0.025]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        {/* Nose tip - rounder */}
        <mesh position={[0, -0.01, 0.01]}>
          <sphereGeometry args={[0.018 * noseWidth, 16, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        {/* Nose sides */}
        <mesh position={[-0.015 * noseWidth, -0.005, -0.005]} rotation={[0, 0.3, 0]}>
          <sphereGeometry args={[0.012, 12, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        <mesh position={[0.015 * noseWidth, -0.005, -0.005]} rotation={[0, -0.3, 0]}>
          <sphereGeometry args={[0.012, 12, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        {/* Nostrils - darker recessed */}
        <mesh position={[-0.01 * noseWidth, -0.018, 0.005]}>
          <sphereGeometry args={[0.006, 8, 8]} />
          <meshStandardMaterial color="#2a1515" roughness={0.9} />
        </mesh>
        <mesh position={[0.01 * noseWidth, -0.018, 0.005]}>
          <sphereGeometry args={[0.006, 8, 8]} />
          <meshStandardMaterial color="#2a1515" roughness={0.9} />
        </mesh>
      </group>

      {/* Enhanced Mouth */}
      <group position={[0, -0.055, 0.11]}>
        {mouthState.open ? (
          // Open mouth for singing
          <>
            <mesh>
              <cylinderGeometry args={[0.022 * mouthState.width, 0.018 * mouthState.width, mouthState.height, 16]} />
              <meshStandardMaterial color="#1a0808" roughness={0.9} />
            </mesh>
            {/* Upper lip */}
            <mesh position={[0, mouthState.height / 2 + 0.003, 0.008]}>
              <boxGeometry args={[0.05 * mouthState.width, 0.006 * lipFullness, 0.015]} />
              <meshStandardMaterial color={lipColor} roughness={0.4} />
            </mesh>
            {/* Lower lip */}
            <mesh position={[0, -mouthState.height / 2 - 0.004, 0.01]}>
              <boxGeometry args={[0.045 * mouthState.width, 0.008 * lipFullness, 0.018]} />
              <meshStandardMaterial color={lipColor} roughness={0.4} />
            </mesh>
            {/* Teeth */}
            <mesh position={[0, 0.006, 0.012]}>
              <boxGeometry args={[0.03, 0.006, 0.006]} />
              <meshStandardMaterial color="#f5f5f0" roughness={0.2} />
            </mesh>
            {/* Tongue hint */}
            <mesh position={[0, -0.005, 0.005]}>
              <sphereGeometry args={[0.012, 8, 8]} />
              <meshStandardMaterial color="#c45555" roughness={0.6} />
            </mesh>
          </>
        ) : (
          // Closed mouth with detailed lips
          <>
            {/* Upper lip with cupid's bow */}
            <mesh position={[0, 0.004, 0.01]}>
              <boxGeometry args={[0.052 * mouthState.width, 0.007 * lipFullness, 0.014]} />
              <meshStandardMaterial color={lipColor} roughness={0.35} />
            </mesh>
            {/* Upper lip detail - cupid's bow */}
            <mesh position={[0, 0.008, 0.015]}>
              <sphereGeometry args={[0.008 * lipFullness, 8, 8]} />
              <meshStandardMaterial color={lipColor} roughness={0.35} />
            </mesh>
            {/* Lower lip - fuller */}
            <mesh position={[0, -0.006, 0.012]}>
              <boxGeometry args={[0.048 * mouthState.width, 0.009 * lipFullness, 0.016]} />
              <meshStandardMaterial color={lipColor} roughness={0.35} />
            </mesh>
            {/* Lip crease */}
            <mesh position={[0, 0, 0.018]}>
              <boxGeometry args={[0.045 * mouthState.width, 0.002, 0.004]} />
              <meshStandardMaterial color="#3a1818" roughness={0.8} />
            </mesh>
            {/* Corner shadows */}
            <mesh position={[-0.028 * mouthState.width, 0, 0.008]}>
              <sphereGeometry args={[0.004, 6, 6]} />
              <meshStandardMaterial color={skinColor} roughness={0.7} />
            </mesh>
            <mesh position={[0.028 * mouthState.width, 0, 0.008]}>
              <sphereGeometry args={[0.004, 6, 6]} />
              <meshStandardMaterial color={skinColor} roughness={0.7} />
            </mesh>
          </>
        )}
      </group>

      {/* Cheekbones */}
      <mesh position={[-0.09 * cheekScale, 0.01, 0.05]}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>
      <mesh position={[0.09 * cheekScale, 0.01, 0.05]}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>

      {/* Chin */}
      <mesh position={[0, -0.1 * chinScale, 0.08]}>
        <sphereGeometry args={[0.03 * chinScale, 12, 12]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>

      {/* Enhanced Ears */}
      <group position={[-0.145, 0.01, 0]} rotation={[0, earAngle * 0.3, 0]}>
        {/* Outer ear */}
        <mesh>
          <capsuleGeometry args={[0.022 * earSize, 0.03 * earSize, 8, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        {/* Inner ear hollow */}
        <mesh position={[0.008, 0, 0.005]}>
          <capsuleGeometry args={[0.012 * earSize, 0.018 * earSize, 6, 8]} />
          <meshStandardMaterial color={skinColor} roughness={0.8} />
        </mesh>
        {/* Earlobe */}
        <mesh position={[0.005, -0.025 * earSize, 0]}>
          <sphereGeometry args={[0.01 * earSize, 8, 8]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
      </group>
      <group position={[0.145, 0.01, 0]} rotation={[0, -earAngle * 0.3, 0]}>
        <mesh>
          <capsuleGeometry args={[0.022 * earSize, 0.03 * earSize, 8, 12]} />
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </mesh>
        <mesh position={[-0.008, 0, 0.005]}>
          <capsuleGeometry args={[0.012 * earSize, 0.018 * earSize, 6, 8]} />
          <meshStandardMaterial color={skinColor} roughness={0.8} />
        </mesh>
        <mesh position={[-0.005, -0.025 * earSize, 0]}>
          <sphereGeometry args={[0.01 * earSize, 8, 8]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
      </group>
    </group>
  );
};
