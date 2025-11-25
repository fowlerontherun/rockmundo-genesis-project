import { useRef } from "react";
import { Mesh } from "three";

interface StageSceneProps {
  gigId: string;
}

export const StageScene = ({ gigId }: StageSceneProps) => {
  const stageRef = useRef<Mesh>(null);

  return (
    <group position={[0, 0, 0]}>
      {/* Stage Platform */}
      <mesh ref={stageRef} position={[0, 0.5, -5]} receiveShadow>
        <boxGeometry args={[12, 1, 6]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Stage Floor */}
      <mesh position={[0, 1, -5]} receiveShadow>
        <boxGeometry args={[12, 0.1, 6]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>

      {/* Backdrop */}
      <mesh position={[0, 4, -8]} receiveShadow>
        <boxGeometry args={[12, 6, 0.5]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>

      {/* Speaker Stacks - Left */}
      <group position={[-5.5, 1, -5]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.8, 1, 0.8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[0.8, 1, 0.8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      {/* Speaker Stacks - Right */}
      <group position={[5.5, 1, -5]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.8, 1, 0.8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[0.8, 1, 0.8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      {/* Stage Lights */}
      <pointLight position={[-3, 6, -5]} intensity={2} color="#ff00ff" />
      <pointLight position={[0, 6, -5]} intensity={2} color="#00ff00" />
      <pointLight position={[3, 6, -5]} intensity={2} color="#ff0000" />
    </group>
  );
};
