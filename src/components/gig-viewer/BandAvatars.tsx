import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

interface BandAvatarsProps {
  gigId: string;
}

export const BandAvatars = ({ gigId }: BandAvatarsProps) => {
  const guitarist1Ref = useRef<Mesh>(null);
  const guitarist2Ref = useRef<Mesh>(null);
  const bassistRef = useRef<Mesh>(null);
  const drummerRef = useRef<Mesh>(null);

  // Simple animation - bob and sway
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    [guitarist1Ref, guitarist2Ref, bassistRef].forEach((ref, i) => {
      if (ref.current) {
        const offset = i * 0.5;
        ref.current.rotation.y = Math.sin(time + offset) * 0.1;
        ref.current.position.y = 1.3 + Math.sin(time * 2 + offset) * 0.05;
      }
    });

    // Drummer - more subtle movement
    if (drummerRef.current) {
      drummerRef.current.rotation.x = Math.sin(time * 4) * 0.05;
    }
  });

  return (
    <group position={[0, 0, -5]}>
      {/* Lead Guitarist */}
      <mesh ref={guitarist1Ref} position={[-2, 1.3, 1]} castShadow>
        <capsuleGeometry args={[0.3, 1, 4, 8]} />
        <meshStandardMaterial color="#ff0066" />
      </mesh>

      {/* Rhythm Guitarist */}
      <mesh ref={guitarist2Ref} position={[2, 1.3, 1]} castShadow>
        <capsuleGeometry args={[0.3, 1, 4, 8]} />
        <meshStandardMaterial color="#0066ff" />
      </mesh>

      {/* Bassist */}
      <mesh ref={bassistRef} position={[-4, 1.3, 0.5]} castShadow>
        <capsuleGeometry args={[0.3, 1, 4, 8]} />
        <meshStandardMaterial color="#00ff66" />
      </mesh>

      {/* Drummer */}
      <mesh ref={drummerRef} position={[0, 1.5, -1]} castShadow>
        <capsuleGeometry args={[0.3, 0.8, 4, 8]} />
        <meshStandardMaterial color="#ffff00" />
      </mesh>

      {/* Simple drum kit representation */}
      <mesh position={[0, 1, -1.5]} castShadow>
        <cylinderGeometry args={[0.4, 0.5, 0.3, 16]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  );
};
