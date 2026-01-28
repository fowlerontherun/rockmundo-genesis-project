import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Save, RotateCcw, User, Shirt, Glasses, Sparkles } from "lucide-react";
import { useCharacterSprites, type SpriteCategory, type CharacterConfig } from "@/hooks/useCharacterSprites";
import { SpriteLayerCanvas } from "./SpriteLayerCanvas";
import { SpriteCategoryPicker } from "./SpriteCategoryPicker";
import { SkinTonePicker } from "./SkinTonePicker";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/useTranslation";

export const PunkCharacterCreator = () => {
  const { t } = useTranslation();
  const {
    sprites,
    config,
    isLoading,
    getSpritesByCategory,
    selectSprite,
    setSkinTone,
    saveConfig,
    isSaving,
  } = useCharacterSprites();

  const [localConfig, setLocalConfig] = useState<Partial<CharacterConfig>>({});
  const [activeTab, setActiveTab] = useState('body');
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');

  // Initialize local config from database
  useEffect(() => {
    if (config) {
      setLocalConfig(config);
      // Detect gender from body sprite
      const bodySprite = sprites?.find(s => s.id === config.body_sprite_id);
      if (bodySprite?.subcategory?.includes('female')) {
        setSelectedGender('female');
      }
    }
  }, [config, sprites]);

  const handleSpriteSelect = (category: SpriteCategory, spriteId: string | null) => {
    setLocalConfig(prev => ({
      ...prev,
      [`${category}_sprite_id`]: spriteId,
    }));
    selectSprite(category, spriteId);
  };

  const handleSkinToneChange = (toneId: string) => {
    setLocalConfig(prev => ({
      ...prev,
      selected_skin_tone: toneId,
    }));
    setSkinTone(toneId);
  };

  const handleGenderChange = (gender: 'male' | 'female') => {
    setSelectedGender(gender);
    // Clear body selection when changing gender
    setLocalConfig(prev => ({
      ...prev,
      body_sprite_id: null,
      facial_hair_sprite_id: null, // Clear facial hair for female
    }));
    selectSprite('body', null);
    selectSprite('facial_hair', null);
  };

  const handleReset = () => {
    setLocalConfig({
      selected_skin_tone: 'medium',
    });
    // Clear all sprite selections
    const categories: SpriteCategory[] = [
      'body', 'eyes', 'nose', 'mouth', 'hair', 'jacket', 
      'shirt', 'trousers', 'shoes', 'hat', 'glasses', 'facial_hair'
    ];
    categories.forEach(cat => selectSprite(cat, null));
    toast.info('Character reset');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-oswald flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Character Creator
          </h1>
          <p className="text-sm text-muted-foreground">
            Design your unique punk rock character
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preview Panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="w-full aspect-[3/4] bg-gradient-to-b from-muted/20 to-muted/40 rounded-lg flex items-center justify-center overflow-hidden">
              <SpriteLayerCanvas 
                sprites={sprites || []}
                config={localConfig as CharacterConfig}
                size="xl"
              />
            </div>
            
            {/* Gender Toggle */}
            <div className="flex gap-2 w-full">
              <Button
                variant={selectedGender === 'male' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => handleGenderChange('male')}
              >
                Male
              </Button>
              <Button
                variant={selectedGender === 'female' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => handleGenderChange('female')}
              >
                Female
              </Button>
            </div>

            {/* Skin Tone */}
            <SkinTonePicker
              selectedTone={localConfig.selected_skin_tone || 'medium'}
              onSelect={handleSkinToneChange}
            />
          </CardContent>
        </Card>

        {/* Customization Panel */}
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="body" className="gap-1.5">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Body</span>
                </TabsTrigger>
                <TabsTrigger value="face" className="gap-1.5">
                  <span className="text-lg">👀</span>
                  <span className="hidden sm:inline">Face</span>
                </TabsTrigger>
                <TabsTrigger value="clothes" className="gap-1.5">
                  <Shirt className="h-4 w-4" />
                  <span className="hidden sm:inline">Clothes</span>
                </TabsTrigger>
                <TabsTrigger value="accessories" className="gap-1.5">
                  <Glasses className="h-4 w-4" />
                  <span className="hidden sm:inline">Extras</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="body" className="space-y-4">
                <SpriteCategoryPicker
                  category="body"
                  sprites={getSpritesByCategory('body', selectedGender)}
                  selectedSpriteId={localConfig.body_sprite_id || null}
                  onSelect={(id) => handleSpriteSelect('body', id)}
                  allowNone={false}
                />
                <SpriteCategoryPicker
                  category="hair"
                  sprites={getSpritesByCategory('hair', selectedGender)}
                  selectedSpriteId={localConfig.hair_sprite_id || null}
                  onSelect={(id) => handleSpriteSelect('hair', id)}
                  noneLabel="Bald"
                />
              </TabsContent>

              <TabsContent value="face" className="space-y-4">
                <SpriteCategoryPicker
                  category="eyes"
                  sprites={getSpritesByCategory('eyes')}
                  selectedSpriteId={localConfig.eyes_sprite_id || null}
                  onSelect={(id) => handleSpriteSelect('eyes', id)}
                />
                <SpriteCategoryPicker
                  category="nose"
                  sprites={getSpritesByCategory('nose')}
                  selectedSpriteId={localConfig.nose_sprite_id || null}
                  onSelect={(id) => handleSpriteSelect('nose', id)}
                />
                <SpriteCategoryPicker
                  category="mouth"
                  sprites={getSpritesByCategory('mouth')}
                  selectedSpriteId={localConfig.mouth_sprite_id || null}
                  onSelect={(id) => handleSpriteSelect('mouth', id)}
                />
                {selectedGender === 'male' && (
                  <SpriteCategoryPicker
                    category="facial_hair"
                    sprites={getSpritesByCategory('facial_hair', 'male')}
                    selectedSpriteId={localConfig.facial_hair_sprite_id || null}
                    onSelect={(id) => handleSpriteSelect('facial_hair', id)}
                    noneLabel="Clean shaven"
                  />
                )}
              </TabsContent>

              <TabsContent value="clothes" className="space-y-4">
                <SpriteCategoryPicker
                  category="shirt"
                  sprites={getSpritesByCategory('shirt')}
                  selectedSpriteId={localConfig.shirt_sprite_id || null}
                  onSelect={(id) => handleSpriteSelect('shirt', id)}
                />
                <SpriteCategoryPicker
                  category="jacket"
                  sprites={getSpritesByCategory('jacket')}
                  selectedSpriteId={localConfig.jacket_sprite_id || null}
                  onSelect={(id) => handleSpriteSelect('jacket', id)}
                />
                <SpriteCategoryPicker
                  category="trousers"
                  sprites={getSpritesByCategory('trousers')}
                  selectedSpriteId={localConfig.trousers_sprite_id || null}
                  onSelect={(id) => handleSpriteSelect('trousers', id)}
                />
                <SpriteCategoryPicker
                  category="shoes"
                  sprites={getSpritesByCategory('shoes')}
                  selectedSpriteId={localConfig.shoes_sprite_id || null}
                  onSelect={(id) => handleSpriteSelect('shoes', id)}
                />
              </TabsContent>

              <TabsContent value="accessories" className="space-y-4">
                <SpriteCategoryPicker
                  category="hat"
                  sprites={getSpritesByCategory('hat')}
                  selectedSpriteId={localConfig.hat_sprite_id || null}
                  onSelect={(id) => handleSpriteSelect('hat', id)}
                />
                <SpriteCategoryPicker
                  category="glasses"
                  sprites={getSpritesByCategory('glasses')}
                  selectedSpriteId={localConfig.glasses_sprite_id || null}
                  onSelect={(id) => handleSpriteSelect('glasses', id)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PunkCharacterCreator;
