import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RotateCcw, User, Shirt, Glasses, Sparkles, Download, Check } from "lucide-react";
import { SvgSpriteCanvas } from "./SvgSpriteCanvas";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

// Available options for each category - MASSIVELY EXPANDED
const OPTIONS = {
  hair: [
    // Punk
    { id: 'hair-mohawk', name: 'Mohawk', color: '#e63946', genre: 'Punk' },
    { id: 'hair-libertyspikes', name: 'Liberty Spikes', color: '#22c55e', genre: 'Punk' },
    // Rock
    { id: 'hair-longrocker', name: 'Long Rocker', color: '#1a1a1a', genre: 'Metal' },
    { id: 'hair-mullet', name: 'Mullet', color: '#6b4423', genre: 'Classic Rock' },
    { id: 'hair-shaggy', name: 'Shaggy', color: '#b8956e', genre: 'Grunge' },
    // Modern
    { id: 'hair-pompadour', name: 'Pompadour', color: '#1a1a1a', genre: 'Rockabilly' },
    { id: 'hair-undercut', name: 'Undercut', color: '#d4a76a', genre: 'Modern' },
    { id: 'hair-buzzcut', name: 'Buzz Cut', color: '#2a2a2a', genre: 'Military' },
    { id: 'hair-slickedback', name: 'Slicked Back', color: '#1a1a1a', genre: 'Disco' },
    // Hip-Hop
    { id: 'hair-afro', name: 'Afro', color: '#2d1810', genre: 'Funk' },
    { id: 'hair-braids', name: 'Braids', color: '#1a1a1a', genre: 'Hip-Hop' },
    { id: 'hair-cornrows', name: 'Cornrows', color: '#1a1a1a', genre: 'Hip-Hop' },
    { id: 'hair-dreadlocks', name: 'Dreadlocks', color: '#4a3520', genre: 'Reggae' },
    // Other
    { id: 'hair-emo', name: 'Emo Fringe', color: '#1a1a1a', genre: 'Emo' },
    { id: 'hair-pixie', name: 'Pixie', color: '#f5a623', genre: 'Pop' },
    { id: 'hair-pigtails', name: 'Pigtails', color: '#ec4899', genre: 'Pop' },
    { id: 'hair-messybob', name: 'Messy Bob', color: '#9a5d42', genre: 'Indie' },
    { id: 'hair-curtains', name: 'Curtains', color: '#6b4423', genre: 'Britpop' },
    { id: 'hair-viking', name: 'Viking', color: '#c45a28', genre: 'Folk Metal' },
    { id: 'hair-bun', name: 'Bun', color: '#5a4030', genre: 'Various' },
  ],
  eyes: [
    { id: 'eyes-neutral', name: 'Neutral', color: '#4a3728' },
    { id: 'eyes-angry', name: 'Angry', color: '#4a3728' },
    { id: 'eyes-intense', name: 'Intense', color: '#4a3728' },
    { id: 'eyes-wide', name: 'Wide', color: '#4a3728' },
    { id: 'eyes-sleepy', name: 'Sleepy', color: '#4a3728' },
    { id: 'eyes-winking', name: 'Winking', color: '#4a3728' },
    { id: 'eyes-cat', name: 'Cat Eye', color: '#22c55e' },
    { id: 'eyes-smoky', name: 'Smoky', color: '#1a1a1a' },
    { id: 'eyes-starry', name: 'Starry', color: '#60a5fa' },
  ],
  nose: [
    { id: 'nose-small', name: 'Small', color: '#e5c0a0' },
  ],
  mouth: [
    { id: 'mouth-neutral', name: 'Neutral', color: '#b8756b' },
    { id: 'mouth-smile', name: 'Smile', color: '#b8756b' },
    { id: 'mouth-singing', name: 'Singing', color: '#8b4040' },
    { id: 'mouth-smirk', name: 'Smirk', color: '#b8756b' },
    { id: 'mouth-pout', name: 'Pout', color: '#c86b6b' },
    { id: 'mouth-grin', name: 'Grin', color: '#b8756b' },
    { id: 'mouth-shouting', name: 'Shouting', color: '#7a3030' },
    { id: 'mouth-kiss', name: 'Kiss', color: '#c86b6b' },
  ],
  facial_hair: [
    { id: 'beard', name: 'Full Beard', color: '#3d2820' },
    { id: 'facialhair-goatee', name: 'Goatee', color: '#3d2820' },
    { id: 'facialhair-stubble', name: 'Stubble', color: '#3d2820' },
    { id: 'facialhair-handlebar', name: 'Handlebar', color: '#3d2820' },
    { id: 'facialhair-soulpatch', name: 'Soul Patch', color: '#3d2820' },
    { id: 'facialhair-muttonchops', name: 'Mutton Chops', color: '#3d2820' },
  ],
  shirt: [
    { id: 'shirt-bandtee', name: 'Band Tee', color: '#1a1a1a', genre: 'Rock' },
    { id: 'shirt-flannel', name: 'Flannel', color: '#b91c1c', genre: 'Grunge' },
    { id: 'shirt-hawaiian', name: 'Hawaiian', color: '#0d9488', genre: 'Indie' },
    { id: 'shirt-rippedtee', name: 'Ripped Tee', color: '#f5f5f5', genre: 'Punk' },
    { id: 'shirt-polo', name: 'Polo', color: '#2563eb', genre: 'Mod' },
    { id: 'shirt-croptop', name: 'Crop Top', color: '#ec4899', genre: 'Pop' },
    { id: 'shirt-tanktop', name: 'Tank Top', color: '#1a1a1a', genre: 'Metal' },
    { id: 'shirt-turtleneck', name: 'Turtleneck', color: '#1a1a1a', genre: 'Goth' },
    { id: 'shirt-jersey', name: 'Jersey', color: '#dc2626', genre: 'Hip-Hop' },
    { id: 'shirt-tiedye', name: 'Tie-Dye', color: '#fbbf24', genre: 'Psychedelic' },
    { id: 'shirt-blazer', name: 'Blazer Shirt', color: '#1e3a5f', genre: 'Britpop' },
    { id: 'shirt-mesh', name: 'Mesh Top', color: '#1a1a1a', genre: 'Rave' },
  ],
  jacket: [
    { id: 'jacket-leather', name: 'Leather', color: '#2a2a2a', genre: 'Punk/Metal' },
    { id: 'jacket-hoodie', name: 'Hoodie', color: '#555', genre: 'Casual' },
    { id: 'jacket-denimvest', name: 'Denim Vest', color: '#3b82f6', genre: 'Country' },
    { id: 'jacket-varsity', name: 'Varsity', color: '#dc2626', genre: 'Americana' },
    { id: 'jacket-military', name: 'Military', color: '#4d5a3a', genre: 'Industrial' },
    { id: 'jacket-trench', name: 'Trench Coat', color: '#1a1a1a', genre: 'Goth' },
    { id: 'jacket-track', name: 'Track Jacket', color: '#dc2626', genre: 'Hip-Hop' },
    { id: 'jacket-cardigan', name: 'Cardigan', color: '#d4a574', genre: 'Indie' },
  ],
  trousers: [
    { id: 'trousers-skinny', name: 'Skinny Jeans', color: '#1a1a2e', genre: 'Rock' },
    { id: 'trousers-cargo', name: 'Cargo Shorts', color: '#5a5a3a', genre: 'Skate' },
    { id: 'trousers-ripped', name: 'Ripped Jeans', color: '#3b82f6', genre: 'Punk' },
    { id: 'trousers-leather', name: 'Leather Pants', color: '#1a1a1a', genre: 'Metal' },
    { id: 'trousers-track', name: 'Track Pants', color: '#1a1a1a', genre: 'Hip-Hop' },
    { id: 'trousers-pleatedskirt', name: 'Pleated Skirt', color: '#1a1a1a', genre: 'Goth' },
    { id: 'trousers-kilt', name: 'Kilt', color: '#1a5f1a', genre: 'Celtic' },
    { id: 'trousers-bellbottoms', name: 'Bell Bottoms', color: '#3b82f6', genre: 'Disco' },
  ],
  shoes: [
    { id: 'shoes-combat', name: 'Combat Boots', color: '#111', genre: 'Punk' },
    { id: 'shoes-hightops', name: 'High Tops', color: '#e63946', genre: 'Skate' },
    { id: 'shoes-cowboy', name: 'Cowboy Boots', color: '#8b4513', genre: 'Country' },
    { id: 'shoes-platform', name: 'Platform Boots', color: '#1a1a1a', genre: 'Goth' },
    { id: 'shoes-sandals', name: 'Sandals', color: '#8b6040', genre: 'Hippie' },
    { id: 'shoes-dress', name: 'Dress Shoes', color: '#1a1a1a', genre: 'Mod' },
    { id: 'shoes-sneakers', name: 'Sneakers', color: '#f5f5f5', genre: 'Hip-Hop' },
    { id: 'shoes-creepers', name: 'Creepers', color: '#1a1a1a', genre: 'Rockabilly' },
  ],
  hat: [
    { id: 'hat-beanie', name: 'Beanie', color: '#1a1a1a', genre: 'Various' },
    { id: 'hat-fedora', name: 'Fedora', color: '#2a2a2a', genre: 'Ska/Jazz' },
    { id: 'hat-cowboy', name: 'Cowboy Hat', color: '#8b6040', genre: 'Country' },
    { id: 'hat-bandana', name: 'Bandana', color: '#dc2626', genre: 'Biker' },
    { id: 'hat-tophat', name: 'Top Hat', color: '#1a1a1a', genre: 'Steampunk' },
    { id: 'hat-snapback', name: 'Snapback', color: '#1a1a1a', genre: 'Hip-Hop' },
    { id: 'hat-beret', name: 'Beret', color: '#1a1a1a', genre: 'Beatnik' },
    { id: 'hat-bucket', name: 'Bucket Hat', color: '#5a5a3a', genre: '90s' },
  ],
  glasses: [
    { id: 'glasses-aviator', name: 'Aviators', color: '#c9a227', genre: 'Classic' },
    { id: 'glasses-lennon', name: 'Round Lennons', color: '#c9a227', genre: '60s' },
    { id: 'glasses-cateye', name: 'Cat Eye', color: '#1a1a1a', genre: 'Vintage' },
    { id: 'glasses-sportwrap', name: 'Sport Wrap', color: '#1a1a1a', genre: '80s' },
    { id: 'glasses-tinyovals', name: 'Tiny Ovals', color: '#c9a227', genre: 'Y2K' },
    { id: 'glasses-neonshutter', name: 'Neon Shutter', color: '#22c55e', genre: 'Rave' },
  ],
  extra: [
    { id: 'extra-hoopearrings', name: 'Hoop Earrings', color: '#c9a227', genre: 'Various' },
    { id: 'extra-studearrings', name: 'Stud Earrings', color: '#c9a227', genre: 'Punk' },
    { id: 'extra-nosering', name: 'Nose Ring', color: '#c9a227', genre: 'Punk' },
    { id: 'extra-lipring', name: 'Lip Ring', color: '#c9a227', genre: 'Emo' },
    { id: 'extra-chain', name: 'Chain Necklace', color: '#c9a227', genre: 'Metal' },
    { id: 'extra-choker', name: 'Choker', color: '#1a1a1a', genre: 'Goth' },
    { id: 'extra-bandannaneck', name: 'Bandanna', color: '#1a1a1a', genre: 'Biker' },
    { id: 'extra-headphones', name: 'Headphones', color: '#1a1a1a', genre: 'DJ' },
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
  extra?: string;
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
  options: Array<{ id: string; name: string; color: string; genre?: string }>;
  selected?: string;
  onSelect: (id: string | undefined) => void;
  allowNone?: boolean;
  noneLabel?: string;
}

const OptionPicker = ({ label, options, selected, onSelect, allowNone = true, noneLabel = "None" }: OptionPickerProps) => (
  <div className="space-y-2">
    <Label className="text-sm font-medium capitalize">{label} <span className="text-muted-foreground">({options.length})</span></Label>
    <ScrollArea className="h-[120px]">
      <div className="flex flex-wrap gap-2 pr-3">
        {allowNone && (
          <button
            onClick={() => onSelect(undefined)}
            className={cn(
              "w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
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
              "w-10 h-10 rounded-lg border-2 transition-all relative shrink-0 group",
              selected === opt.id ? "border-primary ring-2 ring-primary/30" : "border-muted hover:border-muted-foreground/50"
            )}
            style={{ backgroundColor: opt.color }}
            title={`${opt.name}${opt.genre ? ` (${opt.genre})` : ''}`}
          >
            {selected === opt.id && (
              <Check className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow-md" />
            )}
          </button>
        ))}
      </div>
    </ScrollArea>
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
      const svgElements = canvasRef.current.querySelectorAll('svg');
      if (svgElements.length === 0) {
        toast.error('No character to export');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, 512, 1024);

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
      
      images.sort((a, b) => a.zIndex - b.zIndex);
      images.forEach(({ img }) => {
        ctx.drawImage(img, 0, 0, 512, 1024);
      });

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
            Design your unique punk rock character • 100+ options
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
                <OptionPicker
                  label="Piercings & Jewelry"
                  options={OPTIONS.extra}
                  selected={config.extra}
                  onSelect={(id) => updateConfig('extra', id)}
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
