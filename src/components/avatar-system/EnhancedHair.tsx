import { useMemo } from "react";

interface EnhancedHairProps {
  hairType: string;
  color: string;
  seed?: number;
}

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Generate hair strand positions for volume
const generateHairStrands = (count: number, radius: number, seed: number) => {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + seededRandom(seed + i) * 0.3;
    const r = radius * (0.8 + seededRandom(seed + i * 2) * 0.4);
    return {
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      y: seededRandom(seed + i * 3) * 0.03,
      rotation: seededRandom(seed + i * 4) * 0.4 - 0.2,
      length: 0.08 + seededRandom(seed + i * 5) * 0.06,
    };
  });
};

export const EnhancedHair = ({ hairType, color, seed = 0.5 }: EnhancedHairProps) => {
  const hairElements = useMemo(() => {
    // Darker shade for depth
    const darkColor = color;
    
    switch (hairType) {
      case 'bald':
        return null;

      case 'buzzcut':
        return (
          <group>
            {/* Main buzz shape */}
            <mesh position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.145, 24, 24]} />
              <meshStandardMaterial color={color} roughness={0.95} />
            </mesh>
            {/* Subtle texture bumps */}
            {Array.from({ length: 30 }).map((_, i) => {
              const phi = Math.acos(-1 + (2 * i) / 30);
              const theta = Math.sqrt(30 * Math.PI) * phi;
              const x = 0.14 * Math.cos(theta) * Math.sin(phi);
              const y = 0.12 + 0.14 * Math.cos(phi);
              const z = 0.14 * Math.sin(theta) * Math.sin(phi);
              if (y < 0.08) return null;
              return (
                <mesh key={i} position={[x, y, z]}>
                  <sphereGeometry args={[0.008, 4, 4]} />
                  <meshStandardMaterial color={color} roughness={1} />
                </mesh>
              );
            })}
          </group>
        );

      case 'short-spiky':
        const spikes = generateHairStrands(16, 0.09, seed);
        return (
          <group>
            {/* Base cap */}
            <mesh position={[0, 0.14, 0]}>
              <sphereGeometry args={[0.13, 16, 16]} />
              <meshStandardMaterial color={darkColor} roughness={0.8} />
            </mesh>
            {/* Spikes */}
            {spikes.map((spike, i) => (
              <mesh
                key={i}
                position={[spike.x, 0.16 + spike.y, spike.z]}
                rotation={[spike.rotation, 0, spike.rotation * 0.5]}
              >
                <coneGeometry args={[0.018, spike.length, 6]} />
                <meshStandardMaterial color={color} roughness={0.7} />
              </mesh>
            ))}
            {/* Inner layer */}
            {spikes.slice(0, 8).map((spike, i) => (
              <mesh
                key={`inner-${i}`}
                position={[spike.x * 0.6, 0.18, spike.z * 0.6]}
                rotation={[spike.rotation * 0.5, 0, 0]}
              >
                <coneGeometry args={[0.015, spike.length * 0.8, 5]} />
                <meshStandardMaterial color={color} roughness={0.7} />
              </mesh>
            ))}
          </group>
        );

      case 'long-straight':
        return (
          <group>
            {/* Main hair volume */}
            <mesh position={[0, 0.08, -0.02]}>
              <capsuleGeometry args={[0.12, 0.2, 12, 24]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
            {/* Top volume */}
            <mesh position={[0, 0.15, 0]}>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color={color} roughness={0.55} />
            </mesh>
            {/* Side strands - left */}
            {[-0.08, -0.1, -0.12].map((x, i) => (
              <mesh
                key={`left-${i}`}
                position={[x, -0.02 - i * 0.04, 0.02]}
                rotation={[0, 0, 0.15 + i * 0.05]}
              >
                <capsuleGeometry args={[0.025, 0.22, 6, 12]} />
                <meshStandardMaterial color={color} roughness={0.55} />
              </mesh>
            ))}
            {/* Side strands - right */}
            {[0.08, 0.1, 0.12].map((x, i) => (
              <mesh
                key={`right-${i}`}
                position={[x, -0.02 - i * 0.04, 0.02]}
                rotation={[0, 0, -0.15 - i * 0.05]}
              >
                <capsuleGeometry args={[0.025, 0.22, 6, 12]} />
                <meshStandardMaterial color={color} roughness={0.55} />
              </mesh>
            ))}
            {/* Back strands */}
            {[-0.04, 0, 0.04].map((x, i) => (
              <mesh
                key={`back-${i}`}
                position={[x, -0.08, -0.1]}
                rotation={[0.4, 0, 0]}
              >
                <capsuleGeometry args={[0.03, 0.28, 6, 12]} />
                <meshStandardMaterial color={darkColor} roughness={0.6} />
              </mesh>
            ))}
          </group>
        );

      case 'mohawk':
        return (
          <group>
            {/* Shaved sides */}
            <mesh position={[0, 0.1, 0]}>
              <sphereGeometry args={[0.135, 16, 16]} />
              <meshStandardMaterial color={darkColor} roughness={0.95} />
            </mesh>
            {/* Main mohawk ridge */}
            {Array.from({ length: 8 }).map((_, i) => {
              const z = -0.1 + i * 0.035;
              const heightMod = 1 - Math.abs(i - 3.5) * 0.1;
              return (
                <group key={i}>
                  <mesh
                    position={[0, 0.16 + heightMod * 0.05, z]}
                    rotation={[0.2 - i * 0.03, 0, 0]}
                  >
                    <coneGeometry args={[0.025, 0.12 * heightMod, 6]} />
                    <meshStandardMaterial color={color} roughness={0.7} />
                  </mesh>
                  {/* Secondary spikes */}
                  <mesh
                    position={[0, 0.15, z]}
                    rotation={[0.3, 0, 0]}
                  >
                    <coneGeometry args={[0.018, 0.08 * heightMod, 5]} />
                    <meshStandardMaterial color={color} roughness={0.7} />
                  </mesh>
                </group>
              );
            })}
          </group>
        );

      case 'ponytail':
        return (
          <group>
            {/* Top gathered hair */}
            <mesh position={[0, 0.15, 0]}>
              <sphereGeometry args={[0.11, 16, 16]} />
              <meshStandardMaterial color={color} roughness={0.5} />
            </mesh>
            {/* Hair tie */}
            <mesh position={[0, 0.05, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.025, 0.008, 8, 16]} />
              <meshStandardMaterial color="#2a2a2a" roughness={0.3} />
            </mesh>
            {/* Ponytail strands */}
            {[-0.02, 0, 0.02].map((x, i) => (
              <mesh
                key={i}
                position={[x, -0.08 - i * 0.02, -0.18]}
                rotation={[0.6 + seededRandom(seed + i) * 0.2, 0, seededRandom(seed + i * 2) * 0.1]}
              >
                <capsuleGeometry args={[0.032, 0.22, 6, 12]} />
                <meshStandardMaterial color={color} roughness={0.55} />
              </mesh>
            ))}
            {/* Side wisps */}
            <mesh position={[-0.1, 0.08, 0.02]} rotation={[0, 0, 0.3]}>
              <capsuleGeometry args={[0.015, 0.08, 4, 8]} />
              <meshStandardMaterial color={color} roughness={0.5} />
            </mesh>
            <mesh position={[0.1, 0.08, 0.02]} rotation={[0, 0, -0.3]}>
              <capsuleGeometry args={[0.015, 0.08, 4, 8]} />
              <meshStandardMaterial color={color} roughness={0.5} />
            </mesh>
          </group>
        );

      case 'curly':
        const curls = Array.from({ length: 24 }, (_, i) => ({
          angle: (i / 24) * Math.PI * 2,
          radius: 0.1 + seededRandom(seed + i) * 0.03,
          size: 0.03 + seededRandom(seed + i * 2) * 0.015,
          y: 0.1 + seededRandom(seed + i * 3) * 0.08,
        }));
        return (
          <group>
            {/* Base volume */}
            <mesh position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshStandardMaterial color={darkColor} roughness={0.8} />
            </mesh>
            {/* Curls */}
            {curls.map((curl, i) => (
              <mesh
                key={i}
                position={[
                  Math.cos(curl.angle) * curl.radius,
                  curl.y,
                  Math.sin(curl.angle) * curl.radius
                ]}
              >
                <sphereGeometry args={[curl.size, 8, 8]} />
                <meshStandardMaterial color={color} roughness={0.7} />
              </mesh>
            ))}
            {/* Top curls */}
            {Array.from({ length: 8 }).map((_, i) => (
              <mesh
                key={`top-${i}`}
                position={[
                  (seededRandom(seed + i * 10) - 0.5) * 0.1,
                  0.18 + seededRandom(seed + i * 11) * 0.04,
                  (seededRandom(seed + i * 12) - 0.5) * 0.1
                ]}
              >
                <sphereGeometry args={[0.025, 6, 6]} />
                <meshStandardMaterial color={color} roughness={0.7} />
              </mesh>
            ))}
          </group>
        );

      case 'afro':
        return (
          <group>
            {/* Main afro volume */}
            <mesh position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.2, 24, 24]} />
              <meshStandardMaterial color={color} roughness={0.95} />
            </mesh>
            {/* Texture detail */}
            {Array.from({ length: 50 }).map((_, i) => {
              const phi = Math.acos(-1 + (2 * i) / 50);
              const theta = Math.sqrt(50 * Math.PI) * phi;
              const r = 0.19;
              const x = r * Math.cos(theta) * Math.sin(phi);
              const y = 0.12 + r * Math.cos(phi);
              const z = r * Math.sin(theta) * Math.sin(phi);
              if (y < 0.06) return null;
              return (
                <mesh key={i} position={[x, y, z]}>
                  <sphereGeometry args={[0.015 + seededRandom(seed + i) * 0.01, 4, 4]} />
                  <meshStandardMaterial color={color} roughness={1} />
                </mesh>
              );
            })}
          </group>
        );

      case 'rocker':
        return (
          <group>
            {/* Top volume */}
            <mesh position={[0, 0.14, 0.02]}>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color={color} roughness={0.55} />
            </mesh>
            {/* Long back strands */}
            {Array.from({ length: 8 }).map((_, i) => {
              const x = -0.06 + i * 0.017;
              return (
                <mesh
                  key={i}
                  position={[x, 0, -0.1]}
                  rotation={[0.5 + seededRandom(seed + i) * 0.2, 0, seededRandom(seed + i * 2) * 0.1 - 0.05]}
                >
                  <capsuleGeometry args={[0.018, 0.32 + seededRandom(seed + i * 3) * 0.08, 6, 12]} />
                  <meshStandardMaterial color={color} roughness={0.55} />
                </mesh>
              );
            })}
            {/* Side layers */}
            {[-1, 1].map((side) => (
              <mesh
                key={side}
                position={[side * 0.1, 0.02, 0]}
                rotation={[0, 0, side * 0.2]}
              >
                <capsuleGeometry args={[0.025, 0.18, 6, 12]} />
                <meshStandardMaterial color={color} roughness={0.55} />
              </mesh>
            ))}
          </group>
        );

      case 'messy':
        const messyStrands = generateHairStrands(18, 0.1, seed);
        return (
          <group>
            {/* Base volume */}
            <mesh position={[0, 0.13, 0]}>
              <sphereGeometry args={[0.12, 12, 12]} />
              <meshStandardMaterial color={darkColor} roughness={0.7} />
            </mesh>
            {/* Messy strands */}
            {messyStrands.map((strand, i) => (
              <mesh
                key={i}
                position={[strand.x, 0.12 + strand.y, strand.z]}
                rotation={[
                  seededRandom(seed + i * 3) * 0.8 - 0.4,
                  seededRandom(seed + i * 5) * Math.PI,
                  seededRandom(seed + i * 7) * 0.6 - 0.3
                ]}
              >
                <capsuleGeometry args={[0.018, strand.length, 4, 8]} />
                <meshStandardMaterial color={color} roughness={0.6} />
              </mesh>
            ))}
          </group>
        );

      case 'undercut':
        return (
          <group>
            {/* Shaved sides */}
            <mesh position={[0, 0.08, 0]}>
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshStandardMaterial color={darkColor} roughness={0.95} />
            </mesh>
            {/* Longer top swept to side */}
            <mesh position={[-0.02, 0.17, 0.02]} rotation={[0.2, 0, 0.3]}>
              <boxGeometry args={[0.12, 0.06, 0.14]} />
              <meshStandardMaterial color={color} roughness={0.5} />
            </mesh>
            {/* Styled front */}
            <mesh position={[-0.04, 0.15, 0.08]} rotation={[0, 0, 0.4]}>
              <capsuleGeometry args={[0.025, 0.08, 6, 10]} />
              <meshStandardMaterial color={color} roughness={0.5} />
            </mesh>
          </group>
        );

      case 'dreadlocks':
        const dreads = Array.from({ length: 18 }, (_, i) => ({
          angle: (i / 18) * Math.PI * 2,
          length: 0.18 + seededRandom(seed + i) * 0.1,
          rotation: (seededRandom(seed + i * 2) - 0.5) * 0.6,
        }));
        return (
          <group>
            {/* Base */}
            <mesh position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshStandardMaterial color={darkColor} roughness={0.9} />
            </mesh>
            {/* Dreadlocks */}
            {dreads.map((dread, i) => (
              <group key={i}>
                <mesh
                  position={[
                    Math.cos(dread.angle) * 0.08,
                    0.06,
                    Math.sin(dread.angle) * 0.08
                  ]}
                  rotation={[dread.rotation, 0, dread.rotation * 0.5]}
                >
                  <capsuleGeometry args={[0.02, dread.length, 6, 8]} />
                  <meshStandardMaterial color={color} roughness={0.85} />
                </mesh>
                {/* Texture rings */}
                {[0.3, 0.5, 0.7].map((pos, j) => (
                  <mesh
                    key={j}
                    position={[
                      Math.cos(dread.angle) * 0.08,
                      0.06 - dread.length * pos * 0.5,
                      Math.sin(dread.angle) * 0.08
                    ]}
                  >
                    <torusGeometry args={[0.022, 0.004, 4, 8]} />
                    <meshStandardMaterial color={darkColor} roughness={0.9} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        );

      case 'braids':
        return (
          <group>
            {/* Top gathered */}
            <mesh position={[0, 0.14, 0]}>
              <sphereGeometry args={[0.11, 12, 12]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
            {/* Main braids */}
            {[-0.05, 0, 0.05].map((x, i) => (
              <group key={i}>
                {/* Braid segments */}
                {Array.from({ length: 6 }).map((_, j) => (
                  <mesh
                    key={j}
                    position={[
                      x + Math.sin(j * 0.8) * 0.01,
                      0.04 - j * 0.04,
                      -0.1 - j * 0.015
                    ]}
                    rotation={[0.3, 0, 0]}
                  >
                    <sphereGeometry args={[0.025, 6, 6]} />
                    <meshStandardMaterial color={color} roughness={0.65} />
                  </mesh>
                ))}
              </group>
            ))}
            {/* Side sections */}
            {[-0.1, 0.1].map((x, i) => (
              <mesh
                key={`side-${i}`}
                position={[x, 0.06, 0]}
                rotation={[0, 0, x > 0 ? -0.2 : 0.2]}
              >
                <capsuleGeometry args={[0.022, 0.1, 4, 8]} />
                <meshStandardMaterial color={color} roughness={0.6} />
              </mesh>
            ))}
          </group>
        );

      case 'slickedback':
        return (
          <group>
            {/* Main slicked shape */}
            <mesh position={[0, 0.12, -0.03]} rotation={[-0.25, 0, 0]}>
              <capsuleGeometry args={[0.11, 0.14, 12, 24]} />
              <meshStandardMaterial color={color} roughness={0.2} metalness={0.1} />
            </mesh>
            {/* Side definition */}
            <mesh position={[-0.1, 0.1, 0]} rotation={[0, 0.2, 0.1]}>
              <boxGeometry args={[0.04, 0.08, 0.1]} />
              <meshStandardMaterial color={color} roughness={0.25} />
            </mesh>
            <mesh position={[0.1, 0.1, 0]} rotation={[0, -0.2, -0.1]}>
              <boxGeometry args={[0.04, 0.08, 0.1]} />
              <meshStandardMaterial color={color} roughness={0.25} />
            </mesh>
          </group>
        );

      case 'topheavy':
        return (
          <group>
            {/* Voluminous top */}
            <mesh position={[0, 0.18, 0]}>
              <boxGeometry args={[0.16, 0.14, 0.14]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
            {/* Rounded edges */}
            <mesh position={[0, 0.2, 0.05]}>
              <sphereGeometry args={[0.08, 12, 12]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.2, -0.05]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
            {/* Side volume */}
            <mesh position={[-0.08, 0.14, 0]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
            <mesh position={[0.08, 0.14, 0]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color={color} roughness={0.6} />
            </mesh>
          </group>
        );

      default:
        return null;
    }
  }, [hairType, color, seed]);

  return <group position={[0, 0.15, 0]}>{hairElements}</group>;
};
