import { useRef, useState, useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { PointLight, SpotLight } from "three";
import { supabase } from "@/integrations/supabase/client";
import * as THREE from "three";

interface StageLightingProps {
  crowdMood: number;
  songIntensity: number;
  stageTemplateId?: string | null;
  enableShadows?: boolean;
  songSection?: string;
}

interface SpotlightConfigData {
  position: [number, number, number];
  color: string;
  intensity: number;
}

export const StageLighting = ({ 
  crowdMood, 
  songIntensity, 
  stageTemplateId, 
  enableShadows = true,
  songSection = 'verse'
}: StageLightingProps) => {
  // Moving head spotlights
  const movingHead1Ref = useRef<SpotLight>(null);
  const movingHead2Ref = useRef<SpotLight>(null);
  const movingHead3Ref = useRef<SpotLight>(null);
  const movingHead4Ref = useRef<SpotLight>(null);
  
  // Wash lights (color banks)
  const washLight1Ref = useRef<PointLight>(null);
  const washLight2Ref = useRef<PointLight>(null);
  const washLight3Ref = useRef<PointLight>(null);
  const washLight4Ref = useRef<PointLight>(null);
  
  // Strobe light
  const strobeRef = useRef<PointLight>(null);
  
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

  // Get color palette based on section and intensity (memoized)
  const getLightingPalette = useMemo(() => {
    const intensity = (crowdMood / 100) * songIntensity;
    
    if (songSection === 'chorus' || songSection === 'bigChorus') {
      return {
        primary: intensity > 0.7 ? '#ffffff' : '#ff3366',
        secondary: '#00ffff',
        accent: '#ffff00',
        wash: '#ff00ff'
      };
    } else if (songSection === 'intro' || songSection === 'outro') {
      return {
        primary: '#0066ff',
        secondary: '#6600ff',
        accent: '#ff0066',
        wash: '#330099'
      };
    } else if (songSection === 'bridge') {
      return {
        primary: '#ff6600',
        secondary: '#00ff66',
        accent: '#ff00ff',
        wash: '#6600ff'
      };
    } else {
      return {
        primary: '#ff0066',
        secondary: '#ff9900',
        accent: '#00ffff',
        wash: '#ff00ff'
      };
    }
  }, [crowdMood, songIntensity, songSection]);

  // Frame throttling for performance
  const frameSkip = useRef(0);

  useFrame(({ clock }) => {
    frameSkip.current++;
    if (frameSkip.current < 3) return; // Update every 3 frames
    frameSkip.current = 0;
    const time = clock.getElapsedTime();
    const intensity = (crowdMood / 100) * songIntensity * baseIntensity;
    const palette = getLightingPalette;

    // Moving head spotlights with sweeping beams
    if (movingHead1Ref.current) {
      movingHead1Ref.current.intensity = 3 + Math.sin(time * 2) * intensity * 2;
      movingHead1Ref.current.angle = 0.4 + Math.sin(time * 1.5) * 0.15;
      movingHead1Ref.current.target.position.set(
        Math.sin(time * 0.8) * 4,
        0,
        -5 + Math.cos(time * 0.5) * 3
      );
      movingHead1Ref.current.color.set(palette.primary);
    }

    if (movingHead2Ref.current) {
      movingHead2Ref.current.intensity = 3 + Math.cos(time * 2.5) * intensity * 2;
      movingHead2Ref.current.angle = 0.4 + Math.cos(time * 1.2) * 0.15;
      movingHead2Ref.current.target.position.set(
        Math.cos(time * 0.7) * 4,
        0,
        -5 + Math.sin(time * 0.6) * 3
      );
      movingHead2Ref.current.color.set(palette.secondary);
    }

    if (movingHead3Ref.current) {
      movingHead3Ref.current.intensity = 3.5 + Math.sin(time * 3) * intensity * 2;
      movingHead3Ref.current.angle = 0.3 + Math.sin(time * 2) * 0.1;
      movingHead3Ref.current.target.position.set(
        Math.sin(time * 1.2) * 3,
        0,
        -4
      );
      movingHead3Ref.current.color.set(palette.accent);
    }

    if (movingHead4Ref.current) {
      movingHead4Ref.current.intensity = 3 + Math.cos(time * 2.8) * intensity * 2;
      movingHead4Ref.current.angle = 0.35 + Math.cos(time * 1.8) * 0.12;
      movingHead4Ref.current.target.position.set(
        Math.cos(time * 1.1) * 3,
        0,
        -6
      );
      movingHead4Ref.current.color.set(palette.wash);
    }

    // Wash lights - color banks that flood the stage
    if (washLight1Ref.current) {
      washLight1Ref.current.intensity = 2 + Math.sin(time * 1.5) * intensity * 1.5;
      washLight1Ref.current.color.set(palette.primary);
    }

    if (washLight2Ref.current) {
      washLight2Ref.current.intensity = 2 + Math.cos(time * 1.3) * intensity * 1.5;
      washLight2Ref.current.color.set(palette.secondary);
    }

    if (washLight3Ref.current) {
      washLight3Ref.current.intensity = 2 + Math.sin(time * 1.7) * intensity * 1.5;
      washLight3Ref.current.color.set(palette.accent);
    }

    if (washLight4Ref.current) {
      washLight4Ref.current.intensity = 2 + Math.cos(time * 1.4) * intensity * 1.5;
      washLight4Ref.current.color.set(palette.wash);
    }

    // Strobe effect for high-energy moments
    if (strobeRef.current) {
      const strobeActive = (songSection === 'chorus' || songSection === 'bigChorus') && intensity > 0.7;
      if (strobeActive) {
        // Fast strobe
        strobeRef.current.intensity = Math.floor(time * 8) % 2 === 0 ? 5 : 0;
      } else {
        strobeRef.current.intensity = 0;
      }
    }
  });

  return (
    <group>
      {/* Base ambient lighting */}
      <ambientLight intensity={baseIntensity * 0.2} />
      
      {/* Key light */}
      <directionalLight
        position={[10, 10, 5]}
        intensity={baseIntensity * 0.4}
        castShadow={enableShadows}
      />
      
      {/* Moving head spotlights */}
      <spotLight
        ref={movingHead1Ref}
        position={[-5, 8, -3]}
        angle={0.4}
        penumbra={0.3}
        intensity={3}
        distance={20}
        castShadow={enableShadows}
      />
      
      <spotLight
        ref={movingHead2Ref}
        position={[5, 8, -3]}
        angle={0.4}
        penumbra={0.3}
        intensity={3}
        distance={20}
        castShadow={enableShadows}
      />
      
      <spotLight
        ref={movingHead3Ref}
        position={[-3, 9, -1]}
        angle={0.3}
        penumbra={0.4}
        intensity={3.5}
        distance={18}
        castShadow={enableShadows}
      />
      
      <spotLight
        ref={movingHead4Ref}
        position={[3, 9, -1]}
        angle={0.35}
        penumbra={0.4}
        intensity={3}
        distance={18}
        castShadow={enableShadows}
      />

      {/* Static configured spotlights */}
      {spotlights.map((spotlight, index) => (
        <spotLight
          key={`static-${index}`}
          position={spotlight.position as [number, number, number]}
          angle={0.5}
          penumbra={0.5}
          intensity={spotlight.intensity * songIntensity}
          color={spotlight.color}
          castShadow={enableShadows}
        />
      ))}

      {/* Wash lights - positioned on truss */}
      <pointLight
        ref={washLight1Ref}
        position={[-6, 7, -4]}
        intensity={2}
        distance={15}
        decay={2}
      />
      
      <pointLight
        ref={washLight2Ref}
        position={[6, 7, -4]}
        intensity={2}
        distance={15}
        decay={2}
      />
      
      <pointLight
        ref={washLight3Ref}
        position={[-4, 7, -6]}
        intensity={2}
        distance={15}
        decay={2}
      />
      
      <pointLight
        ref={washLight4Ref}
        position={[4, 7, -6]}
        intensity={2}
        distance={15}
        decay={2}
      />

      {/* Strobe light */}
      <pointLight
        ref={strobeRef}
        position={[0, 8, -5]}
        intensity={0}
        distance={25}
        color="#ffffff"
      />

      {/* Audience blinder */}
      <spotLight
        position={[0, 3, -2]}
        angle={1.2}
        penumbra={0.8}
        intensity={0.5 * songIntensity}
        color="#ffffff"
        target-position={[0, 0, 5]}
      />
    </group>
  );
};
