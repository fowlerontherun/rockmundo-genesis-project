import { useRef } from "react";
import { Mesh } from "three";
import { useFrame } from "@react-three/fiber";

interface LightConeProps {
  position: [number, number, number];
  color: string;
  intensity: number;
  targetY?: number;
  rotation?: [number, number, number];
}

export const LightCone = ({
  position,
  color,
  intensity,
  targetY = 0,
  rotation = [0, 0, 0]
}: LightConeProps) => {
  const coneRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!coneRef.current) return;
    
    // Subtle pulsing effect
    const pulse = Math.sin(clock.getElapsedTime() * 2) * 0.1 + 0.9;
    const material = coneRef.current.material;
    if (!Array.isArray(material) && 'opacity' in material) {
      material.opacity = intensity * pulse * 0.15;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Volumetric light beam cone */}
      <mesh ref={coneRef} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[2, 8, 32, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={intensity * 0.15}
          depthWrite={false}
          side={2} // DoubleSide
        />
      </mesh>

      {/* Spot light for actual illumination */}
      <spotLight
        position={[0, 0, 0]}
        angle={0.6}
        penumbra={0.5}
        intensity={intensity * 2}
        color={color}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
    </group>
  );
};
