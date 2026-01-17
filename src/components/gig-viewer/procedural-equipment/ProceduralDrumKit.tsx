import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ProceduralDrumKitProps {
  position?: [number, number, number];
  scale?: number;
  intensity?: number;
  songSection?: string;
}

export const ProceduralDrumKit = ({ 
  position = [0, 0, 0], 
  scale = 1,
  intensity = 0.5,
  songSection = 'verse'
}: ProceduralDrumKitProps) => {
  const hihatRef = useRef<THREE.Group>(null);
  const snareRef = useRef<THREE.Mesh>(null);
  const cymbalRefs = useRef<THREE.Mesh[]>([]);
  
  // Animate drums based on intensity
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Hi-hat opens/closes
    if (hihatRef.current) {
      const hihatOpen = Math.sin(time * 8) * 0.02 * intensity;
      hihatRef.current.position.y = 0.9 + hihatOpen;
    }
    
    // Snare vibration on chorus/high intensity
    if (snareRef.current && (intensity > 0.6 || songSection === 'chorus')) {
      snareRef.current.position.y = 0.55 + Math.sin(time * 16) * 0.003;
    }
    
    // Cymbal shimmer
    cymbalRefs.current.forEach((cymbal, i) => {
      if (cymbal) {
        cymbal.rotation.z = Math.sin(time * 2 + i) * 0.05 * intensity;
      }
    });
  });

  const drumShellColor = "#8B0000"; // Deep red drum shells
  const metalColor = "#C0C0C0";
  const cymbalColor = "#B8860B";

  return (
    <group position={position} scale={scale}>
      {/* Bass Drum */}
      <mesh position={[0, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.3, 32]} />
        <meshStandardMaterial color={drumShellColor} roughness={0.4} />
      </mesh>
      {/* Bass drum front head */}
      <mesh position={[0, 0.35, 0.16]} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.33, 32]} />
        <meshStandardMaterial color="#f5f5dc" roughness={0.8} />
      </mesh>
      {/* Bass drum logo */}
      <mesh position={[0, 0.35, 0.17]}>
        <circleGeometry args={[0.15, 32]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      
      {/* Snare Drum (front left) */}
      <mesh 
        ref={snareRef}
        position={[-0.25, 0.55, 0.35]} 
        rotation={[Math.PI / 12, 0, 0]} 
        castShadow
      >
        <cylinderGeometry args={[0.15, 0.15, 0.08, 32]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Snare top head */}
      <mesh position={[-0.25, 0.59, 0.34]} rotation={[-Math.PI / 12, 0, 0]}>
        <circleGeometry args={[0.14, 32]} />
        <meshStandardMaterial color="#f5f5dc" roughness={0.9} />
      </mesh>
      
      {/* Floor Tom (right side) */}
      <mesh position={[0.4, 0.35, 0.2]} rotation={[Math.PI / 2, 0, -0.15]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.2, 32]} />
        <meshStandardMaterial color={drumShellColor} roughness={0.4} />
      </mesh>
      
      {/* Rack Toms (mounted on bass drum) */}
      <mesh position={[-0.15, 0.75, -0.05]} rotation={[0.3, 0, -0.1]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.1, 32]} />
        <meshStandardMaterial color={drumShellColor} roughness={0.4} />
      </mesh>
      <mesh position={[0.15, 0.75, -0.05]} rotation={[0.3, 0, 0.1]} castShadow>
        <cylinderGeometry args={[0.13, 0.13, 0.1, 32]} />
        <meshStandardMaterial color={drumShellColor} roughness={0.4} />
      </mesh>
      
      {/* Hi-Hat */}
      <group position={[-0.5, 0, 0.3]}>
        {/* Stand */}
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.02, 0.03, 0.9, 8]} />
          <meshStandardMaterial color={metalColor} metalness={0.8} />
        </mesh>
        {/* Bottom cymbal */}
        <mesh position={[0, 0.88, 0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.16, 0.01, 32]} />
          <meshStandardMaterial color={cymbalColor} metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Top cymbal */}
        <group ref={hihatRef} position={[0, 0.9, 0]}>
          <mesh>
            <cylinderGeometry args={[0.15, 0.16, 0.01, 32]} />
            <meshStandardMaterial color={cymbalColor} metalness={0.9} roughness={0.2} />
          </mesh>
        </group>
      </group>
      
      {/* Crash Cymbal (left) */}
      <group position={[-0.35, 0, -0.2]}>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.015, 0.025, 1.1, 8]} />
          <meshStandardMaterial color={metalColor} metalness={0.8} />
        </mesh>
        <mesh 
          ref={(el) => { if (el) cymbalRefs.current[0] = el; }}
          position={[0, 1.1, 0]} 
          rotation={[0.1, 0, 0.05]}
        >
          <cylinderGeometry args={[0.2, 0.22, 0.01, 32]} />
          <meshStandardMaterial color={cymbalColor} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
      
      {/* Ride Cymbal (right) */}
      <group position={[0.45, 0, -0.15]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.015, 0.025, 1.0, 8]} />
          <meshStandardMaterial color={metalColor} metalness={0.8} />
        </mesh>
        <mesh 
          ref={(el) => { if (el) cymbalRefs.current[1] = el; }}
          position={[0, 1.0, 0]} 
          rotation={[-0.1, 0, -0.05]}
        >
          <cylinderGeometry args={[0.25, 0.27, 0.015, 32]} />
          <meshStandardMaterial color={cymbalColor} metalness={0.9} roughness={0.2} />
        </mesh>
      </group>
      
      {/* Drum throne (stool) */}
      <mesh position={[0, 0.45, -0.5]}>
        <cylinderGeometry args={[0.18, 0.15, 0.08, 16]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.2, -0.5]}>
        <cylinderGeometry args={[0.03, 0.05, 0.4, 8]} />
        <meshStandardMaterial color={metalColor} metalness={0.7} />
      </mesh>
    </group>
  );
};
