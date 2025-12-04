import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { SimpleCrowdMember } from "./SimpleCrowdMember";
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
  showDetails: boolean;
}

// Seeded random number generator for deterministic positions
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const OptimizedCrowdLayer = ({
  crowdMood,
  bandFame,
  bandMerchColor,
  bandName = "BAND",
  maxCrowdCount,
  densityMultiplier
}: OptimizedCrowdLayerProps) => {
  const crowdRefs = useRef<Map<number, { position: THREE.Vector3; rotation: THREE.Euler }>>(new Map());
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
        // Use deterministic seed based on ID, not Math.random()
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
          baseY,
          showDetails: z < 5 // Only very front row gets details
        });

        // Initialize ref with fixed position
        crowdRefs.current.set(currentId, {
          position: new THREE.Vector3(x, baseY, z),
          rotation: new THREE.Euler(0, 0, 0)
        });

        currentId++;
      }
    }

    return crowd;
  }, [maxCrowdCount, densityMultiplier, merchPercentage]); // Removed crowdMood dependency

  // Determine animation intensity based on mood (computed each frame, not stored)
  const getAnimationIntensity = (mood: number): { bounce: number; sway: number; jump: number } => {
    if (mood < 20) return { bounce: 0.02, sway: 0.05, jump: 0 };
    if (mood < 40) return { bounce: 0.05, sway: 0.1, jump: 0 };
    if (mood < 60) return { bounce: 0.1, sway: 0.15, jump: 0.1 };
    if (mood < 80) return { bounce: 0.15, sway: 0.2, jump: 0.2 };
    return { bounce: 0.2, sway: 0.25, jump: 0.3 };
  };

  // Batched animation update - crowd stays in place, only animates
  useFrame((state, delta) => {
    timeSinceLastUpdate.current += delta;
    
    if (timeSinceLastUpdate.current < animationInterval) return;
    timeSinceLastUpdate.current = 0;

    const time = state.clock.getElapsedTime();
    const intensity = getAnimationIntensity(crowdMood);

    crowdData.forEach((person) => {
      const ref = crowdRefs.current.get(person.id);
      if (!ref) return;

      const phaseOffset = person.seed * 10;
      const animType = Math.floor(person.seed * 5); // Deterministic animation type per person

      // Keep original X and Z position, only animate Y and rotation
      const originalX = person.position[0];
      const originalZ = person.position[2];

      switch (animType) {
        case 0: // Idle sway
          ref.position.y = person.baseY + Math.sin(time * 0.5 + phaseOffset) * intensity.sway * 0.5;
          ref.rotation.z = Math.sin(time * 0.3 + phaseOffset) * 0.05;
          break;

        case 1: // Bouncing
          ref.position.y = person.baseY + Math.abs(Math.sin(time * 2 + phaseOffset)) * intensity.bounce;
          ref.rotation.z = 0;
          break;

        case 2: // Side sway
          ref.position.y = person.baseY + Math.sin(time + phaseOffset) * intensity.sway * 0.3;
          ref.rotation.z = Math.sin(time * 0.8 + phaseOffset) * 0.1;
          break;

        case 3: // Jumping (only when mood is high)
          ref.position.y = person.baseY + Math.max(0, Math.sin(time * 3 + phaseOffset)) * intensity.jump;
          ref.rotation.x = Math.sin(time * 3 + phaseOffset) * 0.1;
          break;

        default: // Head bob
          ref.position.y = person.baseY + Math.sin(time * 1.5 + phaseOffset) * intensity.bounce * 0.5;
          ref.rotation.x = Math.sin(time * 2 + phaseOffset) * 0.15;
          break;
      }

      // Ensure X and Z never change
      ref.position.x = originalX;
      ref.position.z = originalZ;
    });
  });

  return (
    <group>
      {crowdData.map((person) => {
        const ref = crowdRefs.current.get(person.id);
        if (!ref) return null;

        return (
          <SimpleCrowdMember
            key={person.id}
            position={[ref.position.x, ref.position.y, ref.position.z]}
            rotation={[ref.rotation.x, ref.rotation.y, ref.rotation.z]}
            colorVariant={person.colorVariant}
            seed={person.seed}
            showMerch={person.showMerch}
            merchColor={bandMerchColor}
            bandName={bandName}
            scale={person.scale}
            showDetails={person.showDetails}
          />
        );
      })}
    </group>
  );
};
