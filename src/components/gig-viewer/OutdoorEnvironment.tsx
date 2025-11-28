import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface OutdoorEnvironmentProps {
  timeOfDay: 'day' | 'sunset' | 'night';
}

export const OutdoorEnvironment = ({ timeOfDay }: OutdoorEnvironmentProps) => {
  const { scene } = useThree();

  useEffect(() => {
    // Set sky gradient based on time of day
    if (timeOfDay === 'day') {
      scene.background = new THREE.Color(0x87CEEB); // Sky blue
      scene.fog = new THREE.Fog(0x87CEEB, 50, 100);
    } else if (timeOfDay === 'sunset') {
      // Create gradient from orange to purple
      const gradientTexture = new THREE.CanvasTexture(createGradientCanvas('#FF6B35', '#4A148C'));
      scene.background = gradientTexture;
      scene.fog = new THREE.Fog(0xFF6B35, 40, 90);
    } else {
      // Night - dark blue/purple
      scene.background = new THREE.Color(0x0A0E27);
      scene.fog = new THREE.Fog(0x0A0E27, 30, 80);
    }
  }, [timeOfDay, scene]);

  const createGradientCanvas = (color1: string, color2: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 256);
    return canvas;
  };

  return (
    <group>
      {/* Directional light (sun/moon) */}
      <directionalLight
        position={timeOfDay === 'day' ? [10, 20, 5] : [5, 15, 10]}
        intensity={timeOfDay === 'day' ? 1.2 : timeOfDay === 'sunset' ? 0.8 : 0.3}
        color={timeOfDay === 'day' ? '#FFFFFF' : timeOfDay === 'sunset' ? '#FFA07A' : '#4169E1'}
        castShadow
      />

      {/* Ambient light */}
      <ambientLight
        intensity={timeOfDay === 'day' ? 0.6 : timeOfDay === 'sunset' ? 0.4 : 0.2}
        color={timeOfDay === 'night' ? '#1E3A5F' : '#FFFFFF'}
      />

      {/* Stars for night */}
      {timeOfDay === 'night' && (
        <group>
          {Array.from({ length: 100 }).map((_, i) => (
            <mesh
              key={i}
              position={[
                (Math.random() - 0.5) * 100,
                20 + Math.random() * 30,
                -30 - Math.random() * 20
              ]}
            >
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
          ))}
        </group>
      )}

      {/* Ground plane for outdoor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial 
          color={timeOfDay === 'day' ? '#2D5016' : timeOfDay === 'sunset' ? '#3D6B1F' : '#1A3A0F'}
        />
      </mesh>
    </group>
  );
};
