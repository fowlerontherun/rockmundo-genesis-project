import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ProceduralCablesProps {
  startPosition: [number, number, number];
  endPosition: [number, number, number];
  color?: string;
  thickness?: number;
  sag?: number;
  intensity?: number;
}

export const ProceduralCable = ({ 
  startPosition, 
  endPosition,
  color = "#1a1a1a",
  thickness = 0.015,
  sag = 0.1,
  intensity = 0.5
}: ProceduralCablesProps) => {
  const lineRef = useRef<THREE.Mesh>(null);
  
  // Create curved cable path using CatmullRomCurve3
  const { geometry } = useMemo(() => {
    const start = new THREE.Vector3(...startPosition);
    const end = new THREE.Vector3(...endPosition);
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      Math.min(start.y, end.y) - sag,
      (start.z + end.z) / 2
    );
    
    // Add some randomness to the mid-point for natural look
    mid.x += (Math.random() - 0.5) * 0.1;
    mid.z += (Math.random() - 0.5) * 0.1;
    
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const tubeGeometry = new THREE.TubeGeometry(curve, 20, thickness, 8, false);
    
    return { geometry: tubeGeometry };
  }, [startPosition, endPosition, sag, thickness]);

  // Subtle sway animation
  useFrame((state) => {
    if (lineRef.current && intensity > 0.5) {
      lineRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.005 * intensity;
    }
  });

  return (
    <mesh ref={lineRef} geometry={geometry}>
      <meshStandardMaterial 
        color={color} 
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  );
};

interface CableSetProps {
  equipmentPositions: {
    guitarAmp?: [number, number, number];
    bassAmp?: [number, number, number];
    drums?: [number, number, number];
    keyboard?: [number, number, number];
    vocalMic?: [number, number, number];
  };
  intensity?: number;
}

export const ProceduralCableSet = ({ 
  equipmentPositions,
  intensity = 0.5
}: CableSetProps) => {
  const cables: Array<{
    start: [number, number, number];
    end: [number, number, number];
    color: string;
  }> = [];

  // Guitar amp power cable (to stage box)
  if (equipmentPositions.guitarAmp) {
    cables.push({
      start: equipmentPositions.guitarAmp,
      end: [equipmentPositions.guitarAmp[0] - 0.5, 0, equipmentPositions.guitarAmp[2] + 0.3],
      color: "#0a0a0a"
    });
    // Guitar cable coil near amp
    cables.push({
      start: [equipmentPositions.guitarAmp[0] + 0.2, 0.1, equipmentPositions.guitarAmp[2] + 0.15],
      end: [equipmentPositions.guitarAmp[0] + 0.4, 0, equipmentPositions.guitarAmp[2] + 0.4],
      color: "#1a1a1a"
    });
  }

  // Bass amp power cable
  if (equipmentPositions.bassAmp) {
    cables.push({
      start: equipmentPositions.bassAmp,
      end: [equipmentPositions.bassAmp[0] + 0.5, 0, equipmentPositions.bassAmp[2] + 0.3],
      color: "#0a0a0a"
    });
    // Bass cable coil
    cables.push({
      start: [equipmentPositions.bassAmp[0] - 0.2, 0.1, equipmentPositions.bassAmp[2] + 0.15],
      end: [equipmentPositions.bassAmp[0] - 0.4, 0, equipmentPositions.bassAmp[2] + 0.4],
      color: "#1a1a1a"
    });
  }

  // Keyboard cables
  if (equipmentPositions.keyboard) {
    cables.push({
      start: equipmentPositions.keyboard,
      end: [equipmentPositions.keyboard[0] - 0.3, 0, equipmentPositions.keyboard[2] + 0.2],
      color: "#0a0a0a"
    });
  }

  // Vocal mic cable - runs along floor to stage box
  if (equipmentPositions.vocalMic) {
    cables.push({
      start: [equipmentPositions.vocalMic[0], 0, equipmentPositions.vocalMic[2]],
      end: [0, 0, 1.2],
      color: "#1a1a1a"
    });
  }

  // Drum mic cables (to snake box behind drums)
  if (equipmentPositions.drums) {
    cables.push({
      start: [equipmentPositions.drums[0] - 0.3, 0, equipmentPositions.drums[2] - 0.2],
      end: [equipmentPositions.drums[0], 0, equipmentPositions.drums[2] - 0.5],
      color: "#1a1a1a"
    });
    cables.push({
      start: [equipmentPositions.drums[0] + 0.3, 0, equipmentPositions.drums[2] - 0.2],
      end: [equipmentPositions.drums[0], 0, equipmentPositions.drums[2] - 0.5],
      color: "#1a1a1a"
    });
  }

  return (
    <group>
      {cables.map((cable, index) => (
        <ProceduralCable
          key={`cable-${index}`}
          startPosition={cable.start}
          endPosition={cable.end}
          color={cable.color}
          intensity={intensity}
          sag={0.05 + Math.random() * 0.05}
        />
      ))}
      
      {/* Stage box / DI box */}
      <mesh position={[0, 0.03, 1.2]}>
        <boxGeometry args={[0.15, 0.06, 0.1]} />
        <meshStandardMaterial color="#222222" metalness={0.4} roughness={0.6} />
      </mesh>
      
      {/* Main snake cable running off stage */}
      <ProceduralCable
        startPosition={[0, 0.03, 1.2]}
        endPosition={[1.5, 0, 1.5]}
        color="#0a0a0a"
        thickness={0.025}
        sag={0.03}
        intensity={intensity}
      />
    </group>
  );
};
