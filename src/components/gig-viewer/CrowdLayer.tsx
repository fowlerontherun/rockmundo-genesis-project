import { useRef, useMemo, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { InstancedMesh, Object3D } from "three";
import { supabase } from "@/integrations/supabase/client";

// Import all 10 crowd sprite variations
import crowdSprite1 from "@/assets/crowd-sprite-01.png";
import crowdSprite2 from "@/assets/crowd-sprite-02.png";
import crowdSprite3 from "@/assets/crowd-sprite-03.png";
import crowdSprite4 from "@/assets/crowd-sprite-04.png";
import crowdSprite5 from "@/assets/crowd-sprite-05.png";
import crowdSprite6 from "@/assets/crowd-sprite-06.png";
import crowdSprite7 from "@/assets/crowd-sprite-07.png";
import crowdSprite8 from "@/assets/crowd-sprite-08.png";
import crowdSprite9 from "@/assets/crowd-sprite-09.png";
import crowdSprite10 from "@/assets/crowd-sprite-10.png";

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

type AnimationType = 'bored' | 'jumping' | 'hands_up' | 'bouncing' | 'tired' | 'ecstatic';

export const CrowdLayer = ({ 
  crowdMood, 
  stageTemplateId,
  bandFame = 100,
  bandMerchColor = "#ff0000",
  maxCrowdCount = 1000,
  densityMultiplier = 1.0
}: CrowdLayerProps) => {
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);
  const [crowdZones, setCrowdZones] = useState<CrowdZone[]>([
    { name: "pit", x: 0, z: 4, width: 10, depth: 4, density: 1.0, minMood: 0 },
    { name: "floor", x: 0, z: 10, width: 16, depth: 6, density: 0.8, minMood: 0 },
    { name: "back", x: 0, z: 18, width: 20, depth: 6, density: 0.5, minMood: 0 }
  ]);
  
  // Load all 10 crowd textures
  const crowdTextures = useTexture([
    crowdSprite1,
    crowdSprite2,
    crowdSprite3,
    crowdSprite4,
    crowdSprite5,
    crowdSprite6,
    crowdSprite7,
    crowdSprite8,
    crowdSprite9,
    crowdSprite10,
  ]);

  // Configure textures for pixel-perfect rendering with proper transparency
  crowdTextures.forEach(texture => {
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
  });

  // Custom shader for color-keying background removal
  const onBeforeCompile = (shader: any) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      #include <map_fragment>
      
      // Color-key background removal
      vec3 color = diffuseColor.rgb;
      float brightness = (color.r + color.g + color.b) / 3.0;
      
      // Discard very bright pixels (white/light grey backgrounds)
      if (brightness > 0.85 && 
          abs(color.r - color.g) < 0.1 && 
          abs(color.g - color.b) < 0.1) {
        discard;
      }
      
      // Discard very dark pixels (black backgrounds)
      if (brightness < 0.15) {
        discard;
      }
      `
    );
  };

  // Fetch crowd zones from stage template
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

  // Calculate percentage wearing merch based on band fame
  const merchPercentage = useMemo(() => {
    if (bandFame < 100) return 0;
    if (bandFame < 500) return 0.05;
    if (bandFame < 1000) return 0.15;
    if (bandFame < 5000) return 0.30;
    return 0.50;
  }, [bandFame]);

  // Generate crowd data distributed across zones
  const crowdData = useMemo(() => {
    const crowd: CrowdPerson[] = [];

    for (let i = 0; i < crowdZones.length; i++) {
      const zone = crowdZones[i];
      
      if (crowdMood < zone.minMood) continue;
      
      const zoneCount = Math.min(
        Math.floor(zone.density * zone.width * zone.depth * densityMultiplier * 5),
        maxCrowdCount - crowd.length
      );
      
      const baseX = zone.x - zone.width / 2;
      const baseZ = zone.z - zone.depth / 2;

      for (let j = 0; j < zoneCount; j++) {
        const x = baseX + Math.random() * zone.width;
        const yOffset = Math.random() * 0.15; // Height variation
        const y = yOffset;
        const z = baseZ + Math.random() * zone.depth;

        crowd.push({
          position: [x, y, z],
          seed: Math.random() * 1000,
          zone: i,
          hasMerch: Math.random() < merchPercentage,
          spriteVariation: Math.floor(Math.random() * 10) // 0-9 for 10 sprites
        });
      }
    }

    return crowd;
  }, [crowdZones, crowdMood, maxCrowdCount, densityMultiplier, merchPercentage]);

  // Split crowd into 10 groups by sprite variation
  const crowdGroups = useMemo(() => {
    const groups: CrowdPerson[][] = [[], [], [], [], [], [], [], [], [], []];
    crowdData.forEach(person => {
      groups[person.spriteVariation].push(person);
    });
    return groups;
  }, [crowdData]);

  // Determine animation type based on mood
  const getAnimationType = (): AnimationType => {
    if (crowdMood < 20) return 'tired';
    if (crowdMood < 40) return 'bored';
    if (crowdMood < 60) return 'bouncing';
    if (crowdMood < 80) return 'hands_up';
    if (crowdMood < 95) return 'jumping';
    return 'ecstatic';
  };

  // Animation loop for each sprite group
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const animType = getAnimationType();
    const dummy = new Object3D();

    crowdGroups.forEach((group, spriteIndex) => {
      const mesh = meshRefs.current[spriteIndex];
      if (!mesh || group.length === 0) return;

      group.forEach((person, i) => {
        const [x, baseY, z] = person.position;
        const seed = person.seed;
        const timeOffset = seed / 100;
        
        let y = baseY;
        let scale = 0.6; // Base scale

        // Apply animation based on mood
        switch (animType) {
          case 'bored':
            y += Math.sin(time * 0.5 + timeOffset) * 0.05;
            scale *= 1.0 + Math.sin(time * 0.3 + timeOffset) * 0.02;
            break;
          case 'bouncing':
            y += Math.abs(Math.sin(time * 2 + timeOffset)) * 0.15;
            scale *= 1.0 + Math.abs(Math.sin(time * 2 + timeOffset)) * 0.05;
            break;
          case 'hands_up':
            y += Math.abs(Math.sin(time * 2.5 + timeOffset)) * 0.20;
            scale *= 1.0 + Math.abs(Math.sin(time * 2.5 + timeOffset)) * 0.08;
            break;
          case 'jumping':
            y += Math.abs(Math.sin(time * 3 + timeOffset)) * 0.35;
            scale *= 1.0 + Math.abs(Math.sin(time * 3 + timeOffset)) * 0.12;
            break;
          case 'ecstatic':
            y += Math.abs(Math.sin(time * 4 + timeOffset)) * 0.50;
            scale *= 1.0 + Math.abs(Math.sin(time * 4 + timeOffset)) * 0.18;
            break;
          case 'tired':
            y += Math.sin(time * 0.3 + timeOffset) * 0.03;
            scale *= 0.95;
            break;
        }

        // Position sprite with slight random rotation
        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.PI + (seed / 500 - 1) * 0.3; // Face stage with variance
        dummy.scale.set(scale, scale * 2.5, scale); // Taller aspect ratio
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
    });
  });

  // Get emissive properties based on mood
  const getEmissiveColor = (): string => {
    if (crowdMood > 80) return "#ff00ff";
    if (crowdMood > 60) return "#ff6600";
    if (crowdMood > 40) return "#ffaa00";
    return "#000000";
  };

  const getEmissiveIntensity = (): number => {
    return (crowdMood / 100) * 0.1; // Reduced for natural look
  };

  if (crowdData.length === 0) return null;

  return (
    <group>
      {crowdGroups.map((group, spriteIndex) => {
        if (group.length === 0) return null;
        
        return (
          <instancedMesh 
            key={spriteIndex}
            ref={(ref) => { meshRefs.current[spriteIndex] = ref; }}
            args={[undefined, undefined, group.length]}
          >
            <planeGeometry args={[0.6, 1.5]} />
            <meshStandardMaterial
              map={crowdTextures[spriteIndex]}
              transparent={true}
              alphaTest={0.5}
              side={THREE.DoubleSide}
              depthWrite={false}
              depthTest={true}
              toneMapped={false}
              emissive={getEmissiveColor()}
              emissiveIntensity={getEmissiveIntensity()}
              onBeforeCompile={onBeforeCompile}
            />
          </instancedMesh>
        );
      })}
    </group>
  );
};
