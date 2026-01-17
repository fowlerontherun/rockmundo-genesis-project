import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ProceduralMicStandProps {
  position?: [number, number, number];
  scale?: number;
  intensity?: number;
  hasBoomArm?: boolean;
}

export const ProceduralMicStand = ({ 
  position = [0, 0, 0], 
  scale = 1,
  intensity = 0.5,
  hasBoomArm = true
}: ProceduralMicStandProps) => {
  const micRef = useRef<THREE.Group>(null);
  
  // Subtle mic sway based on intensity
  useFrame((state) => {
    if (micRef.current) {
      const time = state.clock.elapsedTime;
      micRef.current.rotation.z = Math.sin(time * 0.5) * 0.02 * intensity;
    }
  });

  const metalColor = "#2a2a2a";
  const chromeColor = "#888888";

  return (
    <group ref={micRef} position={position} scale={scale}>
      {/* Tripod base */}
      {[0, 120, 240].map((angle, i) => (
        <mesh 
          key={`leg-${i}`} 
          position={[
            Math.cos((angle * Math.PI) / 180) * 0.15, 
            0.02, 
            Math.sin((angle * Math.PI) / 180) * 0.15
          ]}
          rotation={[0, (angle * Math.PI) / 180, Math.PI / 6]}
        >
          <cylinderGeometry args={[0.015, 0.01, 0.2, 8]} />
          <meshStandardMaterial color={metalColor} metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      
      {/* Main pole */}
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 1.5, 12]} />
        <meshStandardMaterial color={metalColor} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Height adjustment collar */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.08, 12]} />
        <meshStandardMaterial color={chromeColor} metalness={0.8} roughness={0.2} />
      </mesh>
      
      {hasBoomArm ? (
        <>
          {/* Boom arm joint */}
          <mesh position={[0, 1.5, 0]}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshStandardMaterial color={metalColor} metalness={0.6} />
          </mesh>
          
          {/* Boom arm */}
          <mesh position={[0.25, 1.55, 0]} rotation={[0, 0, -0.2]}>
            <cylinderGeometry args={[0.015, 0.015, 0.5, 8]} />
            <meshStandardMaterial color={metalColor} metalness={0.6} roughness={0.4} />
          </mesh>
          
          {/* Microphone holder (shock mount style) */}
          <group position={[0.48, 1.6, 0]}>
            {/* Outer ring */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.05, 0.008, 8, 16]} />
              <meshStandardMaterial color={metalColor} metalness={0.5} />
            </mesh>
            
            {/* Microphone body */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.03, 0.025, 0.15, 16]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
            </mesh>
            
            {/* Mic grille (spherical top) */}
            <mesh position={[0.08, 0, 0]}>
              <sphereGeometry args={[0.035, 16, 16]} />
              <meshStandardMaterial color="#333333" metalness={0.4} roughness={0.6} />
            </mesh>
          </group>
          
          {/* Counterweight */}
          <mesh position={[-0.15, 1.45, 0]} rotation={[0, 0, -0.2]}>
            <cylinderGeometry args={[0.02, 0.02, 0.08, 12]} />
            <meshStandardMaterial color={metalColor} metalness={0.6} />
          </mesh>
        </>
      ) : (
        <>
          {/* Straight mic clip */}
          <mesh position={[0, 1.55, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.06, 12]} />
            <meshStandardMaterial color={metalColor} metalness={0.5} />
          </mesh>
          
          {/* Microphone body */}
          <mesh position={[0, 1.65, 0]}>
            <cylinderGeometry args={[0.025, 0.022, 0.15, 16]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
          </mesh>
          
          {/* Mic grille */}
          <mesh position={[0, 1.76, 0]}>
            <sphereGeometry args={[0.03, 16, 16]} />
            <meshStandardMaterial color="#333333" metalness={0.4} roughness={0.6} />
          </mesh>
        </>
      )}
      
      {/* Cable coil at base */}
      <mesh position={[0.1, 0.03, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.06, 0.008, 6, 24]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
      <mesh position={[0.1, 0.05, 0.1]} rotation={[Math.PI / 2, 0.3, 0]}>
        <torusGeometry args={[0.05, 0.008, 6, 24]} />
        <meshStandardMaterial color="#111111" roughness={0.9} />
      </mesh>
    </group>
  );
};
