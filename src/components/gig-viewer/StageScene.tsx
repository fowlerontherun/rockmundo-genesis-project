import { useRef, useEffect, useState } from "react";
import { Mesh } from "three";
import { supabase } from "@/integrations/supabase/client";
import { ModelLoader } from "./ModelLoader";
import { StageTruss } from "./StageTruss";

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

      {/* Lighting Truss */}
      <StageTruss />

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
        <mesh position={[0, 2.5, 0]} castShadow>
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
        <mesh position={[0, 2.5, 0]} castShadow>
          <boxGeometry args={[0.8, 1, 0.8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      {/* Drum Riser */}
      <mesh position={[0, 1.3, -7]} castShadow receiveShadow>
        <boxGeometry args={[3, 0.6, 2.5]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>

      {/* Monitor Wedges */}
      {[-3, -1, 1, 3].map((x, i) => (
        <mesh key={i} position={[x, 1.1, -3]} rotation={[-Math.PI / 6, 0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.4, 0.6]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      ))}

      {/* Amp Stacks Behind */}
      {[-4, 4].map((x, i) => (
        <group key={i} position={[x, 1, -7.5]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[1.2, 1, 0.5]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0, 1.5, 0]} castShadow>
            <boxGeometry args={[1.2, 1, 0.5]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>
      ))}

      {/* Microphone Stands */}
      {[-2, 0, 2].map((x, i) => (
        <group key={i} position={[x, 1.1, -4]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.03, 0.03, 2, 8]} />
            <meshStandardMaterial color="#3a3a3a" metalness={0.9} />
          </mesh>
          <mesh position={[0, 1.2, 0]} castShadow>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.8} />
          </mesh>
        </group>
      ))}
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
