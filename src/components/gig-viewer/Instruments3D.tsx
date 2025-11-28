import { useMemo } from "react";

interface Instruments3DProps {
  type: 'electric-guitar' | 'bass-guitar' | 'drum-kit' | 'keyboard' | 'microphone';
  color?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export const Instruments3D = ({ 
  type, 
  color = '#1a1a2e',
  position = [0, 0, 0],
  rotation = [0, 0, 0]
}: Instruments3DProps) => {
  const instrument = useMemo(() => {
    switch (type) {
      case 'electric-guitar':
        return (
          <group position={position} rotation={rotation}>
            {/* Body */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.18, 0.5, 0.06]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Neck */}
            <mesh position={[0, 0.35, 0]}>
              <boxGeometry args={[0.06, 0.4, 0.03]} />
              <meshStandardMaterial color="#3d2616" />
            </mesh>
            {/* Headstock */}
            <mesh position={[0, 0.6, 0]} rotation={[0, 0, 0.2]}>
              <boxGeometry args={[0.08, 0.15, 0.03]} />
              <meshStandardMaterial color="#3d2616" />
            </mesh>
            {/* Strings */}
            {[-0.02, -0.007, 0.006, 0.02].map((x, i) => (
              <mesh key={i} position={[x, 0.25, 0.03]}>
                <cylinderGeometry args={[0.001, 0.001, 0.8, 4]} />
                <meshStandardMaterial color="#888888" metalness={0.9} />
              </mesh>
            ))}
            {/* Pickups */}
            <mesh position={[0, -0.1, 0.035]}>
              <boxGeometry args={[0.12, 0.04, 0.02]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
        );
        
      case 'bass-guitar':
        return (
          <group position={position} rotation={rotation}>
            {/* Body - larger than guitar */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.2, 0.55, 0.07]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Neck - longer */}
            <mesh position={[0, 0.4, 0]}>
              <boxGeometry args={[0.07, 0.5, 0.035]} />
              <meshStandardMaterial color="#3d2616" />
            </mesh>
            {/* Headstock */}
            <mesh position={[0, 0.7, 0]} rotation={[0, 0, 0.15]}>
              <boxGeometry args={[0.09, 0.18, 0.035]} />
              <meshStandardMaterial color="#3d2616" />
            </mesh>
            {/* 4 Strings */}
            {[-0.015, -0.005, 0.005, 0.015].map((x, i) => (
              <mesh key={i} position={[x, 0.3, 0.038]}>
                <cylinderGeometry args={[0.0012, 0.0012, 0.95, 4]} />
                <meshStandardMaterial color="#666666" metalness={0.9} />
              </mesh>
            ))}
          </group>
        );
        
      case 'drum-kit':
        return (
          <group position={position}>
            {/* Bass drum */}
            <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
              <meshStandardMaterial color="#8b0000" />
            </mesh>
            {/* Snare drum */}
            <mesh position={[-0.25, 0.45, 0.2]}>
              <cylinderGeometry args={[0.15, 0.15, 0.15, 16]} />
              <meshStandardMaterial color="#cccccc" metalness={0.8} />
            </mesh>
            {/* Tom 1 */}
            <mesh position={[0.15, 0.55, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.15, 16]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
            {/* Tom 2 */}
            <mesh position={[0.35, 0.5, 0.1]}>
              <cylinderGeometry args={[0.14, 0.14, 0.18, 16]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
            {/* Hi-hat */}
            <group position={[-0.4, 0.65, 0.3]}>
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 0.01, 16]} />
                <meshStandardMaterial color="#d4af37" metalness={0.9} />
              </mesh>
              <mesh position={[0, 0.03, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 0.01, 16]} />
                <meshStandardMaterial color="#d4af37" metalness={0.9} />
              </mesh>
              <mesh position={[0, -0.3, 0]}>
                <cylinderGeometry args={[0.01, 0.01, 0.6, 8]} />
                <meshStandardMaterial color="#666666" metalness={0.7} />
              </mesh>
            </group>
            {/* Crash cymbal */}
            <group position={[0.5, 0.8, -0.2]}>
              <mesh>
                <cylinderGeometry args={[0.15, 0.15, 0.01, 16]} />
                <meshStandardMaterial color="#d4af37" metalness={0.9} />
              </mesh>
              <mesh position={[0, -0.4, 0]}>
                <cylinderGeometry args={[0.01, 0.01, 0.8, 8]} />
                <meshStandardMaterial color="#666666" metalness={0.7} />
              </mesh>
            </group>
            {/* Ride cymbal */}
            <group position={[0.6, 0.7, 0.3]}>
              <mesh>
                <cylinderGeometry args={[0.18, 0.18, 0.01, 16]} />
                <meshStandardMaterial color="#d4af37" metalness={0.9} />
              </mesh>
              <mesh position={[0, -0.35, 0]}>
                <cylinderGeometry args={[0.01, 0.01, 0.7, 8]} />
                <meshStandardMaterial color="#666666" metalness={0.7} />
              </mesh>
            </group>
            {/* Drum throne */}
            <mesh position={[0, 0.25, 0.6]}>
              <cylinderGeometry args={[0.15, 0.12, 0.1, 12]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
        );
        
      case 'keyboard':
        return (
          <group position={position} rotation={rotation}>
            {/* Keyboard body */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.8, 0.08, 0.25]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
            {/* White keys */}
            {Array.from({ length: 14 }).map((_, i) => (
              <mesh key={`white-${i}`} position={[-0.35 + i * 0.05, 0.045, 0.05]}>
                <boxGeometry args={[0.045, 0.01, 0.15]} />
                <meshStandardMaterial color="#f0f0f0" />
              </mesh>
            ))}
            {/* Black keys */}
            {[0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => (
              <mesh key={`black-${i}`} position={[-0.325 + i * 0.05, 0.055, 0.02]}>
                <boxGeometry args={[0.03, 0.015, 0.08]} />
                <meshStandardMaterial color="#1a1a1a" />
              </mesh>
            ))}
            {/* Control panel */}
            <mesh position={[0, 0.045, -0.08]}>
              <boxGeometry args={[0.7, 0.01, 0.08]} />
              <meshStandardMaterial color="#2a2a2a" />
            </mesh>
            {/* Stand */}
            <mesh position={[-0.3, -0.3, 0]} rotation={[0, 0, -0.2]}>
              <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
              <meshStandardMaterial color="#333333" metalness={0.7} />
            </mesh>
            <mesh position={[0.3, -0.3, 0]} rotation={[0, 0, 0.2]}>
              <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
              <meshStandardMaterial color="#333333" metalness={0.7} />
            </mesh>
          </group>
        );
        
      case 'microphone':
        return (
          <group position={position} rotation={rotation}>
            {/* Mic head */}
            <mesh position={[0, 1.4, 0]}>
              <sphereGeometry args={[0.04, 12, 12]} />
              <meshStandardMaterial color="#333333" metalness={0.8} />
            </mesh>
            {/* Mic body */}
            <mesh position={[0, 1.3, 0]}>
              <cylinderGeometry args={[0.02, 0.025, 0.15, 8]} />
              <meshStandardMaterial color="#1a1a1a" metalness={0.6} />
            </mesh>
            {/* Stand pole */}
            <mesh position={[0, 0.7, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 1.2, 8]} />
              <meshStandardMaterial color="#333333" metalness={0.8} />
            </mesh>
            {/* Base */}
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.12, 0.08, 0.1, 8]} />
              <meshStandardMaterial color="#1a1a1a" metalness={0.7} />
            </mesh>
          </group>
        );
    }
  }, [type, color, position, rotation]);

  return instrument;
};