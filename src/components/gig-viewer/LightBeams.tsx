import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, ConeGeometry, MeshBasicMaterial } from "three";
import { useEffectTextures } from "@/hooks/useStageTextures";

interface LightBeamsProps {
  count?: number;
  colors?: string[];
  intensity?: number;
}

export const LightBeams = ({ 
  count = 6,
  colors = ["#ff0066", "#00ffff", "#ffff00", "#ff00ff", "#00ff00"],
  intensity = 1.0
}: LightBeamsProps) => {
  const beamRefs = useRef<Mesh[]>([]);
  const textures = useEffectTextures();

  const beamData = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const radius = 8;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        color: colors[i % colors.length],
        rotationSpeed: 0.2 + Math.random() * 0.3,
        offset: Math.random() * Math.PI * 2,
      };
    });
  }, [count, colors]);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    beamRefs.current.forEach((beam, i) => {
      if (!beam) return;
      const data = beamData[i];
      
      // Sweeping rotation
      const angle = time * data.rotationSpeed + data.offset;
      beam.rotation.y = angle;
      
      // Intensity pulsing
      const pulseIntensity = intensity * (0.7 + Math.sin(time * 2 + data.offset) * 0.3);
      if (beam.material) {
        (beam.material as MeshBasicMaterial).opacity = pulseIntensity * 0.4;
      }
    });
  });

  return (
    <group position={[0, 8, -5]}>
      {beamData.map((data, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) beamRefs.current[i] = el;
          }}
          position={[data.x, 0, data.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <coneGeometry args={[0.5, 10, 16, 1, true]} />
          <meshBasicMaterial
            color={data.color}
            transparent
            opacity={intensity * 0.4}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      ))}
      
      {/* Gobo pattern projections */}
      {beamData.slice(0, 2).map((data, i) => (
        <sprite 
          key={`gobo-${i}`}
          position={[data.x * 0.5, -8, data.z * 0.5]}
          scale={[4, 4, 1]}
        >
          <spriteMaterial
            map={textures.gobo}
            transparent
            opacity={intensity * 0.3}
            color={data.color}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
};
