import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface OptimizedCrowdLayerProps {
  crowdMood: number;
  bandFame: number;
  bandMerchColor: string;
  bandName?: string;
  maxCrowdCount: number;
  densityMultiplier: number;
}

interface CrowdPerson {
  id: number;
  position: [number, number, number];
  seed: number;
  colorVariant: number;
  showMerch: boolean;
  scale: number;
  baseY: number;
}

// Seeded random number generator for deterministic positions
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Color palettes
const shirtColors = ['#1a1a1a', '#2d2d2d', '#4a4a4a', '#333333', '#ff3333', '#3333ff', '#33ff33', '#ffff33'];
const pantsColors = ['#1a1a1a', '#2d2d2d', '#0066cc', '#4a4a4a'];
const skinTones = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac'];

export const OptimizedCrowdLayer = ({
  crowdMood,
  bandFame,
  bandMerchColor,
  bandName = "BAND",
  maxCrowdCount,
  densityMultiplier
}: OptimizedCrowdLayerProps) => {
  const groupRefs = useRef<Map<number, THREE.Group>>(new Map());
  const timeSinceLastUpdate = useRef(0);
  const animationInterval = 1 / 15; // 15fps for crowd animations

  // Calculate merch percentage
  const merchPercentage = useMemo(() => {
    if (bandFame < 500) return 0;
    if (bandFame < 1000) return 5;
    if (bandFame < 2500) return 15;
    if (bandFame < 5000) return 30;
    return 50;
  }, [bandFame]);

  // Generate crowd data with deterministic positions (NOT dependent on crowdMood)
  const crowdData = useMemo(() => {
    const count = Math.floor(maxCrowdCount * densityMultiplier);
    const crowd: CrowdPerson[] = [];

    const zones = [
      { x: [-8, 8], z: [2, 6], density: 1.0 },
      { x: [-10, 10], z: [6, 10], density: 0.8 },
      { x: [-12, 12], z: [10, 14], density: 0.6 }
    ];

    let currentId = 0;

    for (const zone of zones) {
      const zoneCount = Math.floor((count / 3) * zone.density);

      for (let i = 0; i < zoneCount; i++) {
        const seed = seededRandom(currentId * 7.31 + 0.5);
        const x = zone.x[0] + seededRandom(currentId * 3.14) * (zone.x[1] - zone.x[0]);
        const z = zone.z[0] + seededRandom(currentId * 2.71) * (zone.z[1] - zone.z[0]);
        const baseY = 0;
        
        crowd.push({
          id: currentId,
          position: [x, baseY, z],
          seed,
          colorVariant: Math.floor(seed * 10),
          showMerch: seededRandom(currentId * 5.67) * 100 < merchPercentage,
          scale: 0.8 + seededRandom(currentId * 1.23) * 0.4,
          baseY
        });

        currentId++;
      }
    }

    return crowd;
  }, [maxCrowdCount, densityMultiplier, merchPercentage]);

  // Determine animation intensity based on mood
  const getAnimationIntensity = (mood: number): { bounce: number; sway: number; jump: number } => {
    if (mood < 20) return { bounce: 0.02, sway: 0.05, jump: 0 };
    if (mood < 40) return { bounce: 0.05, sway: 0.1, jump: 0 };
    if (mood < 60) return { bounce: 0.1, sway: 0.15, jump: 0.1 };
    if (mood < 80) return { bounce: 0.15, sway: 0.2, jump: 0.2 };
    return { bounce: 0.2, sway: 0.25, jump: 0.3 };
  };

  // Batched animation update - directly manipulate THREE.Group transforms
  useFrame((state, delta) => {
    timeSinceLastUpdate.current += delta;
    
    if (timeSinceLastUpdate.current < animationInterval) return;
    timeSinceLastUpdate.current = 0;

    const time = state.clock.getElapsedTime();
    const intensity = getAnimationIntensity(crowdMood);

    crowdData.forEach((person) => {
      const group = groupRefs.current.get(person.id);
      if (!group) return;

      const phaseOffset = person.seed * 10;
      const animType = Math.floor(person.seed * 5);

      // Animate Y position and rotation directly on the THREE.Group
      switch (animType) {
        case 0: // Idle sway
          group.position.y = person.baseY + Math.sin(time * 0.5 + phaseOffset) * intensity.sway * 0.5;
          group.rotation.z = Math.sin(time * 0.3 + phaseOffset) * 0.05;
          break;

        case 1: // Bouncing
          group.position.y = person.baseY + Math.abs(Math.sin(time * 2 + phaseOffset)) * intensity.bounce;
          group.rotation.z = 0;
          break;

        case 2: // Side sway
          group.position.y = person.baseY + Math.sin(time + phaseOffset) * intensity.sway * 0.3;
          group.rotation.z = Math.sin(time * 0.8 + phaseOffset) * 0.1;
          break;

        case 3: // Jumping (only when mood is high)
          group.position.y = person.baseY + Math.max(0, Math.sin(time * 3 + phaseOffset)) * intensity.jump;
          group.rotation.x = Math.sin(time * 3 + phaseOffset) * 0.1;
          break;

        default: // Head bob
          group.position.y = person.baseY + Math.sin(time * 1.5 + phaseOffset) * intensity.bounce * 0.5;
          group.rotation.x = Math.sin(time * 2 + phaseOffset) * 0.15;
          break;
      }
    });
  });

  return (
    <group>
      {crowdData.map((person) => {
        // Deterministic appearance based on seed
        const shirtColor = person.showMerch ? bandMerchColor : shirtColors[person.colorVariant % shirtColors.length];
        const pantsColor = pantsColors[Math.floor(person.seed * 7) % pantsColors.length];
        const skinColor = skinTones[Math.floor(person.seed * 13) % skinTones.length];

        return (
          <group
            key={person.id}
            ref={(group) => {
              if (group) groupRefs.current.set(person.id, group);
            }}
            position={[person.position[0], person.position[1], person.position[2]]}
            scale={person.scale}
          >
            {/* Body - ultra minimal geometry */}
            <mesh position={[0, 0.5, 0]}>
              <capsuleGeometry args={[0.15, 0.5, 2, 4]} />
              <meshBasicMaterial color={shirtColor} />
            </mesh>

            {/* Head - minimal segments */}
            <mesh position={[0, 0.95, 0]}>
              <sphereGeometry args={[0.12, 4, 4]} />
              <meshBasicMaterial color={skinColor} />
            </mesh>

            {/* Arms - minimal geometry */}
            <mesh position={[-0.2, 0.6, 0]}>
              <capsuleGeometry args={[0.04, 0.3, 2, 3]} />
              <meshBasicMaterial color={skinColor} />
            </mesh>
            <mesh position={[0.2, 0.6, 0]}>
              <capsuleGeometry args={[0.04, 0.3, 2, 3]} />
              <meshBasicMaterial color={skinColor} />
            </mesh>

            {/* Legs - minimal geometry */}
            <mesh position={[-0.08, 0.15, 0]}>
              <capsuleGeometry args={[0.06, 0.3, 2, 3]} />
              <meshBasicMaterial color={pantsColor} />
            </mesh>
            <mesh position={[0.08, 0.15, 0]}>
              <capsuleGeometry args={[0.06, 0.3, 2, 3]} />
              <meshBasicMaterial color={pantsColor} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};
