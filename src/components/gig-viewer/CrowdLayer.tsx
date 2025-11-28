import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Color } from "three";
import { supabase } from "@/integrations/supabase/client";

interface CrowdLayerProps {
  crowdMood: number;
  stageTemplateId?: string;
  bandFame?: number;
  bandMerchColor?: string;
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
  x: number;
  z: number;
  animOffset: number;
  zone: string;
  hasMerch: boolean;
}

type AnimationType = 'tired' | 'bored' | 'bouncing' | 'jumping' | 'handsUp' | 'ecstatic';

export const CrowdLayer = ({ 
  crowdMood, 
  stageTemplateId,
  bandFame = 0,
  bandMerchColor = "#ff0066"
}: CrowdLayerProps) => {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const [crowdZones, setCrowdZones] = useState<CrowdZone[]>([]);

  // Fetch stage template with crowd zones
  useEffect(() => {
    const fetchStageTemplate = async () => {
      if (!stageTemplateId) {
        // Default zones if no template
        setCrowdZones([
          { name: "pit", x: 0, z: 4, width: 10, depth: 4, density: 1.2, minMood: 30 },
          { name: "floor", x: 0, z: 9, width: 12, depth: 6, density: 1.0, minMood: 20 }
        ]);
        return;
      }

      const { data, error } = await supabase
        .from('stage_templates')
        .select('metadata')
        .eq('id', stageTemplateId)
        .single();

      if (!error && data?.metadata) {
        const metadata = data.metadata as any;
        if (metadata.crowdZones) {
          setCrowdZones(metadata.crowdZones);
        }
      }
    };

    fetchStageTemplate();
  }, [stageTemplateId]);

  // Calculate merch percentage based on fame
  const merchPercentage = useMemo(() => {
    if (bandFame < 100) return 0;
    if (bandFame < 500) return 0.05;
    if (bandFame < 1000) return 0.15;
    if (bandFame < 5000) return 0.30;
    return 0.50;
  }, [bandFame]);

  // Generate crowd based on zones
  const crowdData = useMemo(() => {
    const data: CrowdPerson[] = [];
    
    crowdZones.forEach((zone) => {
      // Only show zone if mood meets minimum threshold
      if (crowdMood < zone.minMood) return;

      const baseCount = Math.floor((zone.width * zone.depth * zone.density) / 0.36);
      const cols = Math.ceil(Math.sqrt(baseCount * (zone.width / zone.depth)));
      const rows = Math.ceil(baseCount / cols);
      
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = zone.x + (col - cols / 2) * (zone.width / cols) + (Math.random() - 0.5) * 0.2;
          const z = zone.z - zone.depth / 2 + (row / rows) * zone.depth + (Math.random() - 0.5) * 0.2;
          const animOffset = Math.random() * Math.PI * 2;
          const hasMerch = Math.random() < merchPercentage;
          
          data.push({ x, z, animOffset, zone: zone.name, hasMerch });
        }
      }
    });
    
    return data;
  }, [crowdZones, crowdMood, merchPercentage]);

  // Determine animation distribution based on mood
  const getAnimationType = (index: number, mood: number): AnimationType => {
    const hash = (index * 12345 + mood) % 100;
    
    if (mood < 15) {
      return 'tired';
    } else if (mood < 30) {
      return hash < 70 ? 'bored' : 'tired';
    } else if (mood < 50) {
      return hash < 60 ? 'bouncing' : hash < 90 ? 'bored' : 'tired';
    } else if (mood < 70) {
      return hash < 40 ? 'bouncing' : hash < 75 ? 'jumping' : 'handsUp';
    } else if (mood < 85) {
      return hash < 30 ? 'jumping' : hash < 65 ? 'handsUp' : 'ecstatic';
    } else {
      return hash < 30 ? 'ecstatic' : hash < 60 ? 'jumping' : 'handsUp';
    }
  };

  // Animate crowd with 6 distinct animation types
  useFrame(({ clock }) => {
    if (!meshRef.current) return;

    const time = clock.getElapsedTime();
    
    crowdData.forEach((person, i) => {
      const animType = getAnimationType(i, crowdMood);
      let posY = 0.8;
      let sway = 0;
      let rotationY = 0;
      let scaleY = 1;
      
      switch (animType) {
        case 'tired':
          // Barely moving, occasional shift
          posY = 0.8 + Math.sin(time * 0.3 + person.animOffset) * 0.01;
          sway = Math.sin(time * 0.2 + person.animOffset) * 0.01;
          break;
          
        case 'bored':
          // Standing still, minimal sway
          posY = 0.8 + Math.sin(time * 0.5 + person.animOffset) * 0.02;
          sway = Math.sin(time * 0.3 + person.animOffset) * 0.02;
          break;
          
        case 'bouncing':
          // Rhythmic bounce to beat
          posY = 0.8 + Math.abs(Math.sin(time * 1.2 + person.animOffset)) * 0.12;
          sway = Math.sin(time * 0.6 + person.animOffset) * 0.06;
          rotationY = Math.sin(time * 0.5 + person.animOffset) * 0.12;
          break;
          
        case 'jumping':
          // Full vertical jumps
          posY = 0.8 + Math.abs(Math.sin(time * 2 + person.animOffset)) * 0.28;
          sway = Math.sin(time * 1.0 + person.animOffset) * 0.1;
          scaleY = 1 + Math.abs(Math.sin(time * 2 + person.animOffset)) * 0.1;
          break;
          
        case 'handsUp':
          // Arms raised, swaying
          posY = 0.8 + Math.sin(time * 1.5 + person.animOffset) * 0.15;
          sway = Math.sin(time * 0.8 + person.animOffset) * 0.12;
          rotationY = Math.sin(time * 0.6 + person.animOffset) * 0.18;
          scaleY = 1.15; // Taller to represent raised arms
          break;
          
        case 'ecstatic':
          // Wild jumping, moshing motion
          posY = 0.8 + Math.abs(Math.sin(time * 2.5 + person.animOffset)) * 0.35;
          sway = Math.sin(time * 1.5 + person.animOffset) * 0.18;
          rotationY = Math.sin(time * 1.2 + person.animOffset) * 0.25;
          scaleY = 1 + Math.abs(Math.sin(time * 2.5 + person.animOffset)) * 0.15;
          break;
      }
      
      dummy.position.set(
        person.x + sway,
        posY,
        person.z
      );
      dummy.rotation.y = rotationY;
      dummy.scale.set(1, scaleY, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Dynamic emissive color based on mood state
  const getEmissiveColor = () => {
    if (crowdMood >= 85) return "#ff3300"; // Ecstatic - bright red-orange
    if (crowdMood >= 70) return "#ff6600"; // Energetic - orange
    if (crowdMood >= 50) return "#ffaa00"; // Engaged - yellow-orange
    if (crowdMood >= 30) return "#4444ff"; // Warming - blue
    return "#000000"; // Bored - no glow
  };

  const getEmissiveIntensity = () => {
    if (crowdMood >= 85) return 0.5;
    if (crowdMood >= 70) return 0.35;
    if (crowdMood >= 50) return 0.2;
    if (crowdMood >= 30) return 0.1;
    return 0;
  };

  // Create color array for merch wearers
  const colors = useMemo(() => {
    const colorArray = new Float32Array(crowdData.length * 3);
    const baseColor = new Color("#1a1a2e");
    const merchColor = new Color(bandMerchColor);
    
    crowdData.forEach((person, i) => {
      const color = person.hasMerch ? merchColor : baseColor;
      colorArray[i * 3] = color.r;
      colorArray[i * 3 + 1] = color.g;
      colorArray[i * 3 + 2] = color.b;
    });
    
    return colorArray;
  }, [crowdData, bandMerchColor]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, crowdData.length]} castShadow>
      <capsuleGeometry args={[0.2, 0.8, 4, 8]} />
      <meshStandardMaterial 
        emissive={getEmissiveColor()}
        emissiveIntensity={getEmissiveIntensity()}
        vertexColors
      />
      <instancedBufferAttribute
        attach="geometry-attributes-color"
        args={[colors, 3]}
      />
    </instancedMesh>
  );
};
