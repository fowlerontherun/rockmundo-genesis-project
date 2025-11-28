import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { supabase } from "@/integrations/supabase/client";

interface CameraRigProps {
  crowdMood: number;
  stageTemplateId?: string | null;
}

export const CameraRig = ({ crowdMood, stageTemplateId }: CameraRigProps) => {
  const rigRef = useRef<Group>(null);
  const [cameraOffset, setCameraOffset] = useState(new Vector3(0, 1.6, 8));

  // Fetch camera offset from stage template
  useEffect(() => {
    const fetchCameraOffset = async () => {
      if (!stageTemplateId) return;

      const { data, error } = await supabase
        .from('stage_templates')
        .select('camera_offset')
        .eq('id', stageTemplateId)
        .single();

      if (!error && data?.camera_offset) {
        const offset = data.camera_offset as any;
        setCameraOffset(new Vector3(offset.x || 0, offset.y || 1.6, offset.z || 8));
      }
    };

    fetchCameraOffset();
  }, [stageTemplateId]);

  useFrame(({ clock }) => {
    if (!rigRef.current) return;

    const time = clock.getElapsedTime();
    const intensity = crowdMood / 100;

    // Subtle head bobbing based on crowd mood
    const bobAmount = 0.02 * intensity;
    rigRef.current.position.y = 1.6 + Math.sin(time * 2) * bobAmount;

    // Slight sway
    const swayAmount = 0.03 * intensity;
    rigRef.current.position.x = Math.sin(time * 0.5) * swayAmount;

    // Very subtle head rotation
    const rotateAmount = 0.01 * intensity;
    rigRef.current.rotation.y = Math.sin(time * 0.8) * rotateAmount;
    rigRef.current.rotation.x = Math.sin(time * 1.2) * rotateAmount * 0.5;
  });

  return (
    <group ref={rigRef} position={[cameraOffset.x, cameraOffset.y, cameraOffset.z]}>
      <PerspectiveCamera makeDefault fov={75} />
    </group>
  );
};
