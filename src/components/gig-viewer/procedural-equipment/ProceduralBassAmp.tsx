import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ProceduralBassAmpProps {
  position?: [number, number, number];
  scale?: number;
  intensity?: number;
  isActive?: boolean;
}

export const ProceduralBassAmp = ({ 
  position = [0, 0, 0], 
  scale = 1,
  intensity = 0.5,
  isActive = true
}: ProceduralBassAmpProps) => {
  const ledRef = useRef<THREE.PointLight>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (ledRef.current && isActive) {
      // Bass amps pulse with lower frequency
      ledRef.current.intensity = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.2 * intensity;
    }
    
    // More pronounced vibration for bass
    if (groupRef.current && intensity > 0.5) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 15) * 0.004 * intensity;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Bottom cabinet (4x10 or 1x15 style) */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.7, 0.7, 0.45]} />
        <meshStandardMaterial color="#1f1f1f" roughness={0.85} />
      </mesh>
      
      {/* Speaker grille */}
      <mesh position={[0, 0.35, 0.23]}>
        <planeGeometry args={[0.6, 0.6]} />
        <meshStandardMaterial color="#252525" roughness={0.9} />
      </mesh>
      
      {/* Speaker cones (visible through grille) */}
      <mesh position={[-0.15, 0.5, 0.22]}>
        <circleGeometry args={[0.12, 24]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.15, 0.5, 0.22]}>
        <circleGeometry args={[0.12, 24]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[-0.15, 0.2, 0.22]}>
        <circleGeometry args={[0.12, 24]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.15, 0.2, 0.22]}>
        <circleGeometry args={[0.12, 24]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      
      {/* Speaker dust caps */}
      {[[-0.15, 0.5], [0.15, 0.5], [-0.15, 0.2], [0.15, 0.2]].map(([x, y], i) => (
        <mesh key={`cap-${i}`} position={[x, y, 0.225]}>
          <sphereGeometry args={[0.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}
      
      {/* Amp head on top */}
      <mesh position={[0, 0.82, 0.02]} castShadow>
        <boxGeometry args={[0.72, 0.2, 0.38]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.75} />
      </mesh>
      
      {/* Front panel */}
      <mesh position={[0, 0.82, 0.2]}>
        <planeGeometry args={[0.68, 0.15]} />
        <meshStandardMaterial color="#0f0f0f" metalness={0.2} roughness={0.6} />
      </mesh>
      
      {/* Control knobs (larger for bass) */}
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={`control-${i}`}>
          <mesh 
            position={[-0.28 + i * 0.1, 0.82, 0.21]} 
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.022, 0.022, 0.025, 16]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.4} />
          </mesh>
          {/* Knob indicator line */}
          <mesh position={[-0.28 + i * 0.1, 0.84, 0.22]}>
            <boxGeometry args={[0.002, 0.015, 0.002]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
      
      {/* Power LED */}
      <mesh position={[0.28, 0.85, 0.21]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial 
          color={isActive ? "#00ff00" : "#003300"} 
          emissive={isActive ? "#00ff00" : "#000000"}
          emissiveIntensity={isActive ? 1.5 : 0}
        />
      </mesh>
      
      {isActive && (
        <pointLight
          ref={ledRef}
          position={[0.28, 0.85, 0.25]}
          color="#00ff00"
          intensity={0.3}
          distance={0.4}
        />
      )}
      
      {/* VU Meter */}
      <mesh position={[-0.25, 0.88, 0.2]}>
        <boxGeometry args={[0.08, 0.03, 0.01]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <mesh position={[-0.26, 0.88, 0.205]}>
        <boxGeometry args={[0.03, 0.015, 0.005]} />
        <meshStandardMaterial 
          color="#ffaa00" 
          emissive="#ffaa00"
          emissiveIntensity={isActive ? 0.8 * intensity : 0}
        />
      </mesh>
      
      {/* Logo plate */}
      <mesh position={[0, 0.92, 0.19]}>
        <planeGeometry args={[0.15, 0.025]} />
        <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* Handle */}
      <mesh position={[0, 0.94, 0.02]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.06, 0.012, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} />
      </mesh>
      
      {/* Caster wheels */}
      {[[-0.28, -0.28], [0.28, -0.28], [-0.28, 0.15], [0.28, 0.15]].map(([x, z], i) => (
        <mesh key={`wheel-${i}`} position={[x, 0.03, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.02, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
};
