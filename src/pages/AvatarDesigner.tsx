import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, RotateCcw, User, Scissors, Shirt, Sparkles } from "lucide-react";
import { usePlayerAvatar, AvatarConfig, defaultConfig } from "@/hooks/usePlayerAvatar";
import { AvatarPreview3D } from "@/components/avatar-designer/AvatarPreview3D";
import { HairSelector } from "@/components/avatar-designer/HairSelector";
import { BodySelector } from "@/components/avatar-designer/BodySelector";
import { FaceSelector } from "@/components/avatar-designer/FaceSelector";
import { ClothingSelector } from "@/components/avatar-designer/ClothingSelector";
import { AccessorySelector } from "@/components/avatar-designer/AccessorySelector";

const AvatarDesigner = () => {
  const {
    avatarConfig,
    isLoading,
    hairStyles,
    clothingItems,
    faceOptions,
    profile,
    saveConfig,
    isSaving,
    purchaseSkin,
    isPurchasing,
    isItemOwned,
    getClothingColor,
  } = usePlayerAvatar();

  const [localConfig, setLocalConfig] = useState<Partial<AvatarConfig>>(defaultConfig);

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

  // Handle hair style selection - store style_key not ID
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

  // Get the hair style ID from the style_key for display
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
            <AvatarPreview3D config={localConfig} autoRotate={true} />
          </CardContent>
        </Card>

        {/* Customization Panel */}
        <div>
          <Tabs defaultValue="body" className="w-full">
            <TabsList className="w-full grid grid-cols-5 mb-4">
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
              <TabsContent value="body" className="mt-0">
                <BodySelector
                  bodyType={localConfig.body_type || 'average'}
                  height={localConfig.height || 1.0}
                  skinTone={localConfig.skin_tone || '#e0ac69'}
                  gender={localConfig.gender || 'male'}
                  onBodyTypeChange={(type) => setLocalConfig(prev => ({ ...prev, body_type: type }))}
                  onHeightChange={(height) => setLocalConfig(prev => ({ ...prev, height }))}
                  onSkinToneChange={(tone) => setLocalConfig(prev => ({ ...prev, skin_tone: tone }))}
                  onGenderChange={(gender) => setLocalConfig(prev => ({ ...prev, gender }))}
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
                  faceOptions={(faceOptions || []) as any}
                  selectedEyeStyle={localConfig.eye_style || 'default'}
                  selectedNoseStyle={localConfig.nose_style || 'default'}
                  selectedMouthStyle={localConfig.mouth_style || 'default'}
                  selectedBeardStyle={localConfig.beard_style || null}
                  selectedTattooStyle={localConfig.tattoo_style || null}
                  selectedScarStyle={localConfig.scar_style || null}
                  onEyeStyleChange={(style) => setLocalConfig(prev => ({ ...prev, eye_style: style }))}
                  onNoseStyleChange={(style) => setLocalConfig(prev => ({ ...prev, nose_style: style }))}
                  onMouthStyleChange={(style) => setLocalConfig(prev => ({ ...prev, mouth_style: style }))}
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
