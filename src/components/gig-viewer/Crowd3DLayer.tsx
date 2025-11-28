import { useMemo } from "react";
import { CrowdMember3D } from "./CrowdMember3D";

interface Crowd3DLayerProps {
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
}

export const Crowd3DLayer = ({
  crowdMood,
  bandFame,
  bandMerchColor,
  bandName = "BAND",
  maxCrowdCount,
  densityMultiplier
}: Crowd3DLayerProps) => {
  // Calculate merch percentage based on fame
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

    // Define crowd zones
    const zones = [
      { x: [-8, 8], z: [2, 6], density: 1.0, minMood: 0 },    // Front row
      { x: [-10, 10], z: [6, 10], density: 0.8, minMood: 20 }, // Middle
      { x: [-12, 12], z: [10, 14], density: 0.6, minMood: 40 } // Back
    ];

    let currentId = 0;

    for (const zone of zones) {
      if (crowdMood < zone.minMood) continue;

      const zoneCount = Math.floor((count / 3) * zone.density);

      for (let i = 0; i < zoneCount; i++) {
        const seed = Math.random();
        const x = zone.x[0] + Math.random() * (zone.x[1] - zone.x[0]);
        const z = zone.z[0] + Math.random() * (zone.z[1] - zone.z[0]);
        
        crowd.push({
          id: currentId++,
          position: [x, 0, z],
          seed,
          colorVariant: Math.floor(seed * 10),
          showMerch: Math.random() * 100 < merchPercentage,
          animationType: getAnimationType(crowdMood, seed),
          scale: 0.8 + Math.random() * 0.4 // Vary scale for variety
        });
      }
    }

    return crowd;
  }, [maxCrowdCount, densityMultiplier, crowdMood, merchPercentage, getAnimationType]);

  return (
    <group>
      {crowdData.map((person) => (
        <CrowdMember3D
          key={person.id}
          position={person.position}
          animationType={person.animationType}
          colorVariant={person.colorVariant}
          seed={person.seed}
          showMerch={person.showMerch}
          merchColor={bandMerchColor}
          bandName={bandName}
          scale={person.scale}
        />
      ))}
    </group>
  );
};
