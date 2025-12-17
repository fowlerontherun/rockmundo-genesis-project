import { useRef, useEffect, Suspense } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group } from 'three';
import * as THREE from 'three';

interface ReadyPlayerMeAvatarProps {
  avatarUrl: string;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  animation?: 'idle' | 'playing' | 'singing' | 'drumming';
}

const AvatarModel = ({ 
  avatarUrl, 
  scale = 1, 
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  animation = 'idle' 
}: ReadyPlayerMeAvatarProps) => {
  const group = useRef<Group>(null);
  const { scene, animations } = useGLTF(avatarUrl);
  const { actions, mixer } = useAnimations(animations, group);

  useEffect(() => {
    if (!scene) return;
    
    // Set up materials for better rendering
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          child.material.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  useEffect(() => {
    // Play default animation if available
    if (actions && Object.keys(actions).length > 0) {
      const animationNames = Object.keys(actions);
      const defaultAnimation = animationNames[0];
      if (defaultAnimation && actions[defaultAnimation]) {
        actions[defaultAnimation]?.reset().fadeIn(0.5).play();
      }
    }
    
    return () => {
      // Clean up animations
      Object.values(actions).forEach(action => action?.fadeOut(0.5));
    };
  }, [actions, animation]);

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} />
    </group>
  );
};

// Fallback component while loading
const LoadingFallback = () => (
  <mesh>
    <capsuleGeometry args={[0.3, 1, 8, 16]} />
    <meshStandardMaterial color="hsl(var(--muted))" />
  </mesh>
);

export const ReadyPlayerMeAvatar = (props: ReadyPlayerMeAvatarProps) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AvatarModel {...props} />
    </Suspense>
  );
};

// Preload helper for performance
export const preloadAvatar = (url: string) => {
  useGLTF.preload(url);
};
