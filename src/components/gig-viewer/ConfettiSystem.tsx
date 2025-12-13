import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface ConfettiSystemProps {
  enabled: boolean;
  intensity: number;
  trigger: boolean; // Trigger confetti burst
}

interface ConfettiPiece {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  rotationSpeed: THREE.Vector3;
  color: string;
  scale: number;
  active: boolean;
  lifetime: number;
}

export const ConfettiSystem = ({ 
  enabled, 
  intensity, 
  trigger 
}: ConfettiSystemProps) => {
  const confettiRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<Map<number, THREE.Mesh>>(new Map());
  const frameSkip = useRef(0);
  const lastTrigger = useRef(false);

  const confettiCount = 100;

  const confettiColors = [
    '#ff0000', '#ff6600', '#ffff00', '#00ff00', 
    '#00ffff', '#0066ff', '#ff00ff', '#ff66cc',
    '#ffffff', '#ffd700'
  ];

  // Initialize confetti pieces
  const confettiPieces = useMemo<ConfettiPiece[]>(() => {
    return Array.from({ length: confettiCount }).map((_, i) => ({
      position: new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        8 + Math.random() * 4,
        -5 + Math.random() * 10
      ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        -1 - Math.random() * 2,
        (Math.random() - 0.5) * 1
      ),
      rotation: new THREE.Euler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      ),
      rotationSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 5
      ),
      color: confettiColors[i % confettiColors.length],
      scale: 0.08 + Math.random() * 0.08,
      active: false,
      lifetime: 0
    }));
  }, []);

  useFrame((_, delta) => {
    if (!enabled || !confettiRef.current) return;

    frameSkip.current++;
    if (frameSkip.current < 2) return;
    frameSkip.current = 0;

    // Check for trigger change
    if (trigger && !lastTrigger.current) {
      // Activate all confetti
      confettiPieces.forEach((piece, i) => {
        piece.active = true;
        piece.lifetime = 0;
        piece.position.set(
          (Math.random() - 0.5) * 16,
          8 + Math.random() * 4,
          -5 + Math.random() * 10
        );
        piece.velocity.set(
          (Math.random() - 0.5) * 4,
          -2 - Math.random() * 3,
          (Math.random() - 0.5) * 2
        );
      });
    }
    lastTrigger.current = trigger;

    // Update confetti physics
    confettiPieces.forEach((piece, i) => {
      if (!piece.active) return;

      const mesh = meshRefs.current.get(i);
      if (!mesh) return;

      // Update lifetime
      piece.lifetime += delta;
      if (piece.lifetime > 5) {
        piece.active = false;
        mesh.visible = false;
        return;
      }

      mesh.visible = true;

      // Apply gravity and drag
      piece.velocity.y -= 2 * delta;
      piece.velocity.x *= 0.99;
      piece.velocity.z *= 0.99;

      // Flutter effect
      piece.velocity.x += Math.sin(piece.lifetime * 5 + i) * 0.1;
      piece.velocity.z += Math.cos(piece.lifetime * 4 + i) * 0.08;

      // Update position
      piece.position.add(piece.velocity.clone().multiplyScalar(delta));

      // Update rotation
      piece.rotation.x += piece.rotationSpeed.x * delta;
      piece.rotation.y += piece.rotationSpeed.y * delta;
      piece.rotation.z += piece.rotationSpeed.z * delta;

      // Reset if below ground
      if (piece.position.y < 0) {
        piece.active = false;
        mesh.visible = false;
      }

      // Apply to mesh
      mesh.position.copy(piece.position);
      mesh.rotation.copy(piece.rotation);

      // Fade out near end of lifetime
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 1 - (piece.lifetime / 5));
    });
  });

  if (!enabled) return null;

  return (
    <group ref={confettiRef}>
      {confettiPieces.map((piece, i) => (
        <mesh
          key={i}
          ref={(mesh) => {
            if (mesh) meshRefs.current.set(i, mesh);
          }}
          position={[piece.position.x, piece.position.y, piece.position.z]}
          rotation={[piece.rotation.x, piece.rotation.y, piece.rotation.z]}
          visible={false}
        >
          <planeGeometry args={[piece.scale, piece.scale * 1.5]} />
          <meshBasicMaterial 
            color={piece.color} 
            transparent 
            opacity={1}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};
