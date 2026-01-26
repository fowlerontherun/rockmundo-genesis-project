import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Image, Sparkles } from 'lucide-react';
import { usePOVClipGenerator } from '@/hooks/usePOVClipGenerator';
import { 
  ClipVariantId, 
  clipVariants, 
  GUITAR_SKIN_IDS, 
  BASS_SKIN_IDS, 
  SLEEVE_STYLE_IDS 
} from './pov-scenes/clipVariants';

// POV Clip Preview & Generator Component
// Allows generating and previewing AI-generated POV concert frames

export const POVClipPreview = () => {
  const [selectedVariant, setSelectedVariant] = useState<ClipVariantId>('G1');
  const [selectedSkin, setSelectedSkin] = useState<string>('');
  const [selectedSleeve, setSelectedSleeve] = useState<string>('leather');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  const { generateClip, isGenerating, error } = usePOVClipGenerator();

  const handleGenerate = async () => {
    const result = await generateClip({
      clipVariant: selectedVariant,
      instrumentSkin: selectedSkin || undefined,
      sleeveStyle: selectedSleeve,
    });
    
    if (result) {
      setGeneratedImage(result.imageUrl);
    }
  };

  const variantInfo = clipVariants[selectedVariant];
  const isGuitarVariant = ['G1', 'G2', 'H1'].includes(selectedVariant);
  const isBassVariant = selectedVariant === 'B1';

  return (
    <Card className="bg-card/80 backdrop-blur border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Image className="h-5 w-5 text-primary" />
          POV Clip Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Variant selector */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Clip Variant</label>
          <Select value={selectedVariant} onValueChange={(v) => setSelectedVariant(v as ClipVariantId)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(clipVariants).map(([id, variant]) => (
                <SelectItem key={id} value={id}>
                  {variant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{variantInfo.description.slice(0, 100)}...</p>
        </div>

        {/* Instrument skin selector (for guitar/bass variants) */}
        {(isGuitarVariant || isBassVariant) && (
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Instrument Skin</label>
            <Select value={selectedSkin} onValueChange={setSelectedSkin}>
              <SelectTrigger>
                <SelectValue placeholder="Default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Default</SelectItem>
                {(isGuitarVariant ? GUITAR_SKIN_IDS : BASS_SKIN_IDS).map((skin) => (
                  <SelectItem key={skin} value={skin}>
                    {skin.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Sleeve style selector */}
        {['G1', 'G2', 'B1', 'V1', 'H1'].includes(selectedVariant) && (
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Sleeve Style</label>
            <Select value={selectedSleeve} onValueChange={setSelectedSleeve}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLEEVE_STYLE_IDS.map((style) => (
                  <SelectItem key={style} value={style}>
                    {style.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Generate button */}
        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate POV Frame
            </>
          )}
        </Button>

        {/* Error display */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Generated image preview */}
        {generatedImage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-lg overflow-hidden border border-border"
          >
            <img 
              src={generatedImage} 
              alt={`POV ${selectedVariant}`}
              className="w-full h-auto"
              style={{
                filter: 'contrast(1.3) saturate(0.7) brightness(1.1)',
              }}
            />
            
            {/* MTV2/Kerrang post-processing overlay */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%)',
              }}
            />
            
            {/* Film grain overlay */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                mixBlendMode: 'overlay',
              }}
            />
            
            {/* Variant label */}
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs font-mono text-white/80">
              {selectedVariant} • {variantInfo.name}
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};
