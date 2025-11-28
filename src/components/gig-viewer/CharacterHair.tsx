import { useMemo } from "react";

interface CharacterHairProps {
  hairType: 'short-spiky' | 'long-straight' | 'mohawk' | 'bald' | 'ponytail' | 'curly' | 'rocker' | 'messy';
  color: string;
}

export const CharacterHair = ({ hairType, color }: CharacterHairProps) => {
  const hairElements = useMemo(() => {
    switch (hairType) {
      case 'bald':
        return null;
        
      case 'short-spiky':
        // Multiple thin cones arranged on head
        return (
          <group>
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              const x = Math.cos(angle) * 0.08;
              const z = Math.sin(angle) * 0.08;
              return (
                <mesh key={i} position={[x, 0.18, z]} rotation={[0, 0, 0]}>
                  <coneGeometry args={[0.02, 0.08, 4]} />
                  <meshStandardMaterial color={color} />
                </mesh>
              );
            })}
          </group>
        );
        
      case 'long-straight':
        // Capsule geometry hanging down
        return (
          <group>
            <mesh position={[0, 0.05, -0.05]}>
              <capsuleGeometry args={[0.1, 0.25, 6, 12]} />
              <meshStandardMaterial color={color} />
            </mesh>
          </group>
        );
        
      case 'mohawk':
        // Vertical strip of triangles
        return (
          <group>
            {Array.from({ length: 6 }).map((_, i) => (
              <mesh key={i} position={[0, 0.15 + i * 0.03, -0.08 + i * 0.03]} rotation={[0.3, 0, 0]}>
                <coneGeometry args={[0.03, 0.1, 3]} />
                <meshStandardMaterial color={color} />
              </mesh>
            ))}
          </group>
        );
        
      case 'ponytail':
        // Sphere on head + trailing capsule
        return (
          <group>
            <mesh position={[0, 0.15, -0.1]}>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <mesh position={[0, 0, -0.2]} rotation={[0.5, 0, 0]}>
              <capsuleGeometry args={[0.04, 0.2, 4, 8]} />
              <meshStandardMaterial color={color} />
            </mesh>
          </group>
        );
        
      case 'curly':
        // Multiple small spheres clustered
        return (
          <group>
            {Array.from({ length: 16 }).map((_, i) => {
              const angle = (i / 16) * Math.PI * 2;
              const radius = 0.1;
              const x = Math.cos(angle) * radius;
              const z = Math.sin(angle) * radius;
              const y = 0.12 + (Math.random() - 0.5) * 0.06;
              return (
                <mesh key={i} position={[x, y, z]}>
                  <sphereGeometry args={[0.03, 6, 6]} />
                  <meshStandardMaterial color={color} />
                </mesh>
              );
            })}
          </group>
        );
        
      case 'rocker':
        // Long flowing hair with capsules
        return (
          <group>
            {[-0.06, -0.03, 0, 0.03, 0.06].map((x, i) => (
              <mesh key={i} position={[x, 0, -0.1]} rotation={[0.6, 0, 0]}>
                <capsuleGeometry args={[0.025, 0.3, 4, 8]} />
                <meshStandardMaterial color={color} />
              </mesh>
            ))}
          </group>
        );
        
      case 'messy':
        // Randomized capsule arrangement
        return (
          <group>
            {Array.from({ length: 10 }).map((_, i) => {
              const angle = (i / 10) * Math.PI * 2;
              const x = Math.cos(angle) * 0.09;
              const z = Math.sin(angle) * 0.09;
              const randomRot = [
                Math.random() * 0.5,
                Math.random() * Math.PI * 2,
                Math.random() * 0.5
              ];
              return (
                <mesh key={i} position={[x, 0.14, z]} rotation={randomRot as [number, number, number]}>
                  <capsuleGeometry args={[0.02, 0.12, 3, 6]} />
                  <meshStandardMaterial color={color} />
                </mesh>
              );
            })}
          </group>
        );
    }
  }, [hairType, color]);

  return <group position={[0, 0.15, 0]}>{hairElements}</group>;
};