import { useMemo } from "react";

interface CharacterHairProps {
  hairType: 'short-spiky' | 'long-straight' | 'mohawk' | 'bald' | 'ponytail' | 'curly' | 'rocker' | 'messy' | 'undercut' | 'dreadlocks' | 'braids' | 'buzzcut' | 'afro' | 'slickedback' | 'topheavy';
  color: string;
  seed?: number;
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
        
      case 'buzzcut':
        return (
          <mesh position={[0, 0.12, 0]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
        
      case 'short-spiky':
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
            {/* Side strands */}
            <mesh position={[-0.1, -0.05, 0]} rotation={[0, 0, 0.2]}>
              <capsuleGeometry args={[0.03, 0.2, 2, 4]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh position={[0.1, -0.05, 0]} rotation={[0, 0, -0.2]}>
              <capsuleGeometry args={[0.03, 0.2, 2, 4]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
        
      case 'mohawk':
        return (
          <group>
            {Array.from({ length: 5 }).map((_, i) => (
              <mesh key={i} position={[0, 0.15 + i * 0.03, -0.08 + i * 0.04]} rotation={[0.3, 0, 0]}>
                <coneGeometry args={[0.025, 0.12, 4]} />
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
              <capsuleGeometry args={[0.04, 0.25, 2, 4]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
        
      case 'curly':
        return (
          <group>
            {Array.from({ length: 10 }).map((_, i) => {
              const angle = (i / 10) * Math.PI * 2;
              const radius = 0.1;
              const x = Math.cos(angle) * radius;
              const z = Math.sin(angle) * radius;
              const y = 0.12 + (seededRandom(seed + i) - 0.5) * 0.06;
              return (
                <mesh key={i} position={[x, y, z]}>
                  <sphereGeometry args={[0.035, 4, 4]} />
                  <meshBasicMaterial color={color} />
                </mesh>
              );
            })}
          </group>
        );
        
      case 'afro':
        return (
          <group>
            <mesh position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.18, 8, 8]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
        
      case 'rocker':
        return (
          <group>
            {[-0.06, -0.02, 0.02, 0.06].map((x, i) => (
              <mesh key={i} position={[x, 0, -0.1]} rotation={[0.6, 0, 0]}>
                <capsuleGeometry args={[0.02, 0.35, 2, 4]} />
                <meshBasicMaterial color={color} />
              </mesh>
            ))}
          </group>
        );
        
      case 'messy':
        return (
          <group>
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const x = Math.cos(angle) * 0.09;
              const z = Math.sin(angle) * 0.09;
              const randomRot: [number, number, number] = [
                seededRandom(seed + i * 3) * 0.6,
                seededRandom(seed + i * 5) * Math.PI * 2,
                seededRandom(seed + i * 7) * 0.6
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
        
      case 'undercut':
        return (
          <group>
            {/* Short sides */}
            <mesh position={[0, 0.08, 0]}>
              <sphereGeometry args={[0.135, 6, 6]} />
              <meshBasicMaterial color={color} />
            </mesh>
            {/* Longer top */}
            <mesh position={[0, 0.16, 0.02]} rotation={[0.3, 0, 0]}>
              <boxGeometry args={[0.1, 0.08, 0.12]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
        
      case 'dreadlocks':
        return (
          <group>
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const x = Math.cos(angle) * 0.08;
              const z = Math.sin(angle) * 0.08;
              return (
                <mesh key={i} position={[x, 0.05, z]} rotation={[(seededRandom(seed + i) - 0.5) * 0.5, 0, (seededRandom(seed + i * 2) - 0.5) * 0.4]}>
                  <capsuleGeometry args={[0.02, 0.2 + seededRandom(seed + i * 3) * 0.1, 2, 4]} />
                  <meshBasicMaterial color={color} />
                </mesh>
              );
            })}
          </group>
        );
        
      case 'braids':
        return (
          <group>
            {[-0.06, 0, 0.06].map((x, i) => (
              <mesh key={i} position={[x, 0.05, -0.08]} rotation={[0.4, 0, 0]}>
                <capsuleGeometry args={[0.025, 0.25, 2, 4]} />
                <meshBasicMaterial color={color} />
              </mesh>
            ))}
            <mesh position={[0, 0.14, 0]}>
              <sphereGeometry args={[0.1, 6, 6]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
        
      case 'slickedback':
        return (
          <group>
            <mesh position={[0, 0.1, -0.05]} rotation={[-0.3, 0, 0]}>
              <capsuleGeometry args={[0.1, 0.15, 3, 6]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
        
      case 'topheavy':
        return (
          <group>
            <mesh position={[0, 0.18, 0]}>
              <boxGeometry args={[0.14, 0.12, 0.12]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
        
      default:
        return null;
    }
  }, [hairType, color, seed]);

  return <group position={[0, 0.15, 0]}>{hairElements}</group>;
};
