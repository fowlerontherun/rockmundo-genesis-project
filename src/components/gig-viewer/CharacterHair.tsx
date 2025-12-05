import { useMemo } from "react";

interface CharacterHairProps {
  hairType: 'short-spiky' | 'long-straight' | 'mohawk' | 'bald' | 'ponytail' | 'curly' | 'rocker' | 'messy';
  color: string;
  seed?: number; // Optional seed for deterministic randomness
}

// Seeded random for deterministic values
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const CharacterHair = ({ hairType, color, seed = 0.5 }: CharacterHairProps) => {
  const hairElements = useMemo(() => {
    switch (hairType) {
      case 'bald':
        return null;
        
      case 'short-spiky':
        // Reduced from 12 to 8 spikes
        return (
          <group>
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const x = Math.cos(angle) * 0.08;
              const z = Math.sin(angle) * 0.08;
              return (
                <mesh key={i} position={[x, 0.18, z]}>
                  <coneGeometry args={[0.02, 0.08, 3]} />
                  <meshBasicMaterial color={color} />
                </mesh>
              );
            })}
          </group>
        );
        
      case 'long-straight':
        return (
          <group>
            <mesh position={[0, 0.05, -0.05]}>
              <capsuleGeometry args={[0.1, 0.25, 3, 6]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
        
      case 'mohawk':
        // Reduced from 6 to 4 pieces
        return (
          <group>
            {Array.from({ length: 4 }).map((_, i) => (
              <mesh key={i} position={[0, 0.15 + i * 0.04, -0.08 + i * 0.04]} rotation={[0.3, 0, 0]}>
                <coneGeometry args={[0.03, 0.1, 3]} />
                <meshBasicMaterial color={color} />
              </mesh>
            ))}
          </group>
        );
        
      case 'ponytail':
        return (
          <group>
            <mesh position={[0, 0.15, -0.1]}>
              <sphereGeometry args={[0.08, 4, 4]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh position={[0, 0, -0.2]} rotation={[0.5, 0, 0]}>
              <capsuleGeometry args={[0.04, 0.2, 2, 4]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
        
      case 'curly':
        // Reduced from 16 to 8 spheres, deterministic positions
        return (
          <group>
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const radius = 0.1;
              const x = Math.cos(angle) * radius;
              const z = Math.sin(angle) * radius;
              const y = 0.12 + (seededRandom(seed + i) - 0.5) * 0.06;
              return (
                <mesh key={i} position={[x, y, z]}>
                  <sphereGeometry args={[0.03, 4, 4]} />
                  <meshBasicMaterial color={color} />
                </mesh>
              );
            })}
          </group>
        );
        
      case 'rocker':
        // Reduced from 5 to 3 strands
        return (
          <group>
            {[-0.04, 0, 0.04].map((x, i) => (
              <mesh key={i} position={[x, 0, -0.1]} rotation={[0.6, 0, 0]}>
                <capsuleGeometry args={[0.025, 0.3, 2, 4]} />
                <meshBasicMaterial color={color} />
              </mesh>
            ))}
          </group>
        );
        
      case 'messy':
        // Reduced from 10 to 6, deterministic rotations
        return (
          <group>
            {Array.from({ length: 6 }).map((_, i) => {
              const angle = (i / 6) * Math.PI * 2;
              const x = Math.cos(angle) * 0.09;
              const z = Math.sin(angle) * 0.09;
              const randomRot: [number, number, number] = [
                seededRandom(seed + i * 3) * 0.5,
                seededRandom(seed + i * 5) * Math.PI * 2,
                seededRandom(seed + i * 7) * 0.5
              ];
              return (
                <mesh key={i} position={[x, 0.14, z]} rotation={randomRot}>
                  <capsuleGeometry args={[0.02, 0.12, 2, 4]} />
                  <meshBasicMaterial color={color} />
                </mesh>
              );
            })}
          </group>
        );
    }
  }, [hairType, color, seed]);

  return <group position={[0, 0.15, 0]}>{hairElements}</group>;
};
