import { useRef, Suspense, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { AvatarConfig } from "@/hooks/usePlayerAvatar";
import { EnhancedAvatar } from "./EnhancedAvatar";
import { StudioLighting } from "./StudioLighting";
import { StudioBackground } from "./StudioBackground";
import { EnhancedViewControls } from "./EnhancedViewControls";

interface EnhancedAvatarCanvasProps {
  config: Partial<AvatarConfig>;
  autoRotate?: boolean;
  backgroundTheme?: 'dark' | 'light' | 'gradient' | 'stage';
}

const CameraController = ({
  targetPosition,
}: {
  targetPosition: [number, number, number];
}) => {
  const { camera } = useThree();

  useFrame(() => {
    camera.position.lerp(
      { x: targetPosition[0], y: targetPosition[1], z: targetPosition[2] },
      0.08
    );
  });

  return null;
};

// Loading fallback with silhouette
const LoadingFallback = () => (
  <mesh position={[0, 1, 0]}>
    <capsuleGeometry args={[0.2, 0.6, 4, 8]} />
    <meshBasicMaterial color="#2a2a3a" transparent opacity={0.3} />
  </mesh>
);

export const EnhancedAvatarCanvas = ({
  config,
  autoRotate: initialAutoRotate = false,
  backgroundTheme = 'gradient',
}: EnhancedAvatarCanvasProps) => {
  const [autoRotate, setAutoRotate] = useState(initialAutoRotate);
  const [cameraTarget, setCameraTarget] = useState<[number, number, number]>([0, 1.3, 2.2]);
  const controlsRef = useRef<any>(null);

  const handleZoomIn = useCallback(() => {
    if (controlsRef.current) {
      const currentDistance = controlsRef.current.getDistance();
      controlsRef.current.dollyTo(Math.max(1, currentDistance - 0.4), true);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (controlsRef.current) {
      const currentDistance = controlsRef.current.getDistance();
      controlsRef.current.dollyTo(Math.min(4.5, currentDistance + 0.4), true);
    }
  }, []);

  const handleResetView = useCallback(() => {
    setCameraTarget([0, 1.3, 2.2]);
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }, []);

  const handleSetView = useCallback((view: 'face' | 'upper' | 'full') => {
    switch (view) {
      case 'face':
        setCameraTarget([0, 1.55, 1.2]);
        break;
      case 'upper':
        setCameraTarget([0, 1.2, 1.8]);
        break;
      case 'full':
        setCameraTarget([0, 0.9, 2.8]);
        break;
    }
  }, []);

  return (
    <div className="relative w-full h-full min-h-[600px] rounded-xl overflow-hidden bg-gradient-to-b from-background via-card to-background border border-border/50">
      <Canvas
        camera={{ position: [0, 1.3, 2.2], fov: 35 }}
        shadows="soft"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={<LoadingFallback />}>
          {/* Enhanced Studio Lighting */}
          <StudioLighting intensity={1} />

          {/* Camera smooth transition */}
          <CameraController targetPosition={cameraTarget} />

          {/* The Avatar */}
          <EnhancedAvatar config={config} animate={true} />

          {/* Studio Background */}
          <StudioBackground theme={backgroundTheme} />

          {/* Contact shadows for grounding */}
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.6}
            scale={8}
            blur={2}
            far={4}
            resolution={512}
            color="#000000"
          />

          {/* Orbit Controls */}
          <OrbitControls
            ref={controlsRef}
            autoRotate={autoRotate}
            autoRotateSpeed={0.8}
            enablePan={false}
            minDistance={0.8}
            maxDistance={4.5}
            minPolarAngle={Math.PI / 8}
            maxPolarAngle={Math.PI * 0.8}
            target={[0, 1, 0]}
            enableDamping
            dampingFactor={0.05}
          />

          {/* Environment for reflections */}
          <Environment preset="city" />
        </Suspense>
      </Canvas>

      {/* Enhanced View Controls */}
      <EnhancedViewControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
        onSetView={handleSetView}
        autoRotate={autoRotate}
      />

      {/* Quality indicator */}
      <div className="absolute top-3 left-3 px-2 py-1 bg-background/80 backdrop-blur-sm rounded text-xs text-muted-foreground border border-border/50">
        Enhanced 3D Preview
      </div>
    </div>
  );
};
