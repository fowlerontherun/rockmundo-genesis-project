import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ProceduralStageMonitorProps {
  position?: [number, number, number];
  scale?: number;
  intensity?: number;
  rotation?: [number, number, number];
}

export const ProceduralStageMonitor = ({ 
  position = [0, 0, 0], 
  scale = 1,
  intensity = 0.5,
  rotation = [0, 0, 0]
}: ProceduralStageMonitorProps) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Subtle vibration on high intensity
  useFrame((state) => {
    if (groupRef.current && intensity > 0.6) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 25) * 0.002 * intensity;
    }
  });

  // Wedge angle for floor monitors
  const wedgeAngle = -0.5; // About 30 degrees tilted back

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Main wedge body */}
      <group rotation={[wedgeAngle, 0, 0]}>
        {/* Back panel (taller side) */}
        <mesh position={[0, 0.12, -0.1]} castShadow>
          <boxGeometry args={[0.4, 0.24, 0.02]} />
          <meshStandardMaterial color="#1f1f1f" roughness={0.8} />
        </mesh>
        
        {/* Front panel (shorter, angled) */}
        <mesh position={[0, 0.06, 0.08]} castShadow>
          <boxGeometry args={[0.4, 0.12, 0.02]} />
          <meshStandardMaterial color="#1f1f1f" roughness={0.8} />
        </mesh>
        
        {/* Top panel (angled) */}
        <mesh position={[0, 0.2, 0]} rotation={[0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.4, 0.02, 0.2]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
        </mesh>
        
        {/* Bottom panel */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[0.4, 0.02, 0.2]} />
          <meshStandardMaterial color="#252525" roughness={0.9} />
        </mesh>
        
        {/* Side panels */}
        <mesh position={[-0.2, 0.1, 0]}>
          <boxGeometry args={[0.02, 0.22, 0.2]} />
          <meshStandardMaterial color="#1f1f1f" roughness={0.8} />
        </mesh>
        <mesh position={[0.2, 0.1, 0]}>
          <boxGeometry args={[0.02, 0.22, 0.2]} />
          <meshStandardMaterial color="#1f1f1f" roughness={0.8} />
        </mesh>
        
        {/* Speaker grille (on angled top face) */}
        <mesh position={[0, 0.21, 0]} rotation={[0.3, 0, 0]}>
          <planeGeometry args={[0.35, 0.15]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.95} />
        </mesh>
        
        {/* Main speaker */}
        <mesh position={[-0.05, 0.22, 0]} rotation={[0.3, 0, 0]}>
          <circleGeometry args={[0.06, 24]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        
        {/* Tweeter/horn */}
        <mesh position={[0.1, 0.22, 0]} rotation={[0.3, 0, 0]}>
          <circleGeometry args={[0.025, 16]} />
          <meshStandardMaterial color="#333333" metalness={0.5} />
        </mesh>
        
        {/* Handle cutout area */}
        <mesh position={[0, 0.18, -0.09]}>
          <boxGeometry args={[0.1, 0.03, 0.03]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
      </group>
      
      {/* Rubber feet */}
      {[[-0.15, 0.15], [0.15, 0.15], [-0.15, -0.05], [0.15, -0.05]].map(([x, z], i) => (
        <mesh key={`foot-${i}`} position={[x, 0.01, z]}>
          <cylinderGeometry args={[0.02, 0.02, 0.02, 8]} />
          <meshStandardMaterial color="#111111" roughness={0.95} />
        </mesh>
      ))}
      
      {/* XLR input panel (back) */}
      <mesh position={[0, 0.08, -0.11]}>
        <boxGeometry args={[0.12, 0.06, 0.01]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.3} />
      </mesh>
      
      {/* XLR connector */}
      <mesh position={[0, 0.08, -0.115]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.01, 6]} />
        <meshStandardMaterial color="#333333" metalness={0.7} />
      </mesh>
    </group>
  );
};
