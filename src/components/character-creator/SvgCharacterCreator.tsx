import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotateCcw, User, Shirt, Glasses, Sparkles, Download, Check } from "lucide-react";
import { SvgSpriteCanvas } from "./SvgSpriteCanvas";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Available options for each category
const OPTIONS = {
  hair: [
    { id: 'hair-mohawk', name: 'Mohawk', color: '#e63946' },
    { id: 'hair-afro', name: 'Afro', color: '#2d1810' },
    { id: 'hair-emo', name: 'Emo', color: '#1a1a1a' },
    { id: 'hair-pixie', name: 'Pixie', color: '#f5a623' },
  ],
  eyes: [
    { id: 'eyes-neutral', name: 'Neutral', color: '#4a3728' },
    { id: 'eyes-angry', name: 'Intense', color: '#4a3728' },
  ],
  nose: [
    { id: 'nose-small', name: 'Small', color: '#e5c0a0' },
  ],
  mouth: [
    { id: 'mouth-neutral', name: 'Neutral', color: '#b8756b' },
    { id: 'mouth-smile', name: 'Smile', color: '#b8756b' },
  ],
  facial_hair: [
    { id: 'beard', name: 'Full Beard', color: '#3d2820' },
  ],
  shirt: [
    { id: 'shirt-bandtee', name: 'Band Tee', color: '#1a1a1a' },
  ],
  jacket: [
    { id: 'jacket-leather', name: 'Leather', color: '#2a2a2a' },
    { id: 'jacket-hoodie', name: 'Hoodie', color: '#555' },
  ],
  trousers: [
    { id: 'trousers-skinny', name: 'Skinny Jeans', color: '#1a1a2e' },
    { id: 'trousers-cargo', name: 'Cargo Shorts', color: '#5a5a3a' },
  ],
  shoes: [
    { id: 'shoes-combat', name: 'Combat Boots', color: '#111' },
    { id: 'shoes-hightops', name: 'High Tops', color: '#e63946' },
  ],
  hat: [
    { id: 'hat-beanie', name: 'Beanie', color: '#1a1a1a' },
  ],
  glasses: [
    { id: 'glasses-aviator', name: 'Aviators', color: '#c9a227' },
  ],
};

const SKIN_TONES = [
  { id: 'very_light', name: 'Very Light', color: '#ffe0c0' },
  { id: 'light', name: 'Light', color: '#f5d0b0' },
  { id: 'medium', name: 'Medium', color: '#d4a574' },
  { id: 'tan', name: 'Tan', color: '#c68c5a' },
  { id: 'brown', name: 'Brown', color: '#8b6040' },
  { id: 'dark', name: 'Dark', color: '#5a4030' },
];

interface CharacterConfigState {
  gender: 'male' | 'female';
  hair?: string;
  eyes?: string;
  nose?: string;
  mouth?: string;
  facial_hair?: string;
  shirt?: string;
  jacket?: string;
  trousers?: string;
  shoes?: string;
  hat?: string;
  glasses?: string;
  skinTone: string;
}

const DEFAULT_CONFIG: CharacterConfigState = {
  gender: 'male',
  hair: 'hair-mohawk',
  eyes: 'eyes-neutral',
  nose: 'nose-small',
  mouth: 'mouth-neutral',
  shirt: 'shirt-bandtee',
  jacket: 'jacket-leather',
  trousers: 'trousers-skinny',
  shoes: 'shoes-combat',
  skinTone: 'light',
};

interface OptionPickerProps {
  label: string;
  options: Array<{ id: string; name: string; color: string }>;
  selected?: string;
  onSelect: (id: string | undefined) => void;
  allowNone?: boolean;
  noneLabel?: string;
}

const OptionPicker = ({ label, options, selected, onSelect, allowNone = true, noneLabel = "None" }: OptionPickerProps) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium capitalize">{label}</Label>
    <div className="flex flex-wrap gap-2">
      {allowNone && (
        <button
          onClick={() => onSelect(undefined)}
          className={cn(
            "w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all",
            !selected ? "border-primary ring-2 ring-primary/30" : "border-muted hover:border-muted-foreground/50"
          )}
          title={noneLabel}
        >
          <span className="text-xs text-muted-foreground">∅</span>
        </button>
      )}
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className={cn(
            "w-10 h-10 rounded-lg border-2 transition-all relative",
            selected === opt.id ? "border-primary ring-2 ring-primary/30" : "border-muted hover:border-muted-foreground/50"
          )}
          style={{ backgroundColor: opt.color }}
          title={opt.name}
        >
          {selected === opt.id && (
            <Check className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow-md" />
          )}
        </button>
      ))}
    </div>
  </div>
);

