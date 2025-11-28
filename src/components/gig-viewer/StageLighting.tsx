import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { PointLight, SpotLight } from "three";
import { supabase } from "@/integrations/supabase/client";

interface StageLightingProps {
  crowdMood: number;
  songIntensity: number;
  stageTemplateId?: string | null;
  enableShadows?: boolean;
}

interface SpotlightConfigData {
  position: [number, number, number];
  color: string;
  intensity: number;
}

export const StageLighting = ({ crowdMood, songIntensity, stageTemplateId, enableShadows = true }: StageLightingProps) => {
  const spotLight1Ref = useRef<SpotLight>(null);
  const spotLight2Ref = useRef<SpotLight>(null);
  const spotLight3Ref = useRef<SpotLight>(null);
  const colorLight1Ref = useRef<PointLight>(null);
  const colorLight2Ref = useRef<PointLight>(null);
  const [spotlights, setSpotlights] = useState<SpotlightConfigData[]>([
    { position: [-4, 8, -3], color: "#ff00ff", intensity: 2 },
    { position: [4, 8, -3], color: "#00ffff", intensity: 2 },
    { position: [0, 9, -2], color: "#ffffff", intensity: 2.5 }
  ]);
  const [baseIntensity, setBaseIntensity] = useState(1.0);

  // Fetch lighting config from stage template
  useEffect(() => {
    const fetchLightingConfig = async () => {
      if (!stageTemplateId) return;

      const { data, error } = await supabase
        .from('stage_templates')
        .select('metadata')
        .eq('id', stageTemplateId)
        .single();

      if (!error && data?.metadata) {
        const metadata = data.metadata as any;
        if (metadata.spotlights && Array.isArray(metadata.spotlights)) {
          setSpotlights(metadata.spotlights);
        }
        if (metadata.baseIntensity !== undefined) {
          setBaseIntensity(metadata.baseIntensity);
        }
      }
    };

    fetchLightingConfig();
  }, [stageTemplateId]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const intensity = (crowdMood / 100) * songIntensity * baseIntensity;

    // Pulsing spotlights
    if (spotLight1Ref.current) {
      spotLight1Ref.current.intensity = 2 + Math.sin(time * 2) * intensity;
      spotLight1Ref.current.angle = 0.3 + Math.sin(time * 1.5) * 0.1;
    }

    if (spotLight2Ref.current) {
      spotLight2Ref.current.intensity = 2 + Math.cos(time * 2.5) * intensity;
      spotLight2Ref.current.angle = 0.3 + Math.cos(time * 1.2) * 0.1;
    }

    if (spotLight3Ref.current) {
      spotLight3Ref.current.intensity = 2.5 + Math.sin(time * 3) * intensity;
    }

    // Moving colored lights
    if (colorLight1Ref.current) {
      colorLight1Ref.current.position.x = Math.sin(time * 0.8) * 5;
      colorLight1Ref.current.intensity = 1.5 + Math.sin(time * 4) * 0.5 * intensity;
    }

    if (colorLight2Ref.current) {
      colorLight2Ref.current.position.x = Math.cos(time * 0.6) * 5;
      colorLight2Ref.current.intensity = 1.5 + Math.cos(time * 3) * 0.5 * intensity;
    }
  });

  return (
    <group>
      <ambientLight intensity={baseIntensity * 0.3} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={baseIntensity * 0.5}
        castShadow={enableShadows}
      />
      
      {spotlights.map((spotlight, index) => (
        <spotLight
          key={index}
          position={spotlight.position as [number, number, number]}
          angle={0.5}
          penumbra={0.5}
          intensity={spotlight.intensity * songIntensity}
          color={spotlight.color}
          castShadow={enableShadows}
        />
      ))}

      {/* Dynamic colored lights */}
      <pointLight
        ref={colorLight1Ref}
        position={[0, 6, -5]}
        intensity={1.5}
        color="#ff0066"
        distance={12}
      />

      <pointLight
        ref={colorLight2Ref}
        position={[0, 6, -5]}
        intensity={1.5}
        color="#0066ff"
        distance={12}
      />
    </group>
  );
};
