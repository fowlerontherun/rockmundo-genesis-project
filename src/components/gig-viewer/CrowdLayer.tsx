import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Color } from "three";
import { supabase } from "@/integrations/supabase/client";

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
  id: string;
  position: [number, number, number];
  seed: number;
  zoneName: string;
  wearsMerch: boolean;
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
  const [crowdZones, setCrowdZones] = useState<CrowdZone[]>([]);

  useEffect(() => {
    const fetchStageTemplate = async () => {
      if (!stageTemplateId) {
        setCrowdZones([
          { name: "pit", x: 0, z: 4, width: 10, depth: 4, density: 1.0, minMood: 0 },
          { name: "floor", x: 0, z: 10, width: 16, depth: 6, density: 0.8, minMood: 0 },
          { name: "back", x: 0, z: 18, width: 20, depth: 6, density: 0.5, minMood: 0 }
        ]);
        return;
      }

      const { data } = await supabase
        .from('stage_templates')
        .select('metadata')
        .eq('id', stageTemplateId)
        .single();

      if (data?.metadata) {
        const metadata = data.metadata as any;
        if (metadata.crowdZones && Array.isArray(metadata.crowdZones)) {
          setCrowdZones(metadata.crowdZones);
        }
      }
    };

    fetchStageTemplate();
  }, [stageTemplateId]);

  const merchPercentage = useMemo(() => {
    if (bandFame < 100) return 0;
    if (bandFame < 500) return 0.05;
    if (bandFame < 1000) return 0.15;
    if (bandFame < 5000) return 0.30;
    return 0.50;
  }, [bandFame]);

  const crowdData = useMemo(() => {
    const people: CrowdPerson[] = [];
    let totalCount = 0;
    
    crowdZones.forEach(zone => {
      if (crowdMood < (zone.minMood || 0)) return;
      
      const baseCount = Math.floor(zone.density * 50 * densityMultiplier);
      const count = Math.min(baseCount, maxCrowdCount - totalCount);
      
      if (count <= 0 || totalCount >= maxCrowdCount) return;
      
      for (let i = 0; i < count; i++) {
        const x = zone.x + Math.random() * zone.width - zone.width / 2;
        const z = zone.z + Math.random() * zone.depth - zone.depth / 2;
        
        const wearsMerch = Math.random() < merchPercentage;
        
        people.push({
          id: `${zone.name}-${i}`,
          position: [x, 0, z],
          seed: Math.random(),
          zoneName: zone.name,
          wearsMerch,
        });
        
        totalCount++;
      }
    });
    
    return people;
  }, [crowdZones, crowdMood, merchPercentage, maxCrowdCount, densityMultiplier]);

  const getAnimationType = (index: number, mood: number): AnimationType => {
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

    crowdData.forEach((person, i) => {
      const animType = getAnimationType(i, crowdMood);
      const [x, , z] = person.position;
      const offset = person.seed * Math.PI * 2;

      let y = 0;
      let scale = 1;
      let rotY = 0;

      switch (animType) {
        case 'tired':
          y = Math.sin(time * 0.5 + offset) * 0.05;
          scale = 0.95;
          break;
        case 'bored':
          y = Math.sin(time * 0.8 + offset) * 0.08;
          rotY = Math.sin(time * 0.3 + offset) * 0.1;
          break;
        case 'bouncing':
          y = Math.abs(Math.sin(time * 2 + offset)) * 0.3;
          break;
        case 'jumping':
          y = Math.abs(Math.sin(time * 3 + offset)) * 0.5;
          scale = 1.0 + Math.sin(time * 3 + offset) * 0.1;
          break;
        case 'handsUp':
          y = Math.sin(time * 2.5 + offset) * 0.4;
          scale = 1.1;
          rotY = Math.sin(time * 0.5 + offset) * 0.2;
          break;
        case 'ecstatic':
          y = Math.abs(Math.sin(time * 4 + offset)) * 0.7;
          scale = 1.1 + Math.sin(time * 4 + offset) * 0.15;
          rotY = Math.sin(time * 2 + offset) * 0.3;
          break;
      }

      dummy.position.set(x, y + 0.5, z);
      dummy.rotation.y = rotY;
      dummy.scale.set(0.3, scale * 0.8, 0.3);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const getEmissiveColor = (): string => {
    if (crowdMood > 80) return "#ff00ff";
    if (crowdMood > 60) return "#ff0066";
    if (crowdMood > 40) return "#0066ff";
    return "#003366";
  };

  const getEmissiveIntensity = (): number => {
    return (crowdMood / 100) * 0.5;
  };

  const colors = useMemo(() => {
    return new Float32Array(
      crowdData.flatMap(person => {
        if (person.wearsMerch) {
          const merchColor = new Color(bandMerchColor);
          return [merchColor.r, merchColor.g, merchColor.b];
        } else {
          const skinTone = new Color().setHSL(0.08, 0.5, 0.4 + Math.random() * 0.2);
          return [skinTone.r, skinTone.g, skinTone.b];
        }
      })
    );
  }, [crowdData, bandMerchColor]);

  if (crowdData.length === 0) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, crowdData.length]} castShadow receiveShadow>
      <capsuleGeometry args={[0.15, 0.5, 4, 8]} />
      <meshStandardMaterial
        color="#cccccc"
        emissive={getEmissiveColor()}
        emissiveIntensity={getEmissiveIntensity()}
        roughness={0.8}
        metalness={0.2}
      >
        <instancedBufferAttribute attach="attributes.color" args={[colors, 3]} />
      </meshStandardMaterial>
    </instancedMesh>
  );
};
