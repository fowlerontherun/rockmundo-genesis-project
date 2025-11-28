import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

export const StageFloor = () => {
  const floorRef = useRef<Mesh>(null);

  // Subtle pulsing effect
  useFrame(({ clock }) => {
    if (!floorRef.current) return;
    
    const time = clock.getElapsedTime();
    const intensity = 0.1 + Math.sin(time * 0.5) * 0.05;
    
    // @ts-ignore - accessing material property
    if (floorRef.current.material) {
      // @ts-ignore
      floorRef.current.material.emissiveIntensity = intensity;
    }
  });

  return (
    <>
      {/* Main floor */}
      <mesh ref={floorRef} position={[0, 0, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial 
          color="#0a0a0a"
          emissive="#1a0033"
          emissiveIntensity={0.1}
          roughness={0.8}
          metalness={0.2}
        />
      </mesh>
      
      {/* Stage platform */}
      <mesh position={[0, 0.05, -5]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial 
          color="#1a1a1a"
          emissive="#330066"
          emissiveIntensity={0.15}
          roughness={0.6}
          metalness={0.4}
        />
      </mesh>
    </>
  );
};
