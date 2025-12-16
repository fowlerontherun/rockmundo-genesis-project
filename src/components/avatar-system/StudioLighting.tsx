import { useRef } from "react";
import { SpotLight } from "three";

interface StudioLightingProps {
  intensity?: number;
}

export const StudioLighting = ({ intensity = 1 }: StudioLightingProps) => {
  const keyLightRef = useRef<SpotLight>(null);
  const fillLightRef = useRef<SpotLight>(null);
  const rimLightRef = useRef<SpotLight>(null);

  return (
    <>
      {/* Ambient base - very subtle */}
      <ambientLight intensity={0.15} color="#e8e4ff" />

      {/* Key Light - Main light source, warm */}
      <spotLight
        ref={keyLightRef}
        position={[3, 4, 4]}
        angle={0.4}
        penumbra={0.8}
        intensity={intensity * 2.5}
        color="#fff5e6"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.0001}
      />

      {/* Fill Light - Softer, cooler, from opposite side */}
      <spotLight
        ref={fillLightRef}
        position={[-3, 3, 3]}
        angle={0.5}
        penumbra={1}
        intensity={intensity * 1.2}
        color="#e6f0ff"
      />

      {/* Rim Light - Backlight for separation */}
      <spotLight
        ref={rimLightRef}
        position={[0, 3, -4]}
        angle={0.6}
        penumbra={0.5}
        intensity={intensity * 1.8}
        color="#ffffff"
      />

      {/* Top highlight */}
      <pointLight
        position={[0, 5, 0]}
        intensity={intensity * 0.5}
        color="#ffffff"
        distance={10}
        decay={2}
      />

      {/* Ground bounce light - subtle warm reflection */}
      <pointLight
        position={[0, -1, 2]}
        intensity={intensity * 0.3}
        color="#ffeedd"
        distance={5}
        decay={2}
      />
    </>
  );
};
