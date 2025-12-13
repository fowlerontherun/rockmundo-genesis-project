import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CrowdPhonesProps {
  enabled: boolean;
  crowdMood: number;
  songSection: string;
  maxPhones: number;
}

interface PhoneLight {
  position: [number, number, number];
  seed: number;
  delay: number;
  active: boolean;
}

// Seeded random
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const CrowdPhones = ({ 
  enabled, 
  crowdMood, 
  songSection,
  maxPhones 
}: CrowdPhonesProps) => {
  const phonesRef = useRef<THREE.Group>(null);
  const lightRefs = useRef<Map<number, THREE.Mesh>>(new Map());
  const frameSkip = useRef(0);

  // Show phones during ballads or when mood is high
  const showPhones = enabled && (
    songSection === 'ballad' || 
    songSection === 'outro' ||
    crowdMood > 60
  );

  // Calculate number of active phones based on mood
  const activePhoneCount = useMemo(() => {
    if (crowdMood < 40) return Math.floor(maxPhones * 0.1);
    if (crowdMood < 60) return Math.floor(maxPhones * 0.3);
    if (crowdMood < 80) return Math.floor(maxPhones * 0.6);
    return maxPhones;
  }, [crowdMood, maxPhones]);

  // Generate phone positions
  const phones = useMemo<PhoneLight[]>(() => {
    return Array.from({ length: maxPhones }).map((_, i) => {
      const seed = seededRandom(i * 7.31);
      return {
        position: [
          (seededRandom(i * 3.14) - 0.5) * 16, // x spread
          1.2 + seededRandom(i * 2.71) * 0.5,  // y height (arm raised)
          3 + seededRandom(i * 1.41) * 10      // z depth
        ] as [number, number, number],
        seed,
        delay: seededRandom(i * 5.67) * 3,
        active: i < activePhoneCount
      };
    });
  }, [maxPhones, activePhoneCount]);

  useFrame(({ clock }) => {
    if (!phonesRef.current || !showPhones) return;

    frameSkip.current++;
    if (frameSkip.current < 3) return;
    frameSkip.current = 0;

    const time = clock.getElapsedTime();

    phones.forEach((phone, i) => {
      const mesh = lightRefs.current.get(i);
      if (!mesh) return;

      mesh.visible = phone.active;
      if (!phone.active) return;

      // Gentle sway motion (like someone holding a phone)
      mesh.position.x = phone.position[0] + Math.sin(time * 0.5 + phone.delay) * 0.15;
      mesh.position.y = phone.position[1] + Math.sin(time * 0.8 + phone.delay * 2) * 0.1;
      
      // Slight rotation
      mesh.rotation.z = Math.sin(time * 0.3 + phone.seed * 10) * 0.2;

      // Flickering light effect
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 0.7 + Math.sin(time * 2 + phone.seed * 5) * 0.3;
    });
  });

  if (!showPhones) return null;

  return (
    <group ref={phonesRef}>
      {phones.map((phone, i) => (
        <group key={i}>
          {/* Phone screen glow */}
          <mesh
            ref={(mesh) => {
              if (mesh) lightRefs.current.set(i, mesh);
            }}
            position={phone.position}
            visible={phone.active}
          >
            <planeGeometry args={[0.06, 0.1]} />
            <meshBasicMaterial 
              color="#ffffff" 
              transparent 
              opacity={0.8}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          
          {/* Point light for glow effect */}
          {phone.active && (
            <pointLight
              position={phone.position}
              intensity={0.3}
              distance={2}
              color="#4488ff"
              decay={2}
            />
          )}
        </group>
      ))}

      {/* Camera flash effects during high mood */}
      {crowdMood > 80 && Array.from({ length: 5 }).map((_, i) => {
        const flashX = (seededRandom(i * 11.11) - 0.5) * 18;
        const flashZ = 4 + seededRandom(i * 9.99) * 8;
        return (
          <pointLight
            key={`flash-${i}`}
            position={[flashX, 1.5, flashZ]}
            intensity={Math.random() > 0.95 ? 3 : 0} // Random flashes
            distance={4}
            color="#ffffff"
            decay={2}
          />
        );
      })}
    </group>
  );
};
