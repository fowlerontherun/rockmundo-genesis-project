import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { Group } from "three";

interface CameraRigProps {
  crowdMood: number;
}

export const CameraRig = ({ crowdMood }: CameraRigProps) => {
  const rigRef = useRef<Group>(null);

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
    <group ref={rigRef} position={[0, 1.6, 8]}>
      <PerspectiveCamera makeDefault fov={75} />
    </group>
  );
};
