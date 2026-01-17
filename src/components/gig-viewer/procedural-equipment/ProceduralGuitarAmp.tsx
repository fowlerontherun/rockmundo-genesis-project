import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ProceduralGuitarAmpProps {
  position?: [number, number, number];
  scale?: number;
  intensity?: number;
  isActive?: boolean;
}

export const ProceduralGuitarAmp = ({ 
  position = [0, 0, 0], 
  scale = 1,
  intensity = 0.5,
  isActive = true
}: ProceduralGuitarAmpProps) => {
  const ledRef = useRef<THREE.PointLight>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  // Animate LED glow based on intensity
  useFrame((state) => {
    if (ledRef.current && isActive) {
      ledRef.current.intensity = 0.5 + Math.sin(state.clock.elapsedTime * 4) * 0.3 * intensity;
    }
    // Subtle vibration during high intensity
    if (groupRef.current && intensity > 0.7) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 20) * 0.002 * intensity;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Main cabinet body */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.8, 0.8, 0.4]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>
      
      {/* Speaker grille */}
      <mesh position={[0, 0.4, 0.21]}>
        <planeGeometry args={[0.7, 0.7]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
      </mesh>
      
      {/* Grille mesh pattern */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={`h-${i}`} position={[-0.3 + i * 0.086, 0.4, 0.215]}>
          <boxGeometry args={[0.01, 0.65, 0.01]} />
          <meshStandardMaterial color="#3a3a3a" />
        </mesh>
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={`v-${i}`} position={[0, 0.08 + i * 0.086, 0.215]}>
          <boxGeometry args={[0.65, 0.01, 0.01]} />
          <meshStandardMaterial color="#3a3a3a" />
        </mesh>
      ))}
      
      {/* Top head unit */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[0.85, 0.25, 0.35]} />
        <meshStandardMaterial color="#1f1f1f" roughness={0.7} />
      </mesh>
      
      {/* Control panel (top front) */}
      <mesh position={[0, 1.0, 0.16]}>
        <planeGeometry args={[0.75, 0.12]} />
        <meshStandardMaterial color="#111111" metalness={0.3} roughness={0.5} />
      </mesh>
      
      {/* Knobs */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={`knob-${i}`} position={[-0.28 + i * 0.14, 1.0, 0.175]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.03, 16]} />
          <meshStandardMaterial color="#444444" metalness={0.5} />
        </mesh>
      ))}
      
      {/* Power LED */}
      <mesh position={[0.32, 1.0, 0.175]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshStandardMaterial 
          color={isActive ? "#ff0000" : "#330000"} 
          emissive={isActive ? "#ff0000" : "#000000"}
          emissiveIntensity={isActive ? 2 : 0}
        />
      </mesh>
      
      {/* LED light */}
      {isActive && (
        <pointLight
          ref={ledRef}
          position={[0.32, 1.0, 0.2]}
          color="#ff0000"
          intensity={0.5}
          distance={0.5}
        />
      )}
      
      {/* Logo badge */}
      <mesh position={[0, 1.12, 0.18]}>
        <planeGeometry args={[0.2, 0.04]} />
        <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Handle on top */}
      <mesh position={[0, 1.12, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.08, 0.015, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#333333" metalness={0.6} />
      </mesh>
    </group>
  );
};
