import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows, Text } from "@react-three/drei";
import { AvatarConfig } from "@/hooks/usePlayerAvatar";
import { ReadyPlayerMeAvatar } from "@/components/avatar-system/ReadyPlayerMeAvatar";
import { User } from "lucide-react";

interface AvatarPreview3DProps {
  config: Partial<AvatarConfig>;
  autoRotate?: boolean;
}

const LoadingPlaceholder = () => (
  <mesh position={[0, 0, 0]}>
    <capsuleGeometry args={[0.4, 1.2, 8, 16]} />
    <meshStandardMaterial color="#404040" transparent opacity={0.5} />
  </mesh>
);

const PlaceholderAvatar = () => (
  <group position={[0, -0.5, 0]}>
    {/* Body */}
    <mesh position={[0, 0.8, 0]}>
      <capsuleGeometry args={[0.35, 0.8, 8, 16]} />
      <meshStandardMaterial color="#3a3a3a" />
    </mesh>
    {/* Head */}
    <mesh position={[0, 1.7, 0]}>
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshStandardMaterial color="#4a4a4a" />
    </mesh>
    {/* Arms */}
    <mesh position={[-0.5, 0.9, 0]} rotation={[0, 0, 0.3]}>
      <capsuleGeometry args={[0.1, 0.5, 8, 8]} />
      <meshStandardMaterial color="#3a3a3a" />
    </mesh>
    <mesh position={[0.5, 0.9, 0]} rotation={[0, 0, -0.3]}>
      <capsuleGeometry args={[0.1, 0.5, 8, 8]} />
      <meshStandardMaterial color="#3a3a3a" />
    </mesh>
    {/* Legs */}
    <mesh position={[-0.15, 0, 0]}>
      <capsuleGeometry args={[0.12, 0.6, 8, 8]} />
      <meshStandardMaterial color="#2a2a2a" />
    </mesh>
    <mesh position={[0.15, 0, 0]}>
      <capsuleGeometry args={[0.12, 0.6, 8, 8]} />
      <meshStandardMaterial color="#2a2a2a" />
    </mesh>
  </group>
);

const RpmScene = ({ avatarUrl, autoRotate }: { avatarUrl: string | null; autoRotate: boolean }) => {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={0.9} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} />
      <pointLight position={[0, 3, 2]} intensity={0.5} color="#ffeedd" />
      
      <Suspense fallback={<LoadingPlaceholder />}>
        {avatarUrl ? (
          <ReadyPlayerMeAvatar
            avatarUrl={avatarUrl}
            scale={1.8}
            position={[0, -1.5, 0]}
            rotation={[0, 0, 0]}
          />
        ) : (
          <PlaceholderAvatar />
        )}
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
  const avatarUrl = config.rpm_avatar_url || null;

  return (
    <div className="w-full h-[450px] bg-gradient-to-b from-background to-muted/30 rounded-lg overflow-hidden relative">
      <Canvas
        camera={{ position: [0, 0.5, 3], fov: 45 }}
        shadows
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <RpmScene avatarUrl={avatarUrl} autoRotate={autoRotate} />
      </Canvas>
      
      {!avatarUrl && (
        <div className="absolute bottom-4 left-0 right-0 text-center">
          <p className="text-sm text-muted-foreground bg-background/80 inline-block px-4 py-2 rounded-full">
            Create your avatar to see preview
          </p>
        </div>
      )}
    </div>
  );
};