export const SvgCharacterCreator = () => {
  const [config, setConfig] = useState<CharacterConfigState>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState('body');
  const canvasRef = useRef<HTMLDivElement>(null);

  const updateConfig = <K extends keyof CharacterConfigState>(key: K, value: CharacterConfigState[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setConfig({ ...DEFAULT_CONFIG, gender: config.gender });
    toast.info('Character reset to defaults');
  };

  const handleGenderChange = (gender: 'male' | 'female') => {
    setConfig(prev => ({
      ...prev,
      gender,
      facial_hair: gender === 'female' ? undefined : prev.facial_hair,
    }));
  };

  const handleExportPng = async () => {
    if (!canvasRef.current) return;
    
    try {
      // For SVG export, we need to serialize the SVG content
      const svgElements = canvasRef.current.querySelectorAll('svg');
      if (svgElements.length === 0) {
        toast.error('No character to export');
        return;
      }

      // Create a canvas to draw the composite
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill with transparent
      ctx.clearRect(0, 0, 512, 1024);

      // For each SVG, convert to image and draw
      const loadPromises = Array.from(svgElements).map((svg, index) => {
        return new Promise<{ img: HTMLImageElement; zIndex: number }>((resolve, reject) => {
          const svgData = new XMLSerializer().serializeToString(svg);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            const parent = svg.parentElement;
            const zIndex = parent?.style.zIndex ? parseInt(parent.style.zIndex) : index;
            resolve({ img, zIndex });
          };
          img.onerror = reject;
          img.src = url;
        });
      });

      const images = await Promise.all(loadPromises);
      
      // Sort by z-index and draw
      images.sort((a, b) => a.zIndex - b.zIndex);
      images.forEach(({ img }) => {
        ctx.drawImage(img, 0, 0, 512, 1024);
      });

      // Download
      const link = document.createElement('a');
      link.download = 'punk-character.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast.success('Character exported as PNG!');
    } catch (err) {
      toast.error('Failed to export PNG');
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
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
          <Button variant="outline" size="sm" onClick={handleExportPng}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
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
            <div 
              ref={canvasRef}
              className="w-full aspect-[1/2] bg-gradient-to-b from-muted/20 to-muted/40 rounded-lg flex items-center justify-center overflow-hidden relative"
            >
              <SvgSpriteCanvas 
                config={config}
                size="xl"
              />
            </div>
            
            {/* Gender Toggle */}
            <div className="flex gap-2 w-full">
              <Button
                variant={config.gender === 'male' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => handleGenderChange('male')}
              >
                Male
              </Button>
              <Button
                variant={config.gender === 'female' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => handleGenderChange('female')}
              >
                Female
              </Button>
            </div>

            {/* Skin Tone */}
            <div className="w-full space-y-2">
              <Label className="text-sm font-medium">Skin Tone</Label>
              <div className="flex gap-1.5">
                {SKIN_TONES.map((tone) => (
                  <button
                    key={tone.id}
                    onClick={() => updateConfig('skinTone', tone.id)}
                    className={cn(
                      "flex-1 h-8 rounded-md border-2 transition-all",
                      config.skinTone === tone.id ? "border-primary ring-2 ring-primary/30" : "border-transparent"
                    )}
                    style={{ backgroundColor: tone.color }}
                    title={tone.name}
                  />
                ))}
              </div>
            </div>
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
                <OptionPicker
                  label="Hair Style"
                  options={OPTIONS.hair}
                  selected={config.hair}
                  onSelect={(id) => updateConfig('hair', id)}
                  noneLabel="Bald"
                />
              </TabsContent>

              <TabsContent value="face" className="space-y-4">
                <OptionPicker
                  label="Eyes"
                  options={OPTIONS.eyes}
                  selected={config.eyes}
                  onSelect={(id) => updateConfig('eyes', id)}
                  allowNone={false}
                />
                <OptionPicker
                  label="Nose"
                  options={OPTIONS.nose}
                  selected={config.nose}
                  onSelect={(id) => updateConfig('nose', id)}
                  allowNone={false}
                />
                <OptionPicker
                  label="Mouth"
                  options={OPTIONS.mouth}
                  selected={config.mouth}
                  onSelect={(id) => updateConfig('mouth', id)}
                  allowNone={false}
                />
                {config.gender === 'male' && (
                  <OptionPicker
                    label="Facial Hair"
                    options={OPTIONS.facial_hair}
                    selected={config.facial_hair}
                    onSelect={(id) => updateConfig('facial_hair', id)}
                    noneLabel="Clean shaven"
                  />
                )}
              </TabsContent>

              <TabsContent value="clothes" className="space-y-4">
                <OptionPicker
                  label="Shirt"
                  options={OPTIONS.shirt}
                  selected={config.shirt}
                  onSelect={(id) => updateConfig('shirt', id)}
                />
                <OptionPicker
                  label="Jacket"
                  options={OPTIONS.jacket}
                  selected={config.jacket}
                  onSelect={(id) => updateConfig('jacket', id)}
                />
                <OptionPicker
                  label="Bottoms"
                  options={OPTIONS.trousers}
                  selected={config.trousers}
                  onSelect={(id) => updateConfig('trousers', id)}
                />
                <OptionPicker
                  label="Footwear"
                  options={OPTIONS.shoes}
                  selected={config.shoes}
                  onSelect={(id) => updateConfig('shoes', id)}
                />
              </TabsContent>

              <TabsContent value="accessories" className="space-y-4">
                <OptionPicker
                  label="Hat"
                  options={OPTIONS.hat}
                  selected={config.hat}
                  onSelect={(id) => updateConfig('hat', id)}
                />
                <OptionPicker
                  label="Glasses"
                  options={OPTIONS.glasses}
                  selected={config.glasses}
                  onSelect={(id) => updateConfig('glasses', id)}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SvgCharacterCreator;
