import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useLoader } from "@react-three/fiber";
import { TextureLoader, InstancedMesh, Object3D } from "three";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";

// Import crowd sprite variations
import crowdSprite01 from "@/assets/crowd-sprite-01.gif";
import crowdSprite02 from "@/assets/crowd-sprite-02.png";
import crowdSprite03 from "@/assets/crowd-sprite-03.png";
import crowdSprite04 from "@/assets/crowd-sprite-04.png";
import crowdSprite05 from "@/assets/crowd-sprite-05.png";
import crowdSprite06 from "@/assets/crowd-sprite-06.png";

interface CrowdLayerProps {
  crowdMood: number;
  stageTemplateId?: string | null;
  bandFame?: number;
  bandMerchColor?: string;
  maxCrowdCount?: number;
  densityMultiplier?: number;
}

interface CrowdZone {
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  density: number;
  minMood: number;
}

interface CrowdPerson {
  position: [number, number, number];
  seed: number;
  zone: number;
  hasMerch: boolean;
  spriteVariation: number;
}

type AnimationType = 'tired' | 'bored' | 'bouncing' | 'jumping' | 'handsUp' | 'ecstatic';

export const CrowdLayer = ({ 
  crowdMood, 
  stageTemplateId, 
  bandFame = 100, 
  bandMerchColor = "#ff0000",
  maxCrowdCount = 1000,
  densityMultiplier = 1.0 
}: CrowdLayerProps) => {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  // Load crowd sprite textures
  const crowdTextures = useLoader(TextureLoader, [
    crowdSprite01,
    crowdSprite02,
    crowdSprite03,
    crowdSprite04,
    crowdSprite05,
    crowdSprite06,
  ]);

  // Configure textures for better rendering
  crowdTextures.forEach(texture => {
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
  });

  const [crowdZones, setCrowdZones] = useState<CrowdZone[]>([
    { name: "pit", x: 0, z: 4, width: 10, depth: 4, density: 1.0, minMood: 0 },
    { name: "floor", x: 0, z: 10, width: 16, depth: 6, density: 0.8, minMood: 0 },
    { name: "back", x: 0, z: 18, width: 20, depth: 6, density: 0.5, minMood: 0 }
  ]);

  // Fetch lighting config from stage template
  useEffect(() => {
    const fetchCrowdZones = async () => {
      if (!stageTemplateId) return;

      const { data, error } = await supabase
        .from('stage_templates')
        .select('metadata')
        .eq('id', stageTemplateId)
        .single();

      if (!error && data?.metadata) {
        const metadata = data.metadata as any;
        if (metadata.crowdZones && Array.isArray(metadata.crowdZones)) {
          setCrowdZones(metadata.crowdZones);
        }
      }
    };

    fetchCrowdZones();
  }, [stageTemplateId]);

  const merchPercentage = useMemo(() => {
    if (bandFame < 100) return 0;
    if (bandFame < 500) return 0.05;
    if (bandFame < 1000) return 0.15;
    if (bandFame < 5000) return 0.30;
    return 0.50;
  }, [bandFame]);

  const crowdData = useMemo(() => {
    const generatedCrowd: CrowdPerson[] = [];
    
    for (let i = 0; i < crowdZones.length; i++) {
      const zone = crowdZones[i];
      
      if (crowdMood < zone.minMood) continue;
      
      const zoneCount = Math.min(
        Math.floor(zone.density * zone.width * zone.depth * densityMultiplier * 5),
        maxCrowdCount - generatedCrowd.length
      );
      
      const baseX = zone.x - zone.width / 2;
      const baseZone = zone.z - zone.depth / 2;
      const verticalSpread = 0.2;
      const depthSpread = zone.depth;
      
      for (let j = 0; j < zoneCount; j++) {
        const randomX = baseX + Math.random() * zone.width;
        const baseY = 0;
        const randomY = baseY + (Math.random() - 0.5) * verticalSpread;
        const randomZ = baseZone + Math.random() * depthSpread;

        // Random seed for animation variation
        const seed = Math.random() * 1000;
        
        // Random sprite variation (0-5 for 6 different sprites)
        const spriteVariation = Math.floor(Math.random() * 6);

        const hasMerch = Math.random() < merchPercentage;

        generatedCrowd.push({
          position: [randomX, randomY, randomZ],
          seed,
          zone: i,
          hasMerch,
          spriteVariation
        });
      }
    }
    
    return generatedCrowd;
  }, [crowdZones, crowdMood, merchPercentage, densityMultiplier, maxCrowdCount]);

  // Animation type based on crowd mood
  const getAnimationType = (mood: number): AnimationType => {
    if (mood < 20) return 'tired';
    if (mood < 40) return 'bored';
    if (mood < 60) return 'bouncing';
    if (mood < 75) return 'jumping';
    if (mood < 90) return 'handsUp';
    return 'ecstatic';
  };

  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const time = clock.getElapsedTime();
    const animType = getAnimationType(crowdMood);

    crowdData.forEach((person, i) => {
      dummy.position.set(...person.position);

      // Set scale - larger for better visibility (0.8 x 1.8 units)
      const baseScale = 0.8;

      // Apply animation based on mood
      if (animType === 'jumping') {
        dummy.position.y += Math.sin(time * 3 + person.seed) * 0.3;
        dummy.scale.set(baseScale, baseScale * 2.2 * (1 + Math.sin(time * 3 + person.seed) * 0.15), baseScale);
      } else if (animType === 'handsUp') {
        dummy.scale.set(baseScale * 1.1, baseScale * 2.3, baseScale);
        dummy.position.y += Math.sin(time * 2 + person.seed) * 0.08;
      } else if (animType === 'bouncing') {
        dummy.position.y += Math.sin(time * 4 + person.seed) * 0.15;
        dummy.scale.set(baseScale, baseScale * 2.2 * (1 + Math.sin(time * 4 + person.seed) * 0.08), baseScale);
      } else if (animType === 'ecstatic') {
        dummy.position.y += Math.sin(time * 5 + person.seed) * 0.4;
        dummy.scale.set(baseScale * 1.15, baseScale * 2.4, baseScale);
        dummy.rotation.z = Math.sin(time * 3 + person.seed) * 0.1;
      } else {
        dummy.scale.set(baseScale, baseScale * 2.2, baseScale);
      }

      // Face the stage (back view sprites)
      dummy.rotation.y = Math.PI;

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Get emissive properties based on mood
  const getEmissiveColor = (): string => {
    if (crowdMood > 80) return "#ff00ff";
    if (crowdMood > 60) return "#ff0066";
    if (crowdMood > 40) return "#0066ff";
    return "#003366";
  };

  const getEmissiveIntensity = (): number => {
    return (crowdMood / 100) * 0.3;
  };

  // Select a texture based on crowd data variation - simple cycling approach
  const getCurrentTexture = () => {
    // Cycle through textures based on time for variety
    const textureIndex = Math.floor(Date.now() / 1000) % crowdTextures.length;
    return crowdTextures[textureIndex];
  };

  if (crowdData.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, crowdData.length]}>
      <planeGeometry args={[1, 2.2]} />
      <meshStandardMaterial
        map={getCurrentTexture()}
        transparent
        alphaTest={0.5}
        side={THREE.DoubleSide}
        emissive={getEmissiveColor()}
        emissiveIntensity={getEmissiveIntensity()}
      />
    </instancedMesh>
  );
};
