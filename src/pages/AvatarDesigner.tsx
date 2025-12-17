import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, RotateCcw, User, Scissors, Shirt, Sparkles, Crown, CheckCircle, Lock } from "lucide-react";
import { usePlayerAvatar, AvatarConfig, defaultConfig } from "@/hooks/usePlayerAvatar";
import { useVipStatus } from "@/hooks/useVipStatus";
import { AvatarPreview3D } from "@/components/avatar-designer/AvatarPreview3D";
import { HairSelector } from "@/components/avatar-designer/HairSelector";
import { BodySelector } from "@/components/avatar-designer/BodySelector";
import { FaceSelector } from "@/components/avatar-designer/FaceSelector";
import { ClothingSelector } from "@/components/avatar-designer/ClothingSelector";
import { AccessorySelector } from "@/components/avatar-designer/AccessorySelector";
import { ReadyPlayerMeCreator } from "@/components/avatar-designer/ReadyPlayerMeCreator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const AvatarDesigner = () => {
  const navigate = useNavigate();
  const { data: vipStatus } = useVipStatus();
  const {
    avatarConfig,
    isLoading,
    hairStyles,
    clothingItems,
    profile,
    saveConfig,
    isSaving,
    purchaseSkin,
    isItemOwned,
    getClothingColor,
  } = usePlayerAvatar();

  const [localConfig, setLocalConfig] = useState<Partial<AvatarConfig>>(defaultConfig);
  const [showRpmCreator, setShowRpmCreator] = useState(false);
  const isVip = vipStatus?.isVip || false;

  useEffect(() => {
    if (avatarConfig) {
      setLocalConfig(avatarConfig);
    }
  }, [avatarConfig]);

  // Update clothing colors when items change
  useEffect(() => {
    if (clothingItems && localConfig) {
      const shirtColor = localConfig.shirt_id 
        ? getClothingColor(localConfig.shirt_id, localConfig.shirt_color || '#2d0a0a')
        : localConfig.shirt_color;
      const pantsColor = localConfig.pants_id 
        ? getClothingColor(localConfig.pants_id, localConfig.pants_color || '#1a1a1a')
        : localConfig.pants_color;
      const shoesColor = localConfig.shoes_id 
        ? getClothingColor(localConfig.shoes_id, localConfig.shoes_color || '#1a1a1a')
        : localConfig.shoes_color;
      const jacketColor = localConfig.jacket_id 
        ? getClothingColor(localConfig.jacket_id, localConfig.jacket_color || '#1a1a1a')
        : localConfig.jacket_color;

      if (shirtColor !== localConfig.shirt_color || 
          pantsColor !== localConfig.pants_color ||
          shoesColor !== localConfig.shoes_color ||
          jacketColor !== localConfig.jacket_color) {
        setLocalConfig(prev => ({
          ...prev,
          shirt_color: shirtColor,
          pants_color: pantsColor,
          shoes_color: shoesColor,
          jacket_color: jacketColor,
        }));
      }
    }
  }, [localConfig.shirt_id, localConfig.pants_id, localConfig.shoes_id, localConfig.jacket_id, clothingItems]);

  const handleSave = () => {
    saveConfig(localConfig);
  };

  const handleReset = () => {
    setLocalConfig(defaultConfig);
  };

  const handlePurchase = (itemId: string, itemType: string, price: number) => {
    purchaseSkin({ itemId, itemType, price });
  };

  const handleRpmAvatarCreated = (avatarUrl: string, avatarId: string) => {
    setLocalConfig(prev => ({
      ...prev,
      rpm_avatar_url: avatarUrl,
      rpm_avatar_id: avatarId,
      use_rpm_avatar: true,
    }));
    setShowRpmCreator(false);
    toast.success('Premium avatar created! Click Save to apply.');
  };

  const handleToggleRpmAvatar = (useRpm: boolean) => {
    setLocalConfig(prev => ({
      ...prev,
      use_rpm_avatar: useRpm,
    }));
  };

  const handleHairStyleSelect = (styleId: string | null) => {
    if (!styleId) {
      setLocalConfig(prev => ({ ...prev, hair_style_key: 'bald' }));
      return;
    }
    const style = hairStyles?.find(s => s.id === styleId);
    if (style) {
      setLocalConfig(prev => ({ ...prev, hair_style_key: style.style_key }));
    }
  };

  const getSelectedHairStyleId = () => {
    if (!localConfig.hair_style_key || !hairStyles) return null;
    const style = hairStyles.find(s => s.style_key === localConfig.hair_style_key);
    return style?.id || null;
  };

  const accessories = clothingItems?.filter(item => 
    ['sunglasses', 'glasses', 'headphones', 'cap', 'beanie', 'bandana', 'chain', 'necklace', 'earring', 'watch', 'bracelet', 'ring'].includes(item.category)
  ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-oswald">Avatar Designer</h1>
          <p className="text-sm text-muted-foreground">
            Customize your character's appearance
            {profile?.cash !== undefined && (
              <span className="ml-2 text-primary font-medium">${profile.cash.toLocaleString()} available</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
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
          <CardContent className="p-0">
            <AvatarPreview3D config={localConfig} autoRotate={false} />
          </CardContent>
        </Card>

        {/* Customization Panel */}
        <div>
          <Tabs defaultValue="body" className="w-full">
            <TabsList className="w-full grid grid-cols-6 mb-4">
              <TabsTrigger value="premium" className="text-xs sm:text-sm">
                <Crown className="h-4 w-4 sm:mr-1 text-yellow-500" />
                <span className="hidden sm:inline">Premium</span>
              </TabsTrigger>
              <TabsTrigger value="body" className="text-xs sm:text-sm">
                <User className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Body</span>
              </TabsTrigger>
              <TabsTrigger value="hair" className="text-xs sm:text-sm">
                <Scissors className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Hair</span>
              </TabsTrigger>
              <TabsTrigger value="face" className="text-xs sm:text-sm">
                <span className="text-lg sm:mr-1">😊</span>
                <span className="hidden sm:inline">Face</span>
              </TabsTrigger>
              <TabsTrigger value="clothing" className="text-xs sm:text-sm">
                <Shirt className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Clothes</span>
              </TabsTrigger>
              <TabsTrigger value="accessories" className="text-xs sm:text-sm">
                <Sparkles className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Extra</span>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[500px] pr-4">
              <TabsContent value="premium" className="mt-0">
                <div className="space-y-4">
                  {!isVip ? (
                    <div className="p-6 border border-yellow-500/30 rounded-lg bg-yellow-500/5 text-center">
                      <Lock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                      <h3 className="font-semibold text-lg mb-2">VIP Feature</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Ready Player Me premium avatars are exclusive to VIP members. Upgrade to unlock high-quality 3D avatars with hundreds of customization options.
                      </p>
                      <Button
                        onClick={() => navigate('/vip')}
                        className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                      >
                        <Crown className="h-4 w-4 mr-2" />
                        Become a VIP
                      </Button>
                      
                      <div className="mt-6 p-3 border border-border rounded-lg bg-muted/30 text-left">
                        <h4 className="font-medium mb-2">Premium Avatar Features</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Professional quality 3D model</li>
                          <li>• Hundreds of clothing & accessory options</li>
                          <li>• Realistic facial expressions</li>
                          <li>• Smooth animations on stage</li>
                          <li>• Regular new content updates</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-4 border border-yellow-500/30 rounded-lg bg-yellow-500/5">
                        <div className="flex items-center gap-2 mb-2">
                          <Crown className="h-5 w-5 text-yellow-500" />
                          <h3 className="font-semibold">Ready Player Me Avatar</h3>
                          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500">VIP</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Create a high-quality 3D avatar with hundreds of customization options using Ready Player Me's professional avatar creator.
                        </p>
                        
                        {localConfig.rpm_avatar_url ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-green-500">
                              <CheckCircle className="h-4 w-4" />
                              <span className="text-sm font-medium">Premium avatar configured</span>
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                variant={localConfig.use_rpm_avatar ? "default" : "outline"}
                                onClick={() => handleToggleRpmAvatar(true)}
                                className="flex-1"
                              >
                                Use Premium Avatar
                              </Button>
                              <Button
                                variant={!localConfig.use_rpm_avatar ? "default" : "outline"}
                                onClick={() => handleToggleRpmAvatar(false)}
                                className="flex-1"
                              >
                                Use Basic Avatar
                              </Button>
                            </div>
                            
                            <Button
                              variant="outline"
                              onClick={() => setShowRpmCreator(true)}
                              className="w-full"
                            >
                              Create New Premium Avatar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => setShowRpmCreator(true)}
                            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                          >
                            <Crown className="h-4 w-4 mr-2" />
                            Create Premium Avatar
                          </Button>
                        )}
                      </div>
                      
                      {showRpmCreator && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Avatar Creator</h4>
                            <Button variant="ghost" size="sm" onClick={() => setShowRpmCreator(false)}>
                              Cancel
                            </Button>
                          </div>
                          <ReadyPlayerMeCreator
                            onAvatarCreated={handleRpmAvatarCreated}
                            onClose={() => setShowRpmCreator(false)}
                          />
                        </div>
                      )}
                      
                      <div className="p-3 border border-border rounded-lg bg-muted/30">
                        <h4 className="font-medium mb-2">Premium Avatar Features</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Professional quality 3D model</li>
                          <li>• Hundreds of clothing & accessory options</li>
                          <li>• Realistic facial expressions</li>
                          <li>• Smooth animations on stage</li>
                          <li>• Regular new content updates</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="body" className="mt-0">
                <BodySelector
                  bodyType={localConfig.body_type || 'average'}
                  height={localConfig.height || 1.0}
                  skinTone={localConfig.skin_tone || '#e0ac69'}
                  gender={localConfig.gender || 'male'}
                  weight={localConfig.weight ?? 1.0}
                  muscleDefinition={localConfig.muscle_definition ?? 0.5}
                  shoulderWidth={localConfig.shoulder_width ?? 1.0}
                  hipWidth={localConfig.hip_width ?? 1.0}
                  torsoLength={localConfig.torso_length ?? 1.0}
                  armLength={localConfig.arm_length ?? 1.0}
                  legLength={localConfig.leg_length ?? 1.0}
                  ageAppearance={(localConfig.age_appearance as 'young' | 'adult' | 'mature') || 'adult'}
                  onBodyTypeChange={(type) => setLocalConfig(prev => ({ ...prev, body_type: type }))}
                  onHeightChange={(height) => setLocalConfig(prev => ({ ...prev, height }))}
                  onSkinToneChange={(tone) => setLocalConfig(prev => ({ ...prev, skin_tone: tone }))}
                  onGenderChange={(gender) => setLocalConfig(prev => ({ ...prev, gender }))}
                  onWeightChange={(weight) => setLocalConfig(prev => ({ ...prev, weight }))}
                  onMuscleDefinitionChange={(muscle_definition) => setLocalConfig(prev => ({ ...prev, muscle_definition }))}
                  onShoulderWidthChange={(shoulder_width) => setLocalConfig(prev => ({ ...prev, shoulder_width }))}
                  onHipWidthChange={(hip_width) => setLocalConfig(prev => ({ ...prev, hip_width }))}
                  onTorsoLengthChange={(torso_length) => setLocalConfig(prev => ({ ...prev, torso_length }))}
                  onArmLengthChange={(arm_length) => setLocalConfig(prev => ({ ...prev, arm_length }))}
                  onLegLengthChange={(leg_length) => setLocalConfig(prev => ({ ...prev, leg_length }))}
                  onAgeAppearanceChange={(age_appearance) => setLocalConfig(prev => ({ ...prev, age_appearance }))}
                />
              </TabsContent>

              <TabsContent value="hair" className="mt-0">
                <HairSelector
                  hairStyles={hairStyles || []}
                  selectedStyleId={getSelectedHairStyleId()}
                  selectedColor={localConfig.hair_color || '#2d1a0a'}
                  onStyleSelect={handleHairStyleSelect}
                  onColorSelect={(color) => setLocalConfig(prev => ({ ...prev, hair_color: color }))}
                  isItemOwned={isItemOwned}
                  onPurchase={(id, price) => handlePurchase(id, 'hair_style', price)}
                />
              </TabsContent>

              <TabsContent value="face" className="mt-0">
                <FaceSelector
                  // Eyes
                  selectedEyeStyle={localConfig.eye_style || 'default'}
                  eyeColor={localConfig.eye_color || '#2d1a0a'}
                  eyeSize={localConfig.eye_size ?? 1.0}
                  eyeSpacing={localConfig.eye_spacing ?? 1.0}
                  eyeTilt={localConfig.eye_tilt ?? 0}
                  onEyeStyleChange={(style) => setLocalConfig(prev => ({ ...prev, eye_style: style }))}
                  onEyeColorChange={(eye_color) => setLocalConfig(prev => ({ ...prev, eye_color }))}
                  onEyeSizeChange={(eye_size) => setLocalConfig(prev => ({ ...prev, eye_size }))}
                  onEyeSpacingChange={(eye_spacing) => setLocalConfig(prev => ({ ...prev, eye_spacing }))}
                  onEyeTiltChange={(eye_tilt) => setLocalConfig(prev => ({ ...prev, eye_tilt }))}
                  // Eyebrows
                  eyebrowStyle={localConfig.eyebrow_style || 'normal'}
                  eyebrowColor={localConfig.eyebrow_color || '#1a1a1a'}
                  eyebrowThickness={localConfig.eyebrow_thickness ?? 1.0}
                  onEyebrowStyleChange={(eyebrow_style) => setLocalConfig(prev => ({ ...prev, eyebrow_style: eyebrow_style as any }))}
                  onEyebrowColorChange={(eyebrow_color) => setLocalConfig(prev => ({ ...prev, eyebrow_color }))}
                  onEyebrowThicknessChange={(eyebrow_thickness) => setLocalConfig(prev => ({ ...prev, eyebrow_thickness }))}
                  // Nose
                  selectedNoseStyle={localConfig.nose_style || 'default'}
                  noseWidth={localConfig.nose_width ?? 1.0}
                  noseLength={localConfig.nose_length ?? 1.0}
                  noseBridge={localConfig.nose_bridge ?? 0.5}
                  onNoseStyleChange={(style) => setLocalConfig(prev => ({ ...prev, nose_style: style }))}
                  onNoseWidthChange={(nose_width) => setLocalConfig(prev => ({ ...prev, nose_width }))}
                  onNoseLengthChange={(nose_length) => setLocalConfig(prev => ({ ...prev, nose_length }))}
                  onNoseBridgeChange={(nose_bridge) => setLocalConfig(prev => ({ ...prev, nose_bridge }))}
                  // Mouth
                  selectedMouthStyle={localConfig.mouth_style || 'default'}
                  lipFullness={localConfig.lip_fullness ?? 1.0}
                  lipWidth={localConfig.lip_width ?? 1.0}
                  lipColor={localConfig.lip_color || '#c4777f'}
                  onMouthStyleChange={(style) => setLocalConfig(prev => ({ ...prev, mouth_style: style }))}
                  onLipFullnessChange={(lip_fullness) => setLocalConfig(prev => ({ ...prev, lip_fullness }))}
                  onLipWidthChange={(lip_width) => setLocalConfig(prev => ({ ...prev, lip_width }))}
                  onLipColorChange={(lip_color) => setLocalConfig(prev => ({ ...prev, lip_color }))}
                  // Face Structure
                  faceWidth={localConfig.face_width ?? 1.0}
                  faceLength={localConfig.face_length ?? 1.0}
                  jawShape={localConfig.jaw_shape || 'round'}
                  cheekbone={localConfig.cheekbone ?? 0.5}
                  chinProminence={localConfig.chin_prominence ?? 0.5}
                  onFaceWidthChange={(face_width) => setLocalConfig(prev => ({ ...prev, face_width }))}
                  onFaceLengthChange={(face_length) => setLocalConfig(prev => ({ ...prev, face_length }))}
                  onJawShapeChange={(jaw_shape) => setLocalConfig(prev => ({ ...prev, jaw_shape: jaw_shape as any }))}
                  onCheekboneChange={(cheekbone) => setLocalConfig(prev => ({ ...prev, cheekbone }))}
                  onChinProminenceChange={(chin_prominence) => setLocalConfig(prev => ({ ...prev, chin_prominence }))}
                  // Ears
                  earSize={localConfig.ear_size ?? 1.0}
                  earAngle={localConfig.ear_angle ?? 0}
                  onEarSizeChange={(ear_size) => setLocalConfig(prev => ({ ...prev, ear_size }))}
                  onEarAngleChange={(ear_angle) => setLocalConfig(prev => ({ ...prev, ear_angle }))}
                  // Extras
                  selectedBeardStyle={localConfig.beard_style || null}
                  selectedTattooStyle={localConfig.tattoo_style || null}
                  selectedScarStyle={localConfig.scar_style || null}
                  onBeardStyleChange={(style) => setLocalConfig(prev => ({ ...prev, beard_style: style }))}
                  onTattooStyleChange={(style) => setLocalConfig(prev => ({ ...prev, tattoo_style: style }))}
                  onScarStyleChange={(style) => setLocalConfig(prev => ({ ...prev, scar_style: style }))}
                  isItemOwned={isItemOwned}
                  onPurchase={(id, price) => handlePurchase(id, 'face_option', price)}
                />
              </TabsContent>

              <TabsContent value="clothing" className="mt-0">
                <ClothingSelector
                  clothingItems={(clothingItems || []) as any}
                  selectedShirtId={localConfig.shirt_id || null}
                  selectedPantsId={localConfig.pants_id || null}
                  selectedJacketId={localConfig.jacket_id || null}
                  selectedShoesId={localConfig.shoes_id || null}
                  onShirtSelect={(id) => setLocalConfig(prev => ({ ...prev, shirt_id: id }))}
                  onPantsSelect={(id) => setLocalConfig(prev => ({ ...prev, pants_id: id }))}
                  onJacketSelect={(id) => setLocalConfig(prev => ({ ...prev, jacket_id: id }))}
                  onShoesSelect={(id) => setLocalConfig(prev => ({ ...prev, shoes_id: id }))}
                  isItemOwned={isItemOwned}
                  onPurchase={(id, price) => handlePurchase(id, 'clothing', price)}
                />
              </TabsContent>

              <TabsContent value="accessories" className="mt-0">
                <AccessorySelector
                  accessories={accessories}
                  selectedAccessory1={localConfig.accessory_1_id || null}
                  selectedAccessory2={localConfig.accessory_2_id || null}
                  onAccessory1Select={(id) => setLocalConfig(prev => ({ ...prev, accessory_1_id: id }))}
                  onAccessory2Select={(id) => setLocalConfig(prev => ({ ...prev, accessory_2_id: id }))}
                  isItemOwned={isItemOwned}
                  onPurchase={(id, price) => handlePurchase(id, 'accessory', price)}
                />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default AvatarDesigner;