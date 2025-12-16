import { useRef } from "react";
import { Mesh, DoubleSide } from "three";

interface StudioBackgroundProps {
  theme?: 'dark' | 'light' | 'gradient' | 'stage';
}

export const StudioBackground = ({ theme = 'gradient' }: StudioBackgroundProps) => {
  const floorRef = useRef<Mesh>(null);
  const backdropRef = useRef<Mesh>(null);

  const getColors = () => {
    switch (theme) {
      case 'dark':
        return { floor: '#0a0a12', backdrop: '#12121a', gradient: '#1a1a25' };
      case 'light':
        return { floor: '#e8e8f0', backdrop: '#f0f0f8', gradient: '#fafafe' };
      case 'stage':
        return { floor: '#0d0d15', backdrop: '#15151f', gradient: '#1f1f2a' };
      case 'gradient':
      default:
        return { floor: '#0d0d18', backdrop: '#14142a', gradient: '#1e1e35' };
    }
  };

  const colors = getColors();

  return (
    <group>
      {/* Floor with reflection effect */}
      <mesh
        ref={floorRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[8, 64]} />
        <meshStandardMaterial
          color={colors.floor}
          roughness={0.3}
          metalness={0.1}
          envMapIntensity={0.5}
        />
      </mesh>

      {/* Subtle floor grid */}
      <gridHelper
        args={[10, 20, '#1a1a2e', '#1a1a2e']}
        position={[0, 0.001, 0]}
      />

      {/* Curved backdrop */}
      <mesh
        ref={backdropRef}
        position={[0, 3, -4]}
        receiveShadow
      >
        <planeGeometry args={[16, 8]} />
        <meshStandardMaterial
          color={colors.backdrop}
          roughness={0.9}
          side={DoubleSide}
        />
      </mesh>

      {/* Side panels for studio feel */}
      <mesh position={[-5, 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial
          color={colors.gradient}
          roughness={0.95}
          transparent
          opacity={0.5}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[5, 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial
          color={colors.gradient}
          roughness={0.95}
          transparent
          opacity={0.5}
          side={DoubleSide}
        />
      </mesh>

      {/* Spotlight circle on floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[0.8, 1.2, 64]} />
        <meshBasicMaterial
          color="#2a2a40"
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
};
