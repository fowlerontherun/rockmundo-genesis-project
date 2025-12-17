import { useState, useEffect, Suspense, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, RotateCcw, Crown, CheckCircle, Maximize2, User, UserCircle, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { usePlayerAvatar, AvatarConfig, defaultConfig } from "@/hooks/usePlayerAvatar";
import { ReadyPlayerMeCreator } from "@/components/avatar-designer/ReadyPlayerMeCreator";
import { ReadyPlayerMeAvatar } from "@/components/avatar-system/ReadyPlayerMeAvatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as THREE from "three";

type ViewPreset = 'full' | 'upper' | 'head';

const viewPresets: Record<ViewPreset, { 
  position: [number, number, number]; 
  target: [number, number, number]; 
  label: string;
  icon: React.ReactNode;
}> = {
  full: { position: [0, 0, 4], target: [0, -0.3, 0], label: 'Full Body', icon: <Maximize2 className="h-4 w-4" /> },
  upper: { position: [0, 0.3, 2.5], target: [0, 0.2, 0], label: 'Upper Body', icon: <User className="h-4 w-4" /> },
  head: { position: [0, 0.8, 1.8], target: [0, 0.6, 0], label: 'Face', icon: <UserCircle className="h-4 w-4" /> },
};

interface AvatarPreviewSceneProps {
  avatarUrl: string;
  viewPreset: ViewPreset;
  autoRotate: boolean;
  controlsRef: React.MutableRefObject<any>;
}

const AvatarPreviewScene = ({ avatarUrl, viewPreset, autoRotate, controlsRef }: AvatarPreviewSceneProps) => {
  const preset = viewPresets[viewPreset];
  
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 5, 5]} intensity={0.9} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.4} />
      <pointLight position={[0, 3, 2]} intensity={0.5} color="#ffeedd" />
      
      <Suspense fallback={
        <mesh position={[0, -0.5, 0]}>
          <capsuleGeometry args={[0.4, 1.2, 8, 16]} />
          <meshStandardMaterial color="#404040" transparent opacity={0.5} />
        </mesh>
      }>
        <ReadyPlayerMeAvatar
          avatarUrl={avatarUrl}
          scale={1.8}
          position={[0, -1.5, 0]}
          rotation={[0, 0, 0]}
        />
      </Suspense>
      
      <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={4} blur={2} far={4} />
      <Environment preset="studio" />
      
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minPolarAngle={0}
        maxPolarAngle={Math.PI * 0.9}
        minDistance={1}
        maxDistance={8}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        target={new THREE.Vector3(...preset.target)}
        dampingFactor={0.1}
        rotateSpeed={0.8}
        zoomSpeed={1.2}
        panSpeed={0.8}
      />
    </>
  );
};

const AvatarDesigner = () => {
  const {
    avatarConfig,
    isLoading,
    saveConfig,
    isSaving,
  } = usePlayerAvatar();

  const [localConfig, setLocalConfig] = useState<Partial<AvatarConfig>>(defaultConfig);
  const [showRpmCreator, setShowRpmCreator] = useState(false);
  const [viewPreset, setViewPreset] = useState<ViewPreset>('full');
  const [autoRotate, setAutoRotate] = useState(false);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (avatarConfig) {
      setLocalConfig(avatarConfig);
    }
  }, [avatarConfig]);

  const handleSave = () => {
    saveConfig(localConfig);
  };

  const handleReset = () => {
    setLocalConfig(prev => ({
      ...prev,
      rpm_avatar_url: null,
      rpm_avatar_id: null,
      use_rpm_avatar: false,
    }));
  };

  const handleRpmAvatarCreated = (avatarUrl: string, avatarId: string) => {
    setLocalConfig(prev => ({
      ...prev,
      rpm_avatar_url: avatarUrl,
      rpm_avatar_id: avatarId,
      use_rpm_avatar: true,
    }));
    setShowRpmCreator(false);
    toast.success('Avatar created! Click Save to apply.');
  };

  const handleResetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
    setViewPreset('full');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasAvatar = !!localConfig.rpm_avatar_url;
  const currentPreset = viewPresets[viewPreset];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-oswald">Avatar</h1>
          <p className="text-sm text-muted-foreground">
            {hasAvatar ? 'Your 3D avatar for performances' : 'Create your unique 3D avatar'}
          </p>
        </div>
        <div className="flex gap-2">
          {hasAvatar && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Remove
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Avatar Preview (when avatar exists) */}
      {hasAvatar && !showRpmCreator && (
        <Card>
          <CardContent className="p-4">
            {/* View Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex gap-1">
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
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoRotate(!autoRotate)}
                  className={autoRotate ? "bg-primary/20" : ""}
                >
                  <RotateCw className={`h-4 w-4 ${autoRotate ? "animate-spin" : ""}`} />
                </Button>
                <Button variant="outline" size="sm" onClick={handleResetView}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 3D Canvas */}
            <div className="w-full h-[450px] bg-gradient-to-b from-background to-muted/30 rounded-lg overflow-hidden">
              <Canvas
                camera={{ position: currentPreset.position, fov: 45 }}
                shadows
                gl={{ antialias: true, preserveDrawingBuffer: true }}
              >
                <AvatarPreviewScene 
                  avatarUrl={localConfig.rpm_avatar_url!}
                  viewPreset={viewPreset}
                  autoRotate={autoRotate}
                  controlsRef={controlsRef}
                />
              </Canvas>
            </div>

            {/* Help Text */}
            <p className="text-xs text-muted-foreground text-center mt-2">
              Drag to rotate • Scroll to zoom • Right-click drag to pan
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status/Action Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-3 rounded-full ${hasAvatar ? 'bg-green-500/20' : 'bg-primary/20'}`}>
              {hasAvatar ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : (
                <Crown className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <h3 className="font-semibold">
                {hasAvatar ? 'Avatar Ready!' : 'Create Your Avatar'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {hasAvatar 
                  ? 'Your avatar will appear on stage during gig performances'
                  : 'Design a unique 3D character that represents you on stage'
                }
              </p>
            </div>
          </div>

          {hasAvatar ? (
            <Button
              variant="outline"
              onClick={() => setShowRpmCreator(true)}
              className="w-full"
            >
              <Crown className="h-4 w-4 mr-2" />
              Create New Avatar
            </Button>
          ) : (
            <Button
              onClick={() => setShowRpmCreator(true)}
              className="w-full"
              size="lg"
            >
              <Crown className="h-5 w-5 mr-2" />
              Create Your 3D Avatar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* RPM Creator */}
      {showRpmCreator && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Avatar Creator</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowRpmCreator(false)}>
                Cancel
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ReadyPlayerMeCreator
              onAvatarCreated={handleRpmAvatarCreated}
              onClose={() => setShowRpmCreator(false)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AvatarDesigner;
