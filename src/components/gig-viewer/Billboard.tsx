import { useRef, useEffect, ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group } from "three";

interface BillboardProps {
  children: ReactNode;
  position?: [number, number, number];
  lockY?: boolean;
}

/**
 * Billboard component that makes its children always face the camera
 * Useful for sprite-based characters in 3D scenes
 */
export const Billboard = ({ children, position = [0, 0, 0], lockY = true }: BillboardProps) => {
  const groupRef = useRef<Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!groupRef.current) return;

    if (lockY) {
      // Lock Y axis (only rotate around Y to face camera horizontally)
      const direction = camera.position.clone();
      direction.y = groupRef.current.position.y;
      groupRef.current.lookAt(direction);
    } else {
      // Full billboard effect (face camera completely)
      groupRef.current.lookAt(camera.position);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {children}
    </group>
  );
};
