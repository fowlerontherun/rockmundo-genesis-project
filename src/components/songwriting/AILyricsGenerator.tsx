import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Theme {
  name?: string;
  mood?: string;
  description?: string;
}

interface ChordProgression {
  name?: string;
  progression?: string;
}

interface CreativeBrief {
  inspirationModifiers?: string[];
  moodModifiers?: string[];
  writingMode?: string;
  coWriters?: string[];
}

interface AILyricsGeneratorProps {
  title: string;
  theme: string | Theme;
  genre: string;
  chordProgression: string | ChordProgression;
  creativeBrief?: CreativeBrief;
  existingLyrics?: string;
  onLyricsGenerated: (lyrics: string) => void;
}

export const AILyricsGenerator = ({
  title,
  theme,
  genre,
  chordProgression,
  creativeBrief,
  existingLyrics,
  onLyricsGenerated
}: AILyricsGeneratorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!title || !genre) {
      toast({
        title: "Missing Information",
        description: "Please set a title and genre before generating lyrics",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-song-lyrics", {
        body: {
          title,
          theme,
          genre,
          chordProgression,
          creativeBrief,
          existingLyrics
        }
      });

      if (error) throw error;

      if (data?.lyrics) {
        onLyricsGenerated(data.lyrics);
        
        // Show metadata about the generated lyrics if available
        const metadata = data.metadata;
        const description = metadata 
          ? `${metadata.structure} structure with ${metadata.tone} tone`
          : "AI-assisted lyrics ready for editing";
        
        toast({
          title: "Lyrics Generated!",
          description
        });
      }
    } catch (error) {
      console.error("Error generating lyrics:", error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate lyrics",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription className="text-xs">
          ⚠️ Using AI-generated lyrics will apply a -10% XP penalty. You can edit the generated lyrics before completing your song.
        </AlertDescription>
      </Alert>
      
      <Button
        onClick={handleGenerate}
        disabled={isGenerating || !title || !genre}
        className="w-full"
        variant="outline"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating Unique Lyrics...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Auto-Generate Lyrics
          </>
        )}
      </Button>
    </div>
  );
};
