import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { AvatarConfig } from "@/hooks/usePlayerAvatar";
import { ReadyPlayerMeAvatar } from "@/components/avatar-system/ReadyPlayerMeAvatar";
import { Button } from "@/components/ui/button";
import { User, Maximize2, Focus, UserCircle } from "lucide-react";

interface AvatarPreview3DProps {
  config: Partial<AvatarConfig>;
  autoRotate?: boolean;
}

type ViewPreset = 'full' | 'upper' | 'head';

const viewPresets: Record<ViewPreset, { camera: [number, number, number]; target: [number, number, number]; label: string; icon: React.ReactNode }> = {
  full: { camera: [0, 0, 4], target: [0, 0, 0], label: 'Full', icon: <Maximize2 className="h-4 w-4" /> },
  upper: { camera: [0, 0.5, 2.5], target: [0, 0.3, 0], label: 'Upper', icon: <User className="h-4 w-4" /> },
  head: { camera: [0, 0.8, 1.5], target: [0, 0.7, 0], label: 'Head', icon: <UserCircle className="h-4 w-4" /> },
};

const LoadingPlaceholder = () => (
  <mesh position={[0, 0, 0]}>
    <capsuleGeometry args={[0.4, 1.2, 8, 16]} />
    <meshStandardMaterial color="#404040" transparent opacity={0.5} />
  </mesh>
);

const PlaceholderAvatar = () => (
  <group position={[0, -0.5, 0]}>
    <mesh position={[0, 0.8, 0]}>
      <capsuleGeometry args={[0.35, 0.8, 8, 16]} />
      <meshStandardMaterial color="#3a3a3a" />
    </mesh>
    <mesh position={[0, 1.7, 0]}>
      <sphereGeometry args={[0.3, 16, 16]} />
      <meshStandardMaterial color="#4a4a4a" />
    </mesh>
    <mesh position={[-0.5, 0.9, 0]} rotation={[0, 0, 0.3]}>
      <capsuleGeometry args={[0.1, 0.5, 8, 8]} />
      <meshStandardMaterial color="#3a3a3a" />
    </mesh>
    <mesh position={[0.5, 0.9, 0]} rotation={[0, 0, -0.3]}>
      <capsuleGeometry args={[0.1, 0.5, 8, 8]} />
      <meshStandardMaterial color="#3a3a3a" />
    </mesh>
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

interface RpmSceneProps {
  avatarUrl: string | null;
  autoRotate: boolean;
  viewPreset: ViewPreset;
}

const RpmScene = ({ avatarUrl, autoRotate, viewPreset }: RpmSceneProps) => {
  const preset = viewPresets[viewPreset];
  
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
            scale={1.5}
            position={[0, -1.2, 0]}
            rotation={[0, 0, 0]}
          />
        ) : (
          <PlaceholderAvatar />
        )}
      </Suspense>
      
      <ContactShadows
        position={[0, -1.2, 0]}
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
        minDistance={1}
        maxDistance={6}
        autoRotate={autoRotate}
        autoRotateSpeed={1}
        target={preset.target}
      />
    </>
  );
};

export const AvatarPreview3D = ({ config, autoRotate = false }: AvatarPreview3DProps) => {
  const avatarUrl = config.rpm_avatar_url || null;
  const [viewPreset, setViewPreset] = useState<ViewPreset>('full');
  const preset = viewPresets[viewPreset];

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-2">
      {/* View Controls */}
      <div className="flex justify-center gap-1">
        {(Object.keys(viewPresets) as ViewPreset[]).map((key) => (
          <Button
            key={key}
            variant={viewPreset === key ? "default" : "outline"}
            size="sm"
            onClick={() => setViewPreset(key)}
            className="gap-1.5"
          >
            {viewPresets[key].icon}
            <span className="hidden sm:inline">{viewPresets[key].label}</span>
          </Button>
        ))}
      </div>

      {/* 3D Canvas */}
      <div className="w-full aspect-[3/4] bg-gradient-to-b from-background to-muted/30 rounded-lg overflow-hidden relative">
        <Canvas
          camera={{ position: preset.camera, fov: 45 }}
          shadows
          gl={{ antialias: true, preserveDrawingBuffer: true }}
        >
          <RpmScene avatarUrl={avatarUrl} autoRotate={autoRotate} viewPreset={viewPreset} />
        </Canvas>
        
        {!avatarUrl && (
          <div className="absolute bottom-4 left-0 right-0 text-center">
            <p className="text-sm text-muted-foreground bg-background/80 inline-block px-4 py-2 rounded-full">
              Create your avatar to see preview
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Drag to rotate • Scroll to zoom
      </p>
    </div>
  );
};
