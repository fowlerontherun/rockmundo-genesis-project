import React, { useRef, useEffect, Suspense, useState } from 'react';
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

// Procedural fallback avatar when RPM fails to load
const ProceduralFallback = () => (
  <group>
    {/* Body */}
    <mesh position={[0, 1, 0]}>
      <capsuleGeometry args={[0.17, 0.42, 8, 16]} />
      <meshStandardMaterial color="#4a4a4a" roughness={0.7} />
    </mesh>
    {/* Head */}
    <mesh position={[0, 1.5, 0]}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshStandardMaterial color="#e0ac69" roughness={0.5} />
    </mesh>
    {/* Arms */}
    <mesh position={[-0.25, 1, 0]} rotation={[0, 0, 0.3]}>
      <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
      <meshStandardMaterial color="#e0ac69" roughness={0.5} />
    </mesh>
    <mesh position={[0.25, 1, 0]} rotation={[0, 0, -0.3]}>
      <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
      <meshStandardMaterial color="#e0ac69" roughness={0.5} />
    </mesh>
    {/* Legs */}
    <mesh position={[-0.08, 0.35, 0]}>
      <capsuleGeometry args={[0.06, 0.35, 4, 8]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
    </mesh>
    <mesh position={[0.08, 0.35, 0]}>
      <capsuleGeometry args={[0.06, 0.35, 4, 8]} />
      <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
    </mesh>
  </group>
);

// Loading placeholder while avatar loads
const LoadingFallback = () => (
  <mesh>
    <capsuleGeometry args={[0.17, 0.42, 8, 16]} />
    <meshStandardMaterial color="#666666" transparent opacity={0.5} />
  </mesh>
);

const AvatarModel = ({ 
  avatarUrl, 
  scale = 1, 
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  animation = 'idle' 
}: ReadyPlayerMeAvatarProps) => {
  const group = useRef<Group>(null);
  const [groundOffsetY, setGroundOffsetY] = useState(0);
  const [autoScale, setAutoScale] = useState(1);
  
  // useGLTF will throw if it fails - caught by error boundary
  const { scene, animations } = useGLTF(avatarUrl);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    if (!scene) return;

    console.log('[RPM Avatar] Successfully loaded:', avatarUrl);

    // Normalize model so it sits on the floor and has a consistent height.
    try {
      const bbox = new THREE.Box3().setFromObject(scene);
      const size = new THREE.Vector3();
      bbox.getSize(size);

      const minY = bbox.min.y;
      const height = size.y;

      // Lift model so its lowest point is at y=0
      const offset = Number.isFinite(minY) ? -minY : 0;
      setGroundOffsetY(offset);

      // Scale model to ~1.75 units tall (roughly human-sized in our scene)
      const targetHeight = 1.75;
      const s = height && Number.isFinite(height) && height > 0 ? targetHeight / height : 1;
      setAutoScale(s);
    } catch (e) {
      console.warn('[RPM Avatar] Failed to normalize avatar scale/offset', e);
      setGroundOffsetY(0);
      setAutoScale(1);
    }
    
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
  }, [scene, avatarUrl]);

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

  if (!scene) {
    return <ProceduralFallback />;
  }

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      {/* Lift + scale the model so it reliably shows up in the scene */}
      <group position={[0, groundOffsetY, 0]} scale={autoScale}>
        <primitive object={scene} />
      </group>
    </group>
  );
};

// Error boundary for avatar loading
class AvatarErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[RPM Avatar Error Boundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export const ReadyPlayerMeAvatar = (props: ReadyPlayerMeAvatarProps) => {
  console.log('[RPM Avatar] Rendering with URL:', props.avatarUrl);
  
  return (
    <AvatarErrorBoundary fallback={<ProceduralFallback />}>
      <Suspense fallback={<LoadingFallback />}>
        <AvatarModel {...props} />
      </Suspense>
    </AvatarErrorBoundary>
  );
};

// Preload helper for performance
export const preloadAvatar = (url: string) => {
  useGLTF.preload(url);
};
