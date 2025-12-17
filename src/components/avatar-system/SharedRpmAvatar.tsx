import React, { useRef, useEffect, useMemo, Suspense } from 'react';
import { useGLTF } from '@react-three/drei';
import { Group, Object3D, Mesh, SkinnedMesh } from 'three';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface SharedRpmAvatarProps {
  avatarUrl: string;
  scale?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

// Cache for loaded scenes to ensure we only load each URL once
const sceneCache = new Map<string, THREE.Group>();

// Procedural fallback avatar when RPM fails to load
const ProceduralFallback = () => (
  <group>
    <mesh position={[0, 1, 0]}>
      <capsuleGeometry args={[0.17, 0.42, 8, 16]} />
      <meshStandardMaterial color="#4a4a4a" roughness={0.7} />
    </mesh>
    <mesh position={[0, 1.5, 0]}>
      <sphereGeometry args={[0.15, 16, 16]} />
      <meshStandardMaterial color="#e0ac69" roughness={0.5} />
    </mesh>
    <mesh position={[-0.25, 1, 0]} rotation={[0, 0, 0.3]}>
      <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
      <meshStandardMaterial color="#e0ac69" roughness={0.5} />
    </mesh>
    <mesh position={[0.25, 1, 0]} rotation={[0, 0, -0.3]}>
      <capsuleGeometry args={[0.04, 0.3, 4, 8]} />
      <meshStandardMaterial color="#e0ac69" roughness={0.5} />
    </mesh>
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

const LoadingFallback = () => (
  <mesh>
    <capsuleGeometry args={[0.17, 0.42, 8, 16]} />
    <meshStandardMaterial color="#666666" transparent opacity={0.5} />
  </mesh>
);

const SharedAvatarModel = ({ 
  avatarUrl, 
  scale = 1, 
  position = [0, 0, 0],
  rotation = [0, 0, 0]
}: SharedRpmAvatarProps) => {
  const group = useRef<Group>(null);
  
  // Load the GLTF - useGLTF caches internally so same URL = same load
  const { scene: originalScene } = useGLTF(avatarUrl);
  
  // Clone the scene with proper skeleton handling using SkeletonUtils
  // This shares materials/textures while creating independent instances
  const clonedScene = useMemo(() => {
    if (!originalScene) return null;
    
    console.log('[SharedRpmAvatar] Cloning scene for:', avatarUrl);
    
    // SkeletonUtils.clone properly handles skinned meshes and shared materials
    const clone = SkeletonUtils.clone(originalScene) as THREE.Group;
    
    // Normalize the model position and scale
    const bbox = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    
    const minY = bbox.min.y;
    const height = size.y;
    
    // Lift model so its lowest point is at y=0
    if (Number.isFinite(minY)) {
      clone.position.y = -minY;
    }
    
    // Scale to ~1.75 units tall
    const targetHeight = 1.75;
    if (height && Number.isFinite(height) && height > 0) {
      const s = targetHeight / height;
      clone.scale.setScalar(s);
    }
    
    // Configure materials for rendering
    clone.traverse((child: Object3D) => {
      if (child instanceof Mesh || child instanceof SkinnedMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          // Don't clone materials - share them to save texture units
          child.material.needsUpdate = true;
        }
      }
    });
    
    return clone;
  }, [originalScene, avatarUrl]);

  if (!clonedScene) {
    return <ProceduralFallback />;
  }

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <primitive object={clonedScene} />
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
    console.error('[SharedRpmAvatar Error Boundary]', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export const SharedRpmAvatar = (props: SharedRpmAvatarProps) => {
  console.log('[SharedRpmAvatar] Rendering with URL:', props.avatarUrl);
  
  return (
    <AvatarErrorBoundary fallback={<ProceduralFallback />}>
      <Suspense fallback={<LoadingFallback />}>
        <SharedAvatarModel {...props} />
      </Suspense>
    </AvatarErrorBoundary>
  );
};

// Preload helper - call this once to cache the model
export const preloadSharedAvatar = (url: string) => {
  useGLTF.preload(url);
};
