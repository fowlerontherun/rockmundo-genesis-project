import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const SPRITE_TYPES = [
  { value: 'crowd', label: 'Crowd Member', description: 'A person in the audience' },
  { value: 'vocalist', label: 'Vocalist', description: 'Singer with microphone' },
  { value: 'lead-guitar', label: 'Lead Guitarist', description: 'Lead guitar player' },
  { value: 'rhythm-guitar', label: 'Rhythm Guitarist', description: 'Rhythm guitar player' },
  { value: 'bass', label: 'Bassist', description: 'Bass guitar player' },
  { value: 'drummer', label: 'Drummer', description: 'Drummer behind kit' },
];

export default function SpriteManager() {
  const [spriteType, setSpriteType] = useState<string>('crowd');
  const [characterDescription, setCharacterDescription] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!characterDescription) {
      toast({
        title: "Description required",
        description: "Please describe the character you want to generate",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-sprite', {
        body: { spriteType, characterDescription }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast({
          title: "Sprite generated!",
          description: "Your sprite has been generated successfully",
        });
      }
    } catch (error: any) {
      console.error('Error generating sprite:', error);
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate sprite",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Sprite Generator</h1>
        <p className="text-muted-foreground">
          Generate pixel-art sprites for the 3D gig viewer using AI
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sprite-type">Sprite Type</Label>
            <Select value={spriteType} onValueChange={setSpriteType}>
              <SelectTrigger id="sprite-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPRITE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {SPRITE_TYPES.find(t => t.value === spriteType)?.description}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Character Description</Label>
            <Input
              id="description"
              placeholder="e.g., tall person with red t-shirt jumping"
              value={characterDescription}
              onChange={(e) => setCharacterDescription(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Describe the character's appearance, clothing, pose, etc.
            </p>
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? "Generating..." : "Generate Sprite"}
          </Button>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Preview</h3>
          {generatedImage ? (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden bg-checkered">
                <img 
                  src={generatedImage} 
                  alt="Generated sprite"
                  className="w-full h-auto"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                ✅ Sprite generated with green background for chroma-keying
              </p>
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-lg p-12 text-center text-muted-foreground">
              <p>Generated sprite will appear here</p>
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-semibold mb-2">How it works</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Select the type of sprite you want to generate (crowd member or band member)</li>
          <li>Describe the character's appearance, clothing, pose, and other details</li>
          <li>AI generates a pixel-art sprite on a bright green (#00FF00) background</li>
          <li>The green background is automatically removed using shader-based chroma-keying</li>
          <li>Sprites are viewed from behind for concert perspective</li>
        </ul>
      </Card>
    </div>
  );
}
