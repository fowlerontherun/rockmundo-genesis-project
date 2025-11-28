interface FaceFeaturesProps {
  skinColor: string;
  expression?: 'neutral' | 'happy' | 'singing' | 'intense';
}

export const FaceFeatures = ({ skinColor, expression = 'neutral' }: FaceFeaturesProps) => {
  const mouthRotation = expression === 'singing' ? 0.3 : 0;
  const eyeSize = expression === 'intense' ? 0.02 : 0.015;
  
  return (
    <group>
      {/* Eyes */}
      <mesh position={[-0.04, 0.02, 0.13]}>
        <sphereGeometry args={[eyeSize, 6, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.04, 0.02, 0.13]}>
        <sphereGeometry args={[eyeSize, 6, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      
      {/* Nose */}
      <mesh position={[0, -0.01, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.015, 0.03, 4]} />
        <meshStandardMaterial color={skinColor} />
      </mesh>
      
      {/* Mouth */}
      <mesh position={[0, -0.05, 0.13]} rotation={[mouthRotation, 0, 0]}>
        <boxGeometry args={[0.05, 0.008, 0.01]} />
        <meshStandardMaterial color="#8b0000" />
      </mesh>
    </group>
  );
};