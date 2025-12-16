interface FaceFeaturesProps {
  skinColor: string;
  expression?: 'neutral' | 'happy' | 'singing' | 'intense';
  // Eye customization
  eyeColor?: string;
  eyeSize?: number;
  eyeSpacing?: number;
  eyeTilt?: number;
  // Eyebrow customization
  eyebrowStyle?: 'thin' | 'normal' | 'thick' | 'arched' | 'straight';
  eyebrowColor?: string;
  eyebrowThickness?: number;
  // Nose customization
  noseWidth?: number;
  noseLength?: number;
  noseBridge?: number;
  // Mouth customization
  lipFullness?: number;
  lipWidth?: number;
  lipColor?: string;
  // Ear customization
  earSize?: number;
  earAngle?: number;
  // Face structure
  faceWidth?: number;
  faceLength?: number;
  jawShape?: 'round' | 'square' | 'pointed' | 'oval';
  cheekbone?: number;
  chinProminence?: number;
}

export const FaceFeatures = ({ 
  skinColor, 
  expression = 'neutral',
  // Eyes
  eyeColor = '#2d1a0a',
  eyeSize = 1.0,
  eyeSpacing = 1.0,
  eyeTilt = 0,
  // Eyebrows
  eyebrowStyle = 'normal',
  eyebrowColor = '#1a1a1a',
  eyebrowThickness = 1.0,
  // Nose
  noseWidth = 1.0,
  noseLength = 1.0,
  noseBridge = 0.5,
  // Mouth
  lipFullness = 1.0,
  lipWidth = 1.0,
  lipColor = '#c4777f',
  // Ears
  earSize = 1.0,
  earAngle = 0,
  // Face structure (passed but used in parent for head shape)
  faceWidth = 1.0,
  faceLength = 1.0,
}: FaceFeaturesProps) => {
  // Expression-based adjustments
  const mouthOpen = expression === 'singing' ? 0.02 : 0.008;
  const eyebrowHeight = expression === 'intense' ? 0.045 : 0.04;
  const eyeSizeMultiplier = expression === 'intense' ? 1.2 : 1.0;
  
  // Eye white color
  const eyeWhiteColor = '#f0f0f0';
  const mouthColor = expression === 'singing' ? '#2a0505' : lipColor;
  
  // Calculate positions based on spacing
  const eyeX = 0.04 * eyeSpacing;
  const baseEyeSize = 0.015 * eyeSize * eyeSizeMultiplier;
  const eyeWhiteSize = 0.022 * eyeSize;
  
  // Eyebrow dimensions based on style
  const getEyebrowDimensions = () => {
    const baseWidth = 0.035;
    const baseHeight = 0.008 * eyebrowThickness;
    switch (eyebrowStyle) {
      case 'thin': return { width: baseWidth * 0.8, height: baseHeight * 0.6 };
      case 'thick': return { width: baseWidth * 1.1, height: baseHeight * 1.5 };
      case 'arched': return { width: baseWidth, height: baseHeight, rotation: 0.2 };
      case 'straight': return { width: baseWidth * 1.1, height: baseHeight, rotation: 0 };
      default: return { width: baseWidth, height: baseHeight, rotation: 0.1 };
    }
  };
  
  const eyebrowDims = getEyebrowDimensions();
  const eyebrowRotation = eyebrowDims.rotation ?? 0.1;
  
  // Nose dimensions
  const noseBaseWidth = 0.015 * noseWidth;
  const noseBaseLength = 0.035 * noseLength;
  const noseBridgeHeight = 0.01 + noseBridge * 0.01;
  
  // Mouth dimensions
  const mouthWidth = 0.05 * lipWidth;
  const mouthHeight = expression === 'singing' ? 0.015 * lipFullness : mouthOpen * lipFullness;
  
  // Ear dimensions
  const earBaseSize = 0.025 * earSize;
  
  return (
    <group>
      {/* Eye whites */}
      <mesh position={[-eyeX, 0.02, 0.12]} rotation={[0, 0, eyeTilt]}>
        <sphereGeometry args={[eyeWhiteSize, 12, 12]} />
        <meshStandardMaterial color={eyeWhiteColor} />
      </mesh>
      <mesh position={[eyeX, 0.02, 0.12]} rotation={[0, 0, -eyeTilt]}>
        <sphereGeometry args={[eyeWhiteSize, 12, 12]} />
        <meshStandardMaterial color={eyeWhiteColor} />
      </mesh>

      {/* Iris/Pupils */}
      <mesh position={[-eyeX, 0.02, 0.135]} rotation={[0, 0, eyeTilt]}>
        <sphereGeometry args={[baseEyeSize, 12, 12]} />
        <meshStandardMaterial color={eyeColor} />
      </mesh>
      <mesh position={[eyeX, 0.02, 0.135]} rotation={[0, 0, -eyeTilt]}>
        <sphereGeometry args={[baseEyeSize, 12, 12]} />
        <meshStandardMaterial color={eyeColor} />
      </mesh>
      
      {/* Pupil highlights */}
      <mesh position={[-eyeX - 0.003, 0.023, 0.14]}>
        <sphereGeometry args={[0.003, 6, 6]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <mesh position={[eyeX - 0.003, 0.023, 0.14]}>
        <sphereGeometry args={[0.003, 6, 6]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {/* Eyebrows */}
      <mesh 
        position={[-eyeX, eyebrowHeight, 0.13]} 
        rotation={[0, 0, eyebrowRotation + eyeTilt]}
      >
        <boxGeometry args={[eyebrowDims.width, eyebrowDims.height, 0.01]} />
        <meshStandardMaterial color={eyebrowColor} />
      </mesh>
      <mesh 
        position={[eyeX, eyebrowHeight, 0.13]} 
        rotation={[0, 0, -eyebrowRotation - eyeTilt]}
      >
        <boxGeometry args={[eyebrowDims.width, eyebrowDims.height, 0.01]} />
        <meshStandardMaterial color={eyebrowColor} />
      </mesh>
      
      {/* Nose */}
      <group position={[0, -0.01, 0.13]}>
        {/* Nose bridge */}
        <mesh position={[0, noseBridgeHeight, -0.01]}>
          <boxGeometry args={[0.015, 0.02, 0.015]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
        {/* Nose tip */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[noseBaseWidth, noseBaseLength, 6]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
        {/* Nostrils */}
        <mesh position={[-0.008 * noseWidth, -0.015, 0.01]}>
          <sphereGeometry args={[0.005, 6, 6]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.008 * noseWidth, -0.015, 0.01]}>
          <sphereGeometry args={[0.005, 6, 6]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
      
      {/* Mouth */}
      {expression === 'singing' ? (
        // Open mouth for singing
        <group position={[0, -0.05, 0.12]}>
          <mesh>
            <cylinderGeometry args={[0.02 * lipWidth, 0.015 * lipWidth, 0.015 * lipFullness, 8]} />
            <meshStandardMaterial color="#2a0505" />
          </mesh>
          {/* Upper lip */}
          <mesh position={[0, 0.01, 0.005]}>
            <boxGeometry args={[mouthWidth * 0.8, 0.005 * lipFullness, 0.01]} />
            <meshStandardMaterial color={lipColor} />
          </mesh>
          {/* Lower lip */}
          <mesh position={[0, -0.008, 0.008]}>
            <boxGeometry args={[mouthWidth * 0.7, 0.006 * lipFullness, 0.01]} />
            <meshStandardMaterial color={lipColor} />
          </mesh>
          {/* Teeth hint */}
          <mesh position={[0, 0.005, 0.008]}>
            <boxGeometry args={[0.025, 0.005, 0.005]} />
            <meshStandardMaterial color="#f0f0f0" />
          </mesh>
        </group>
      ) : (
        // Closed mouth with lips
        <group position={[0, -0.05, 0.13]}>
          {/* Upper lip */}
          <mesh position={[0, 0.003, 0]}>
            <boxGeometry args={[mouthWidth, 0.006 * lipFullness, 0.01]} />
            <meshStandardMaterial color={lipColor} />
          </mesh>
          {/* Lower lip */}
          <mesh position={[0, -0.004, 0.002]}>
            <boxGeometry args={[mouthWidth * 0.85, 0.007 * lipFullness, 0.012]} />
            <meshStandardMaterial color={lipColor} />
          </mesh>
          {/* Mouth line */}
          <mesh position={[0, 0, 0.005]}>
            <boxGeometry args={[mouthWidth * 0.9, 0.002, 0.005]} />
            <meshStandardMaterial color="#4a2020" />
          </mesh>
        </group>
      )}

      {/* Ears */}
      <mesh 
        position={[-0.14, 0.01, 0]} 
        rotation={[0, earAngle, 0]}
      >
        <sphereGeometry args={[earBaseSize, 8, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      <mesh 
        position={[0.14, 0.01, 0]} 
        rotation={[0, -earAngle, 0]}
      >
        <sphereGeometry args={[earBaseSize, 8, 8]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      
      {/* Ear details - inner ear */}
      <mesh 
        position={[-0.138, 0.01, 0.01]} 
        rotation={[0, earAngle, 0]}
      >
        <sphereGeometry args={[earBaseSize * 0.5, 6, 6]} />
        <meshStandardMaterial color={skinColor} roughness={0.8} />
      </mesh>
      <mesh 
        position={[0.138, 0.01, 0.01]} 
        rotation={[0, -earAngle, 0]}
      >
        <sphereGeometry args={[earBaseSize * 0.5, 6, 6]} />
        <meshStandardMaterial color={skinColor} roughness={0.8} />
      </mesh>
    </group>
  );
};