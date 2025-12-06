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
            {/* Body - contoured shape */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.2, 0.5, 0.05]} />
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Body cutaway */}
            <mesh position={[0.06, 0.15, 0]} rotation={[0, 0, 0.3]}>
              <boxGeometry args={[0.1, 0.15, 0.05]} />
              <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Pickguard */}
            <mesh position={[-0.02, -0.05, 0.028]}>
              <boxGeometry args={[0.12, 0.18, 0.005]} />
              <meshStandardMaterial color="#f5f5dc" roughness={0.5} />
            </mesh>
            {/* Neck */}
            <mesh position={[0, 0.38, 0]}>
              <boxGeometry args={[0.055, 0.42, 0.025]} />
              <meshStandardMaterial color="#3d2616" roughness={0.6} />
            </mesh>
            {/* Fretboard */}
            <mesh position={[0, 0.38, 0.015]}>
              <boxGeometry args={[0.05, 0.42, 0.008]} />
              <meshStandardMaterial color="#1a0a00" roughness={0.4} />
            </mesh>
            {/* Fret markers */}
            {[0.2, 0.35, 0.45].map((y, i) => (
              <mesh key={i} position={[0, y, 0.022]}>
                <circleGeometry args={[0.008, 8]} />
                <meshStandardMaterial color="#f0f0f0" />
              </mesh>
            ))}
            {/* Headstock */}
            <mesh position={[0, 0.63, 0]} rotation={[0, 0, 0.15]}>
              <boxGeometry args={[0.07, 0.14, 0.022]} />
              <meshStandardMaterial color="#3d2616" />
            </mesh>
            {/* Tuning pegs */}
            {[-0.03, -0.015, 0, 0.015, 0.03, 0.045].map((x, i) => (
              <mesh key={i} position={[x - 0.01, 0.6 + (i % 3) * 0.03, i < 3 ? -0.02 : 0.03]}>
                <cylinderGeometry args={[0.006, 0.006, 0.02, 6]} />
                <meshStandardMaterial color="#c0c0c0" metalness={0.9} />
              </mesh>
            ))}
            {/* Strings */}
            {[-0.018, -0.009, 0, 0.009, 0.018, 0.027].map((x, i) => (
              <mesh key={i} position={[x - 0.005, 0.25, 0.03]}>
                <cylinderGeometry args={[0.0008, 0.0008, 0.85, 4]} />
                <meshStandardMaterial color="#c0c0c0" metalness={0.95} />
              </mesh>
            ))}
            {/* Bridge */}
            <mesh position={[0, -0.15, 0.035]}>
              <boxGeometry args={[0.1, 0.04, 0.015]} />
              <meshStandardMaterial color="#c0c0c0" metalness={0.9} />
            </mesh>
            {/* Pickups */}
            <mesh position={[0, -0.02, 0.035]}>
              <boxGeometry args={[0.09, 0.025, 0.015]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
            <mesh position={[0, 0.08, 0.035]}>
              <boxGeometry args={[0.09, 0.025, 0.015]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
            {/* Volume/Tone knobs */}
            {[[0.06, -0.12], [0.06, -0.18]].map(([x, y], i) => (
              <mesh key={i} position={[x, y, 0.04]}>
                <cylinderGeometry args={[0.015, 0.015, 0.015, 8]} />
                <meshStandardMaterial color="#1a1a1a" />
              </mesh>
            ))}
            {/* Strap button */}
            <mesh position={[0, -0.24, 0]}>
              <sphereGeometry args={[0.012, 6, 6]} />
              <meshStandardMaterial color="#c0c0c0" metalness={0.8} />
            </mesh>
          </group>
        );
        
      case 'bass-guitar':
        return (
          <group position={position} rotation={rotation}>
            {/* Body - larger than guitar */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.22, 0.55, 0.06]} />
              <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
            </mesh>
            {/* Pickguard */}
            <mesh position={[-0.02, -0.05, 0.033]}>
              <boxGeometry args={[0.14, 0.2, 0.005]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
            </mesh>
            {/* Neck - longer */}
            <mesh position={[0, 0.42, 0]}>
              <boxGeometry args={[0.065, 0.52, 0.03]} />
              <meshStandardMaterial color="#3d2616" />
            </mesh>
            {/* Fretboard */}
            <mesh position={[0, 0.42, 0.018]}>
              <boxGeometry args={[0.058, 0.52, 0.01]} />
              <meshStandardMaterial color="#1a0a00" roughness={0.4} />
            </mesh>
            {/* Headstock */}
            <mesh position={[0, 0.72, 0]} rotation={[0, 0, 0.12]}>
              <boxGeometry args={[0.08, 0.16, 0.028]} />
              <meshStandardMaterial color="#3d2616" />
            </mesh>
            {/* 4 Strings - thicker */}
            {[-0.012, -0.004, 0.004, 0.012].map((x, i) => (
              <mesh key={i} position={[x, 0.32, 0.035]}>
                <cylinderGeometry args={[0.0015 + i * 0.0003, 0.0015 + i * 0.0003, 1.0, 4]} />
                <meshStandardMaterial color="#a0a0a0" metalness={0.9} />
              </mesh>
            ))}
            {/* Bridge */}
            <mesh position={[0, -0.18, 0.04]}>
              <boxGeometry args={[0.12, 0.05, 0.018]} />
              <meshStandardMaterial color="#c0c0c0" metalness={0.9} />
            </mesh>
            {/* Pickup */}
            <mesh position={[0, 0, 0.04]}>
              <boxGeometry args={[0.1, 0.04, 0.018]} />
              <meshStandardMaterial color="#1a1a1a" />
            </mesh>
          </group>
        );
        
      case 'drum-kit':
        return (
          <group position={position}>
            {/* Bass drum with logo area */}
            <group position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <mesh>
                <cylinderGeometry args={[0.32, 0.32, 0.22, 20]} />
                <meshStandardMaterial color="#8b0000" roughness={0.4} />
              </mesh>
              {/* Drum head front */}
              <mesh position={[0, 0.111, 0]}>
                <circleGeometry args={[0.3, 20]} />
                <meshStandardMaterial color="#f5f5f5" roughness={0.3} />
              </mesh>
              {/* Drum head back */}
              <mesh position={[0, -0.111, 0]} rotation={[Math.PI, 0, 0]}>
                <circleGeometry args={[0.3, 20]} />
                <meshStandardMaterial color="#e0e0e0" roughness={0.4} />
              </mesh>
            </group>
            {/* Bass drum legs */}
            {[-0.25, 0.25].map((x, i) => (
              <mesh key={i} position={[x, 0.1, 0.15]} rotation={[0.3, 0, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 0.25, 6]} />
                <meshStandardMaterial color="#333333" metalness={0.7} />
              </mesh>
            ))}

            {/* Snare drum */}
            <mesh position={[-0.28, 0.5, 0.25]}>
              <cylinderGeometry args={[0.16, 0.16, 0.12, 16]} />
              <meshStandardMaterial color="#c0c0c0" metalness={0.85} roughness={0.2} />
            </mesh>
            <mesh position={[-0.28, 0.56, 0.25]}>
              <circleGeometry args={[0.155, 16]} />
              <meshStandardMaterial color="#f5f5f5" roughness={0.3} />
            </mesh>

            {/* Hi-tom */}
            <mesh position={[-0.12, 0.65, -0.05]} rotation={[-0.2, 0, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.12, 14]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.3} />
            </mesh>
            <mesh position={[-0.12, 0.72, -0.03]} rotation={[-0.2, 0, 0]}>
              <circleGeometry args={[0.115, 14]} />
              <meshStandardMaterial color="#f5f5f5" roughness={0.3} />
            </mesh>

            {/* Mid-tom */}
            <mesh position={[0.12, 0.65, -0.05]} rotation={[-0.2, 0, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.14, 14]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.3} />
            </mesh>

            {/* Floor tom */}
            <mesh position={[0.4, 0.35, 0.2]}>
              <cylinderGeometry args={[0.16, 0.16, 0.2, 16]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.3} />
            </mesh>
            {/* Floor tom legs */}
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[0.4 + Math.cos(i * 2.1) * 0.12, 0.15, 0.2 + Math.sin(i * 2.1) * 0.12]}>
                <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
                <meshStandardMaterial color="#333333" metalness={0.7} />
              </mesh>
            ))}

            {/* Hi-hat */}
            <group position={[-0.45, 0.65, 0.35]}>
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.14, 0.14, 0.008, 18]} />
                <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.15} />
              </mesh>
              <mesh position={[0, 0.025, 0]}>
                <cylinderGeometry args={[0.14, 0.14, 0.008, 18]} />
                <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.15} />
              </mesh>
              <mesh position={[0, -0.35, 0]}>
                <cylinderGeometry args={[0.012, 0.012, 0.7, 8]} />
                <meshStandardMaterial color="#333333" metalness={0.8} />
              </mesh>
              {/* Hi-hat pedal */}
              <mesh position={[0, -0.68, 0.08]} rotation={[0.3, 0, 0]}>
                <boxGeometry args={[0.08, 0.15, 0.02]} />
                <meshStandardMaterial color="#333333" metalness={0.6} />
              </mesh>
            </group>

            {/* Crash cymbal */}
            <group position={[-0.5, 0.9, -0.15]}>
              <mesh rotation={[0.1, 0, 0.1]}>
                <cylinderGeometry args={[0.18, 0.18, 0.006, 20]} />
                <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.1} />
              </mesh>
              <mesh position={[0, -0.45, 0]}>
                <cylinderGeometry args={[0.012, 0.012, 0.9, 8]} />
                <meshStandardMaterial color="#333333" metalness={0.8} />
              </mesh>
            </group>

            {/* Ride cymbal */}
            <group position={[0.55, 0.8, 0.3]}>
              <mesh rotation={[-0.1, 0, -0.1]}>
                <cylinderGeometry args={[0.22, 0.22, 0.008, 22]} />
                <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.1} />
              </mesh>
              <mesh position={[0, -0.4, 0]}>
                <cylinderGeometry args={[0.012, 0.012, 0.8, 8]} />
                <meshStandardMaterial color="#333333" metalness={0.8} />
              </mesh>
            </group>

            {/* Drum throne */}
            <mesh position={[0, 0.35, 0.7]}>
              <cylinderGeometry args={[0.15, 0.12, 0.08, 12]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
            </mesh>
            {/* Throne stem */}
            <mesh position={[0, 0.2, 0.7]}>
              <cylinderGeometry args={[0.025, 0.025, 0.3, 8]} />
              <meshStandardMaterial color="#333333" metalness={0.7} />
            </mesh>

            {/* Kick pedal */}
            <mesh position={[0, 0.05, 0.2]} rotation={[0.2, 0, 0]}>
              <boxGeometry args={[0.1, 0.2, 0.03]} />
              <meshStandardMaterial color="#333333" metalness={0.6} />
            </mesh>
          </group>
        );
        
      case 'keyboard':
        return (
          <group position={position} rotation={rotation}>
            {/* Keyboard body */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[0.85, 0.06, 0.28]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.4} />
            </mesh>
            {/* Control panel back */}
            <mesh position={[0, 0.05, -0.1]}>
              <boxGeometry args={[0.8, 0.06, 0.08]} />
              <meshStandardMaterial color="#2a2a2a" roughness={0.5} />
            </mesh>
            {/* Display screen */}
            <mesh position={[0, 0.08, -0.1]}>
              <boxGeometry args={[0.15, 0.001, 0.05]} />
              <meshStandardMaterial color="#003366" emissive="#001133" emissiveIntensity={0.5} />
            </mesh>
            {/* White keys - 2 octaves */}
            {Array.from({ length: 14 }).map((_, i) => (
              <mesh key={`white-${i}`} position={[-0.37 + i * 0.055, 0.035, 0.05]}>
                <boxGeometry args={[0.05, 0.012, 0.16]} />
                <meshStandardMaterial color="#f8f8f8" roughness={0.3} />
              </mesh>
            ))}
            {/* Black keys */}
            {[0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((i) => (
              <mesh key={`black-${i}`} position={[-0.345 + i * 0.055, 0.048, 0.02]}>
                <boxGeometry args={[0.032, 0.018, 0.1]} />
                <meshStandardMaterial color="#0a0a0a" roughness={0.4} />
              </mesh>
            ))}
            {/* Pitch/mod wheels */}
            <mesh position={[-0.4, 0.04, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.025, 8]} />
              <meshStandardMaterial color="#333333" />
            </mesh>
            <mesh position={[-0.4, 0.04, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.025, 8]} />
              <meshStandardMaterial color="#333333" />
            </mesh>
            {/* Control knobs */}
            {[0.2, 0.25, 0.3].map((x, i) => (
              <mesh key={i} position={[x, 0.08, -0.08]}>
                <cylinderGeometry args={[0.012, 0.012, 0.015, 8]} />
                <meshStandardMaterial color="#1a1a1a" />
              </mesh>
            ))}
            {/* Stand legs */}
            <mesh position={[-0.32, -0.25, 0]} rotation={[0, 0, -0.15]}>
              <cylinderGeometry args={[0.018, 0.018, 0.5, 8]} />
              <meshStandardMaterial color="#222222" metalness={0.7} />
            </mesh>
            <mesh position={[0.32, -0.25, 0]} rotation={[0, 0, 0.15]}>
              <cylinderGeometry args={[0.018, 0.018, 0.5, 8]} />
              <meshStandardMaterial color="#222222" metalness={0.7} />
            </mesh>
            {/* Cross bar */}
            <mesh position={[0, -0.35, 0]}>
              <boxGeometry args={[0.6, 0.03, 0.03]} />
              <meshStandardMaterial color="#222222" metalness={0.7} />
            </mesh>
          </group>
        );
        
      case 'microphone':
        return (
          <group position={position} rotation={rotation}>
            {/* Mic grille head */}
            <mesh position={[0, 1.42, 0]}>
              <sphereGeometry args={[0.045, 16, 16]} />
              <meshStandardMaterial color="#444444" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Grille mesh effect */}
            <mesh position={[0, 1.42, 0]}>
              <sphereGeometry args={[0.048, 8, 8]} />
              <meshStandardMaterial 
                color="#222222" 
                wireframe={true} 
              />
            </mesh>
            {/* Mic body */}
            <mesh position={[0, 1.32, 0]}>
              <cylinderGeometry args={[0.022, 0.028, 0.16, 12]} />
              <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* XLR connector */}
            <mesh position={[0, 1.22, 0]}>
              <cylinderGeometry args={[0.018, 0.022, 0.04, 8]} />
              <meshStandardMaterial color="#333333" metalness={0.8} />
            </mesh>
            {/* Stand clip/holder */}
            <mesh position={[0, 1.18, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 0.04, 8]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.6} />
            </mesh>
            {/* Stand pole - upper section */}
            <mesh position={[0, 0.85, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.7, 8]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.85} roughness={0.2} />
            </mesh>
            {/* Height adjustment collar */}
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 0.04, 8]} />
              <meshStandardMaterial color="#1a1a1a" metalness={0.7} />
            </mesh>
            {/* Stand pole - lower section */}
            <mesh position={[0, 0.25, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.5, 8]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.85} roughness={0.2} />
            </mesh>
            {/* Base - tripod style */}
            <group position={[0, 0.02, 0]}>
              {[0, 1, 2].map((i) => (
                <mesh 
                  key={i} 
                  position={[Math.cos(i * 2.1) * 0.1, 0, Math.sin(i * 2.1) * 0.1]} 
                  rotation={[0, i * 2.1, 0.4]}
                >
                  <boxGeometry args={[0.02, 0.015, 0.15]} />
                  <meshStandardMaterial color="#1a1a1a" metalness={0.7} />
                </mesh>
              ))}
              <mesh position={[0, 0.01, 0]}>
                <cylinderGeometry args={[0.025, 0.02, 0.03, 8]} />
                <meshStandardMaterial color="#1a1a1a" metalness={0.7} />
              </mesh>
            </group>
          </group>
        );
    }
  }, [type, color, position, rotation]);

  return instrument;
};
