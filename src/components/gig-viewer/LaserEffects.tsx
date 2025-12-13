import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface LaserEffectsProps {
  enabled: boolean;
  intensity: number;
  songSection: string;
  crowdMood: number;
}

export const LaserEffects = ({ 
  enabled, 
  intensity, 
  songSection,
  crowdMood 
}: LaserEffectsProps) => {
  const lasersRef = useRef<THREE.Group>(null);
  const frameSkip = useRef(0);

  // Laser colors based on section
  const laserColors = useMemo(() => {
    if (songSection === 'chorus' || songSection === 'bigChorus') {
      return ['#00ff00', '#00ffff', '#ff00ff', '#ffffff'];
    } else if (songSection === 'bridge') {
      return ['#ff6600', '#ffff00', '#ff0066', '#00ffff'];
    }
    return ['#00ff00', '#0066ff', '#ff00ff', '#6600ff'];
  }, [songSection]);

  // Only show lasers during high-energy sections
  const showLasers = enabled && (songSection === 'chorus' || songSection === 'bigChorus' || crowdMood > 70);

  useFrame(({ clock }) => {
    if (!lasersRef.current || !showLasers) return;
    
    frameSkip.current++;
    if (frameSkip.current < 2) return;
    frameSkip.current = 0;

    const time = clock.getElapsedTime();
    
    lasersRef.current.children.forEach((child, i) => {
      if (child instanceof THREE.Mesh) {
        // Sweeping rotation
        child.rotation.z = Math.sin(time * 2 + i * 0.8) * 0.5;
        child.rotation.x = Math.cos(time * 1.5 + i * 0.6) * 0.3;
        
        // Pulsing opacity
        const material = child.material as THREE.MeshBasicMaterial;
        material.opacity = 0.3 + Math.sin(time * 4 + i) * 0.2 * intensity;
      }
    });
  });

  if (!showLasers) return null;

  return (
    <group ref={lasersRef}>
      {/* Laser beams from truss */}
      {[-4, -2, 0, 2, 4].map((x, i) => (
        <mesh 
          key={i} 
          position={[x, 7, -5]} 
          rotation={[0, 0, 0]}
        >
          <planeGeometry args={[0.05, 15]} />
          <meshBasicMaterial 
            color={laserColors[i % laserColors.length]} 
            transparent 
            opacity={0.4}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Cross lasers */}
      {[-3, 3].map((x, i) => (
        <mesh 
          key={`cross-${i}`} 
          position={[x, 6, -4]} 
          rotation={[0.5, i === 0 ? 0.3 : -0.3, 0]}
        >
          <planeGeometry args={[0.03, 12]} />
          <meshBasicMaterial 
            color="#00ff00" 
            transparent 
            opacity={0.35}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};
