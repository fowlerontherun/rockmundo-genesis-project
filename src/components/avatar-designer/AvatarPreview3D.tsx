import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { AvatarConfig } from "@/hooks/usePlayerAvatar";
import { EnhancedAvatarCanvas } from "@/components/avatar-system";
import { ReadyPlayerMeAvatar } from "@/components/avatar-system/ReadyPlayerMeAvatar";

interface AvatarPreview3DProps {
  config: Partial<AvatarConfig>;
  autoRotate?: boolean;
}

const RpmPreviewScene = ({ avatarUrl, autoRotate }: { avatarUrl: string; autoRotate: boolean }) => {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} />
      <pointLight position={[0, 3, 2]} intensity={0.5} color="#ffeedd" />
      
      <Suspense fallback={
        <mesh>
          <capsuleGeometry args={[0.3, 1, 8, 16]} />
          <meshStandardMaterial color="hsl(var(--muted))" />
        </mesh>
      }>
        <ReadyPlayerMeAvatar
          avatarUrl={avatarUrl}
          scale={1.8}
          position={[0, -1.5, 0]}
          rotation={[0, 0, 0]}
        />
      </Suspense>
      
      <ContactShadows
        position={[0, -1.5, 0]}
        opacity={0.4}
        scale={4}
        blur={2}
        far={4}
      />
      
      <Environment preset="studio" />
      
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI * 0.75}
        minDistance={1.5}
        maxDistance={5}
        autoRotate={autoRotate}
        autoRotateSpeed={1}
        target={[0, 0, 0]}
      />
    </>
  );
};

export const AvatarPreview3D = ({ config, autoRotate = false }: AvatarPreview3DProps) => {
  const useRpm = config.use_rpm_avatar && config.rpm_avatar_url;

  if (useRpm) {
    return (
      <div className="w-full h-[450px] bg-gradient-to-b from-background to-muted/30 rounded-lg overflow-hidden">
        <Canvas
          camera={{ position: [0, 0.5, 3], fov: 45 }}
          shadows
          gl={{ antialias: true, preserveDrawingBuffer: true }}
        >
          <RpmPreviewScene avatarUrl={config.rpm_avatar_url!} autoRotate={autoRotate} />
        </Canvas>
      </div>
    );
  }

  return (
    <EnhancedAvatarCanvas 
      config={config} 
      autoRotate={autoRotate}
      backgroundTheme="gradient"
    />
  );
};
