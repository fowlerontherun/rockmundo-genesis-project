import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ProceduralKeyboardProps {
  position?: [number, number, number];
  scale?: number;
  intensity?: number;
  isActive?: boolean;
}

export const ProceduralKeyboard = ({ 
  position = [0, 0, 0], 
  scale = 1,
  intensity = 0.5,
  isActive = true
}: ProceduralKeyboardProps) => {
  const displayRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    // Display glow animation
    if (displayRef.current && isActive) {
      const material = displayRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
    }
    
    // Subtle movement on high intensity
    if (groupRef.current && intensity > 0.7) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 10) * 0.002;
    }
  });

  const keyboardWidth = 1.2;
  const whiteKeyWidth = keyboardWidth / 15; // 15 white keys for a 2-octave section
  const blackKeyWidth = whiteKeyWidth * 0.6;

  // Generate black key positions (pattern repeats every octave)
  const blackKeyPattern = [1, 2, 4, 5, 6]; // Positions relative to C
  const blackKeyPositions: number[] = [];
  for (let octave = 0; octave < 2; octave++) {
    blackKeyPattern.forEach(pos => {
      blackKeyPositions.push(octave * 7 + pos);
    });
  }

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* X-Stand frame */}
      <group>
        {/* Left X */}
        <mesh position={[-0.45, 0.35, 0]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.03, 0.8, 0.03]} />
          <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[-0.45, 0.35, 0]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[0.03, 0.8, 0.03]} />
          <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
        </mesh>
        
        {/* Right X */}
        <mesh position={[0.45, 0.35, 0]} rotation={[0, 0, 0.3]}>
          <boxGeometry args={[0.03, 0.8, 0.03]} />
          <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0.45, 0.35, 0]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[0.03, 0.8, 0.03]} />
          <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
        </mesh>
        
        {/* Cross bars */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1.0, 0.025, 0.025]} />
          <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>
      
      {/* Keyboard body */}
      <mesh position={[0, 0.73, 0]} castShadow>
        <boxGeometry args={[keyboardWidth + 0.1, 0.08, 0.35]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>
      
      {/* Control panel / display area */}
      <mesh position={[0, 0.78, -0.12]}>
        <boxGeometry args={[keyboardWidth, 0.02, 0.08]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      
      {/* LED Display */}
      <mesh 
        ref={displayRef}
        position={[0, 0.79, -0.12]}
      >
        <planeGeometry args={[0.15, 0.04]} />
        <meshStandardMaterial 
          color="#00ff88" 
          emissive="#00ff88"
          emissiveIntensity={isActive ? 0.5 : 0}
        />
      </mesh>
      
      {/* Pitch/Mod wheels */}
      <mesh position={[-0.52, 0.76, 0.02]} rotation={[Math.PI / 4, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.04, 16]} />
        <meshStandardMaterial color="#333333" metalness={0.5} />
      </mesh>
      <mesh position={[-0.52, 0.76, 0.08]} rotation={[Math.PI / 4, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.04, 16]} />
        <meshStandardMaterial color="#333333" metalness={0.5} />
      </mesh>
      
      {/* White keys */}
      {Array.from({ length: 15 }).map((_, i) => (
        <mesh 
          key={`white-${i}`}
          position={[
            -keyboardWidth / 2 + whiteKeyWidth / 2 + i * whiteKeyWidth + 0.01,
            0.775,
            0.08
          ]}
        >
          <boxGeometry args={[whiteKeyWidth - 0.005, 0.02, 0.12]} />
          <meshStandardMaterial color="#f5f5f5" roughness={0.3} />
        </mesh>
      ))}
      
      {/* Black keys */}
      {blackKeyPositions.map((pos, i) => (
        <mesh 
          key={`black-${i}`}
          position={[
            -keyboardWidth / 2 + (pos + 0.7) * whiteKeyWidth + 0.01,
            0.79,
            0.04
          ]}
        >
          <boxGeometry args={[blackKeyWidth, 0.03, 0.07]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
        </mesh>
      ))}
      
      {/* Brand logo area */}
      <mesh position={[0.4, 0.79, -0.12]}>
        <planeGeometry args={[0.12, 0.025]} />
        <meshStandardMaterial color="#666666" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Small knobs/buttons */}
      {Array.from({ length: 4 }).map((_, i) => (
        <mesh 
          key={`knob-${i}`}
          position={[-0.2 + i * 0.1, 0.79, -0.12]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <cylinderGeometry args={[0.012, 0.012, 0.01, 12]} />
          <meshStandardMaterial color="#444444" metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
};
