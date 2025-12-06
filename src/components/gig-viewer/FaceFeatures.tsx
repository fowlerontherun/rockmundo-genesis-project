interface FaceFeaturesProps {
  skinColor: string;
  expression?: 'neutral' | 'happy' | 'singing' | 'intense';
}

export const FaceFeatures = ({ skinColor, expression = 'neutral' }: FaceFeaturesProps) => {
  const mouthOpen = expression === 'singing' ? 0.02 : 0.008;
  const mouthWidth = expression === 'singing' ? 0.04 : 0.05;
  const eyebrowHeight = expression === 'intense' ? 0.045 : 0.04;
  const eyeSize = expression === 'intense' ? 0.018 : 0.015;
  
  // Eye white color
  const eyeWhiteColor = '#f0f0f0';
  const eyeColor = '#2d1a0a';
  const mouthColor = expression === 'singing' ? '#2a0505' : '#6b3030';
  
  return (
    <group>
      {/* Eye whites */}
      <mesh position={[-0.04, 0.02, 0.12]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color={eyeWhiteColor} />
      </mesh>
      <mesh position={[0.04, 0.02, 0.12]}>
        <sphereGeometry args={[0.022, 8, 8]} />
        <meshStandardMaterial color={eyeWhiteColor} />
      </mesh>

      {/* Pupils/Iris */}
      <mesh position={[-0.04, 0.02, 0.135]}>
        <sphereGeometry args={[eyeSize, 8, 8]} />
        <meshStandardMaterial color={eyeColor} />
      </mesh>
      <mesh position={[0.04, 0.02, 0.135]}>
        <sphereGeometry args={[eyeSize, 8, 8]} />
        <meshStandardMaterial color={eyeColor} />
      </mesh>

      {/* Eyebrows */}
      <mesh position={[-0.04, eyebrowHeight, 0.13]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.035, 0.008, 0.01]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.04, eyebrowHeight, 0.13]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.035, 0.008, 0.01]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      
      {/* Nose - more detailed */}
      <group position={[0, -0.01, 0.13]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.015, 0.035, 4]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
        {/* Nostrils */}
        <mesh position={[-0.008, -0.015, 0.01]}>
          <sphereGeometry args={[0.005, 4, 4]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.008, -0.015, 0.01]}>
          <sphereGeometry args={[0.005, 4, 4]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
      
      {/* Mouth - more expressive */}
      {expression === 'singing' ? (
        // Open mouth for singing
        <group position={[0, -0.05, 0.12]}>
          <mesh>
            <cylinderGeometry args={[0.02, 0.015, 0.015, 8]} />
            <meshStandardMaterial color={mouthColor} />
          </mesh>
          {/* Teeth hint */}
          <mesh position={[0, 0.005, 0.008]}>
            <boxGeometry args={[0.025, 0.005, 0.005]} />
            <meshStandardMaterial color="#f0f0f0" />
          </mesh>
        </group>
      ) : (
        // Closed mouth
        <mesh position={[0, -0.05, 0.13]}>
          <boxGeometry args={[mouthWidth, mouthOpen, 0.01]} />
          <meshStandardMaterial color={mouthColor} />
        </mesh>
      )}

      {/* Ears */}
      <mesh position={[-0.14, 0.01, 0]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      <mesh position={[0.14, 0.01, 0]}>
        <sphereGeometry args={[0.025, 6, 6]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
    </group>
  );
};
