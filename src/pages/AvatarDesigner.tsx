import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, RotateCcw, Crown, CheckCircle, User } from "lucide-react";
import { usePlayerAvatar, AvatarConfig, defaultConfig } from "@/hooks/usePlayerAvatar";
import { AvatarPreview3D } from "@/components/avatar-designer/AvatarPreview3D";
import { ReadyPlayerMeCreator } from "@/components/avatar-designer/ReadyPlayerMeCreator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const AvatarDesigner = () => {
  const {
    avatarConfig,
    isLoading,
    profile,
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
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-oswald">Avatar Designer</h1>
          <p className="text-sm text-muted-foreground">
            Create your unique 3D avatar for performances
          </p>
        </div>
        <div className="flex gap-2">
          {hasAvatar && (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Remove Avatar
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3D Preview */}
        <Card className="lg:sticky lg:top-4 h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <AvatarPreview3D config={localConfig} autoRotate={!hasAvatar} />
          </CardContent>
        </Card>

        {/* Avatar Creator Panel */}
        <div className="space-y-4">
          {/* Status Card */}
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
                      ? 'Your 3D avatar is configured and ready for performances'
                      : 'Design a unique 3D character that represents you on stage'
                    }
                  </p>
                </div>
              </div>

              {hasAvatar ? (
                <div className="space-y-3">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Avatar ID</p>
                    <p className="text-sm font-mono truncate">{localConfig.rpm_avatar_id}</p>
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => setShowRpmCreator(true)}
                    className="w-full"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Create New Avatar
                  </Button>
                </div>
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

          {/* Features Card */}
          {!showRpmCreator && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Avatar Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-2 w-2 p-0 rounded-full bg-green-500" />
                    Professional quality 3D character model
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-2 w-2 p-0 rounded-full bg-green-500" />
                    Hundreds of clothing & accessory options
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-2 w-2 p-0 rounded-full bg-green-500" />
                    Appears on stage during gig performances
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-2 w-2 p-0 rounded-full bg-green-500" />
                    Smooth performance animations
                  </li>
                  <li className="flex items-center gap-2">
                    <Badge variant="secondary" className="h-2 w-2 p-0 rounded-full bg-green-500" />
                    Regular new content updates
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvatarDesigner;
