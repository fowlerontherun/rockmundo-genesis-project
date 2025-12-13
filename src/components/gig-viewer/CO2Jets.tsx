import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CO2JetsProps {
  enabled: boolean;
  trigger: boolean;
  positions?: [number, number, number][];
}

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  lifetime: number;
  maxLifetime: number;
  scale: number;
  opacity: number;
}

export const CO2Jets = ({ 
  enabled, 
  trigger,
  positions = [[-4, 0, -4], [4, 0, -4], [-2, 0, -6], [2, 0, -6]]
}: CO2JetsProps) => {
  const particlesRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<Map<number, THREE.Mesh>>(new Map());
  const lastTrigger = useRef(false);
  const frameSkip = useRef(0);

  const particlesPerJet = 25;
  const totalParticles = particlesPerJet * positions.length;

  // Initialize particles
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: totalParticles }).map(() => ({
      position: new THREE.Vector3(0, -10, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      lifetime: 0,
      maxLifetime: 1 + Math.random() * 0.5,
      scale: 0.1 + Math.random() * 0.15,
      opacity: 0
    }));
  }, [totalParticles]);

  useFrame((_, delta) => {
    if (!enabled || !particlesRef.current) return;

    frameSkip.current++;
    if (frameSkip.current < 2) return;
    frameSkip.current = 0;

    // Check for trigger
    if (trigger && !lastTrigger.current) {
      // Launch particles from each jet position
      positions.forEach((pos, jetIndex) => {
        for (let i = 0; i < particlesPerJet; i++) {
          const particleIndex = jetIndex * particlesPerJet + i;
          const particle = particles[particleIndex];
          
          particle.position.set(
            pos[0] + (Math.random() - 0.5) * 0.3,
            pos[1],
            pos[2] + (Math.random() - 0.5) * 0.3
          );
          particle.velocity.set(
            (Math.random() - 0.5) * 1,
            6 + Math.random() * 4, // Upward burst
            (Math.random() - 0.5) * 1
          );
          particle.lifetime = Math.random() * 0.3; // Stagger start
          particle.opacity = 1;
        }
      });
    }
    lastTrigger.current = trigger;

    // Update particles
    particles.forEach((particle, i) => {
      const mesh = meshRefs.current.get(i);
      if (!mesh) return;

      if (particle.lifetime < 0) {
        particle.lifetime += delta;
        mesh.visible = false;
        return;
      }

      particle.lifetime += delta;
      
      if (particle.lifetime > particle.maxLifetime) {
        mesh.visible = false;
        particle.opacity = 0;
        return;
      }

      mesh.visible = true;

      // Apply physics
      particle.velocity.y -= 2 * delta; // Gravity
      particle.velocity.x *= 0.98; // Drag
      particle.velocity.z *= 0.98;

      // Spread out as it rises
      particle.velocity.x += (Math.random() - 0.5) * 0.5 * delta;
      particle.velocity.z += (Math.random() - 0.5) * 0.5 * delta;

      particle.position.add(particle.velocity.clone().multiplyScalar(delta));

      // Fade out
      const progress = particle.lifetime / particle.maxLifetime;
      particle.opacity = Math.max(0, 1 - progress * progress);
      
      // Grow as it rises
      const currentScale = particle.scale * (1 + progress * 2);

      // Apply to mesh
      mesh.position.copy(particle.position);
      mesh.scale.setScalar(currentScale);

      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = particle.opacity * 0.6;
    });
  });

  if (!enabled) return null;

  return (
    <group ref={particlesRef}>
      {particles.map((_, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            if (mesh) meshRefs.current.set(i, mesh);
          }}
          visible={false}
        >
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial 
            color="#ffffff" 
            transparent 
            opacity={0.6}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};
