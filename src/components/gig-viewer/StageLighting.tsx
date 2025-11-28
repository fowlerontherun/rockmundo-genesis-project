import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PointLight, SpotLight } from "three";

interface StageLightingProps {
  crowdMood: number;
  songIntensity?: number;
}

export const StageLighting = ({ crowdMood, songIntensity = 0.5 }: StageLightingProps) => {
  const spotLight1Ref = useRef<SpotLight>(null);
  const spotLight2Ref = useRef<SpotLight>(null);
  const spotLight3Ref = useRef<SpotLight>(null);
  const colorLight1Ref = useRef<PointLight>(null);
  const colorLight2Ref = useRef<PointLight>(null);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const intensity = (crowdMood / 100) * songIntensity;

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
      {/* Main stage spotlights */}
      <spotLight
        ref={spotLight1Ref}
        position={[-4, 8, -3]}
        angle={0.3}
        penumbra={0.4}
        intensity={2}
        color="#ff00ff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <spotLight
        ref={spotLight2Ref}
        position={[4, 8, -3]}
        angle={0.3}
        penumbra={0.4}
        intensity={2}
        color="#00ffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <spotLight
        ref={spotLight3Ref}
        position={[0, 9, -2]}
        angle={0.4}
        penumbra={0.3}
        intensity={2.5}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

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
