import { useState, useEffect, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, RotateCcw, Crown, CheckCircle } from "lucide-react";
import { usePlayerAvatar, AvatarConfig, defaultConfig } from "@/hooks/usePlayerAvatar";
import { ReadyPlayerMeCreator } from "@/components/avatar-designer/ReadyPlayerMeCreator";
import { ReadyPlayerMeAvatar } from "@/components/avatar-system/ReadyPlayerMeAvatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const AvatarPreviewScene = ({ avatarUrl }: { avatarUrl: string }) => (
  <>
    <ambientLight intensity={0.7} />
    <directionalLight position={[5, 5, 5]} intensity={0.9} castShadow />
    <directionalLight position={[-5, 3, -5]} intensity={0.4} />
    <pointLight position={[0, 3, 2]} intensity={0.5} color="#ffeedd" />
    
    <Suspense fallback={
      <mesh position={[0, 0, 0]}>
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
      enablePan={false}
      enableZoom={true}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI * 0.75}
      minDistance={1.5}
      maxDistance={5}
      autoRotate
      autoRotateSpeed={0.5}
      target={[0, 0, 0]}
    />
  </>
);

const AvatarDesigner = () => {
  const {
    avatarConfig,
    isLoading,
    saveConfig,
    isSaving,
  } = usePlayerAvatar();

  const [localConfig, setLocalConfig] = useState<Partial<AvatarConfig>>(defaultConfig);
  const [showRpmCreator, setShowRpmCreator] = useState(false);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const hasAvatar = !!localConfig.rpm_avatar_url;

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
          <CardContent className="p-0">
            <div className="w-full h-[400px] bg-gradient-to-b from-background to-muted/30 rounded-lg overflow-hidden">
              <Canvas
                camera={{ position: [0, 0.5, 3], fov: 45 }}
                shadows
                gl={{ antialias: true, preserveDrawingBuffer: true }}
              >
                <AvatarPreviewScene avatarUrl={localConfig.rpm_avatar_url!} />
              </Canvas>
            </div>
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
