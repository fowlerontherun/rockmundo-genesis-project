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
  animationType: 'idle' | 'bouncing' | 'jumping' | 'handsup' | 'headbang' | 'sway';
  scale: number;
  baseY: number;
  showDetails: boolean;
}

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

  // Determine animation type based on mood
  const getAnimationType = (mood: number, seed: number): CrowdPerson['animationType'] => {
    const rand = seed * 100;
    if (mood < 20) return 'idle';
    if (mood < 40) return rand < 50 ? 'idle' : 'sway';
    if (mood < 60) return rand < 30 ? 'sway' : rand < 70 ? 'bouncing' : 'handsup';
    if (mood < 80) return rand < 40 ? 'bouncing' : rand < 70 ? 'handsup' : 'jumping';
    return rand < 30 ? 'jumping' : rand < 60 ? 'handsup' : 'headbang';
  };

  // Generate crowd data
  const crowdData = useMemo(() => {
    const count = Math.floor(maxCrowdCount * densityMultiplier);
    const crowd: CrowdPerson[] = [];

    const zones = [
      { x: [-8, 8], z: [2, 6], density: 1.0, minMood: 0 },
      { x: [-10, 10], z: [6, 10], density: 0.8, minMood: 20 },
      { x: [-12, 12], z: [10, 14], density: 0.6, minMood: 40 }
    ];

    let currentId = 0;

    for (const zone of zones) {
      if (crowdMood < zone.minMood) continue;

      const zoneCount = Math.floor((count / 3) * zone.density);

      for (let i = 0; i < zoneCount; i++) {
        const seed = Math.random();
        const x = zone.x[0] + Math.random() * (zone.x[1] - zone.x[0]);
        const z = zone.z[0] + Math.random() * (zone.z[1] - zone.z[0]);
        const baseY = 0;
        
        crowd.push({
          id: currentId++,
          position: [x, baseY, z],
          seed,
          colorVariant: Math.floor(seed * 10),
          showMerch: Math.random() * 100 < merchPercentage,
          animationType: getAnimationType(crowdMood, seed),
          scale: 0.8 + Math.random() * 0.4,
          baseY,
          showDetails: z < 7 // Only front row gets details
        });

        // Initialize ref
        crowdRefs.current.set(currentId - 1, {
          position: new THREE.Vector3(x, baseY, z),
          rotation: new THREE.Euler(0, 0, 0)
        });
      }
    }

    return crowd;
  }, [maxCrowdCount, densityMultiplier, crowdMood, merchPercentage]);

  // Batched animation update
  useFrame((state, delta) => {
    timeSinceLastUpdate.current += delta;
    
    if (timeSinceLastUpdate.current < animationInterval) return;
    timeSinceLastUpdate.current = 0;

    const time = state.clock.getElapsedTime();

    crowdData.forEach((person) => {
      const ref = crowdRefs.current.get(person.id);
      if (!ref) return;

      const phaseOffset = person.seed * 10;

      switch (person.animationType) {
        case 'idle':
          ref.position.y = person.baseY + Math.sin(time * 0.5 + phaseOffset) * 0.02;
          break;

        case 'sway':
          ref.position.y = person.baseY + Math.sin(time + phaseOffset) * 0.03;
          ref.rotation.z = Math.sin(time * 0.8 + phaseOffset) * 0.1;
          break;

        case 'bouncing':
          ref.position.y = person.baseY + Math.abs(Math.sin(time * 2 + phaseOffset)) * 0.15;
          break;

        case 'jumping':
          ref.position.y = person.baseY + Math.max(0, Math.sin(time * 3 + phaseOffset)) * 0.3;
          break;

        case 'handsup':
          ref.position.y = person.baseY + Math.sin(time * 1.5 + phaseOffset) * 0.1;
          break;

        case 'headbang':
          ref.position.y = person.baseY + Math.abs(Math.sin(time * 4 + phaseOffset)) * 0.2;
          ref.rotation.x = Math.sin(time * 4 + phaseOffset) * 0.3;
          break;
      }
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
