import { useRef, useEffect, useState } from "react";
import { Mesh } from "three";
import { supabase } from "@/integrations/supabase/client";
import { ModelLoader } from "./ModelLoader";

interface StageSceneProps {
  stageTemplateId?: string | null;
}

export const StageScene = ({ stageTemplateId }: StageSceneProps) => {
  const stageRef = useRef<Mesh>(null);
  const [gltfPath, setGltfPath] = useState<string | null>(null);

  useEffect(() => {
    const fetchStageModel = async () => {
      if (!stageTemplateId) return;

      const { data } = await supabase
        .from('stage_templates')
        .select('gltf_asset_path')
        .eq('id', stageTemplateId)
        .single();

      if (data?.gltf_asset_path) {
        setGltfPath(data.gltf_asset_path);
      }
    };

    fetchStageModel();
  }, [stageTemplateId]);

  const fallbackStage = (
    <group position={[0, 0, 0]}>
      {/* Stage Platform */}
      <mesh ref={stageRef} position={[0, 0.5, -5]} receiveShadow>
        <boxGeometry args={[12, 1, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Stage Floor */}
      <mesh position={[0, 1, -5]} receiveShadow>
        <boxGeometry args={[12, 0.1, 6]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>

      {/* Backdrop */}
      <mesh position={[0, 4, -8]} receiveShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>

      {/* Speaker Stacks - Left */}
      <group position={[-5.5, 1, -5]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.8, 1, 0.8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[0.8, 1, 0.8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      {/* Speaker Stacks - Right */}
      <group position={[5.5, 1, -5]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.8, 1, 0.8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[0.8, 1, 0.8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>
    </group>
  );

  return (
    <ModelLoader 
      modelPath={gltfPath} 
      fallback={fallbackStage}
      scale={1}
      position={[0, 0, 0]}
    />
  );
};
