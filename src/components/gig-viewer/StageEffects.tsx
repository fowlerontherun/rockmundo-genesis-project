import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Points, PointsMaterial } from "three";
import * as THREE from "three";

interface StageEffectsProps {
  crowdMood: number;
}

export const StageEffects = ({ crowdMood }: StageEffectsProps) => {
  const particlesRef = useRef<Points>(null);

  // Create particle positions for fog/haze effect
  const particleCount = 300;
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 15; // x
    positions[i * 3 + 1] = Math.random() * 5; // y
    positions[i * 3 + 2] = -8 + Math.random() * 10; // z
  }

  useFrame(({ clock }) => {
    if (!particlesRef.current) return;

    const time = clock.getElapsedTime();
    const geometry = particlesRef.current.geometry;
    const positions = geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Gentle upward and sideways drift
      positions[i3 + 1] += 0.005; // Rise
      positions[i3] += Math.sin(time + i) * 0.001; // Drift

      // Reset particle if it goes too high
      if (positions[i3 + 1] > 6) {
        positions[i3 + 1] = 0;
      }
    }

    geometry.attributes.position.needsUpdate = true;

    // Fade particles based on crowd mood
    const material = particlesRef.current.material as PointsMaterial;
    material.opacity = 0.1 + (crowdMood / 100) * 0.2;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        color="#ffffff"
        transparent
        opacity={0.2}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
