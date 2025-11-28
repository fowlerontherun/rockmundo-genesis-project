import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { PointLight, SpotLight, Color, Vector3 } from "three";
import { supabase } from "@/integrations/supabase/client";

interface StageLightingProps {
  crowdMood: number;
  songIntensity?: number;
  stageTemplateId?: string | null;
}

interface SpotlightConfig {
  position: Vector3;
  color: Color;
  intensity: number;
}

export const StageLighting = ({ crowdMood, songIntensity = 0.5, stageTemplateId }: StageLightingProps) => {
  const spotLight1Ref = useRef<SpotLight>(null);
  const spotLight2Ref = useRef<SpotLight>(null);
  const spotLight3Ref = useRef<SpotLight>(null);
  const colorLight1Ref = useRef<PointLight>(null);
  const colorLight2Ref = useRef<PointLight>(null);
  const [spotlights, setSpotlights] = useState<SpotlightConfig[]>([]);
  const [baseIntensity, setBaseIntensity] = useState(1.0);

  // Fetch lighting config from stage template
  useEffect(() => {
    const fetchLightingConfig = async () => {
      if (!stageTemplateId) {
        // Default spotlights
        setSpotlights([
          { position: new Vector3(-4, 8, -3), color: new Color("#ff00ff"), intensity: 2 },
          { position: new Vector3(4, 8, -3), color: new Color("#00ffff"), intensity: 2 },
          { position: new Vector3(0, 9, -2), color: new Color("#ffffff"), intensity: 2.5 }
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
        if (metadata.spotlights) {
          const configs = metadata.spotlights.map((light: any) => ({
            position: new Vector3(light.position[0], light.position[1], light.position[2]),
            color: new Color(light.color),
            intensity: light.intensity || 2
          }));
          setSpotlights(configs);
        }
        if (metadata.intensity) {
          setBaseIntensity(metadata.intensity);
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
      {/* Dynamic spotlights from template config */}
      {spotlights[0] && (
        <spotLight
          ref={spotLight1Ref}
          position={spotlights[0].position}
          angle={0.3}
          penumbra={0.4}
          intensity={spotlights[0].intensity}
          color={spotlights[0].color}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
      )}

      {spotlights[1] && (
        <spotLight
          ref={spotLight2Ref}
          position={spotlights[1].position}
          angle={0.3}
          penumbra={0.4}
          intensity={spotlights[1].intensity}
          color={spotlights[1].color}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
      )}

      {spotlights[2] && (
        <spotLight
          ref={spotLight3Ref}
          position={spotlights[2].position}
          angle={0.4}
          penumbra={0.3}
          intensity={spotlights[2].intensity}
          color={spotlights[2].color}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
      )}

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

      {/* Back rim lights */}
      <pointLight
        position={[-6, 4, -7]}
        intensity={1}
        color="#ff6600"
        distance={10}
      />

      <pointLight
        position={[6, 4, -7]}
        intensity={1}
        color="#6600ff"
        distance={10}
      />

      {/* Floor wash lights */}
      <spotLight
        position={[-3, 5, 0]}
        angle={0.6}
        penumbra={0.5}
        intensity={0.8}
        color="#ff0000"
        target-position={[0, 0, 2]}
      />

      <spotLight
        position={[3, 5, 0]}
        angle={0.6}
        penumbra={0.5}
        intensity={0.8}
        color="#0000ff"
        target-position={[0, 0, 2]}
      />
    </group>
  );
};
