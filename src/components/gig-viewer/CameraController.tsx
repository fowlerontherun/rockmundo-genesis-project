import { useRef, useEffect } from "react";
import { OrbitControls, FirstPersonControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3 } from "three";

type CameraMode = 'pov' | 'orbit' | 'free' | 'cinematic';

interface CameraControllerProps {
  mode: CameraMode;
  crowdMood: number;
  zoomLevel: number;
}

export const CameraController = ({ mode, crowdMood, zoomLevel }: CameraControllerProps) => {
  const rigRef = useRef<Group>(null);
  const { camera } = useThree();
  const cinematicAngle = useRef(0);

  // POV mode - crowd perspective with head bobbing
  useFrame(({ clock }) => {
    if (!rigRef.current || mode !== 'pov') return;

    const time = clock.getElapsedTime();
    const intensity = crowdMood / 100;

    // Subtle head bobbing based on crowd mood
    const bobAmount = 0.02 * intensity;
    rigRef.current.position.y = 4.0 + Math.sin(time * 2) * bobAmount;

    // Slight sway
    const swayAmount = 0.03 * intensity;
    rigRef.current.position.x = Math.sin(time * 0.5) * swayAmount;

    // Very subtle head rotation with slight downward tilt
    const rotateAmount = 0.01 * intensity;
    rigRef.current.rotation.y = Math.sin(time * 0.8) * rotateAmount;
    rigRef.current.rotation.x = -0.15 + Math.sin(time * 1.2) * rotateAmount * 0.5;
  });

  // Cinematic mode - automated camera paths
  useFrame(({ clock }) => {
    if (mode !== 'cinematic') return;

    const time = clock.getElapsedTime();
    cinematicAngle.current += 0.002;

    const radius = 15;
    const x = Math.sin(cinematicAngle.current) * radius;
    const z = Math.cos(cinematicAngle.current) * radius + 5;
    const y = 4 + Math.sin(time * 0.3) * 2;

    camera.position.set(x, y, z);
    camera.lookAt(0, 2, -5); // Look at stage center
  });

  // Reset camera position when switching modes
  useEffect(() => {
    if (mode === 'pov' && rigRef.current) {
      rigRef.current.position.set(0, 4.0, zoomLevel);
      rigRef.current.rotation.set(-0.15, 0, 0);
    } else if (mode === 'orbit') {
      camera.position.set(0, 6, zoomLevel);
      camera.lookAt(0, 2, -5);
    } else if (mode === 'free') {
      camera.position.set(5, 3, zoomLevel);
      camera.lookAt(0, 2, -5);
    }
  }, [mode, camera, zoomLevel]);

  return (
    <>
      {mode === 'pov' && (
        <group ref={rigRef} position={[0, 4.0, zoomLevel]}>
          <PerspectiveCamera makeDefault fov={75} />
        </group>
      )}

      {mode === 'orbit' && (
        <>
          <PerspectiveCamera makeDefault position={[0, 6, zoomLevel]} fov={75} />
          <OrbitControls
            enableZoom={true}
            enablePan={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={30}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2}
            target={[0, 2, -5]}
          />
        </>
      )}

      {mode === 'free' && (
        <>
          <PerspectiveCamera makeDefault position={[5, 3, zoomLevel]} fov={75} />
          <FirstPersonControls
            movementSpeed={5}
            lookSpeed={0.1}
            activeLook={true}
          />
        </>
      )}

      {mode === 'cinematic' && (
        <PerspectiveCamera makeDefault position={[0, 4, 15]} fov={75} />
      )}
    </>
  );
};
