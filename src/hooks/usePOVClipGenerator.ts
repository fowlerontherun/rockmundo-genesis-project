import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ClipVariantId } from '@/components/gig-viewer/pov-scenes/clipVariants';

interface GeneratedClip {
  clipVariant: ClipVariantId;
  imageUrl: string;
  description: string;
  prompt: string;
  generatedAt: Date;
}

interface UsePOVClipGeneratorReturn {
  generateClip: (params: {
    clipVariant: ClipVariantId;
    instrumentSkin?: string;
    sleeveStyle?: string;
    customPrompt?: string;
  }) => Promise<GeneratedClip | null>;
  isGenerating: boolean;
  error: string | null;
  generatedClips: Map<string, GeneratedClip>;
  clearCache: () => void;
}

export const usePOVClipGenerator = (): UsePOVClipGeneratorReturn => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedClips, setGeneratedClips] = useState<Map<string, GeneratedClip>>(new Map());

  const generateClip = useCallback(async ({
    clipVariant,
    instrumentSkin,
    sleeveStyle,
    customPrompt,
  }: {
    clipVariant: ClipVariantId;
    instrumentSkin?: string;
    sleeveStyle?: string;
    customPrompt?: string;
  }): Promise<GeneratedClip | null> => {
    // Create cache key
    const cacheKey = `${clipVariant}-${instrumentSkin || 'default'}-${sleeveStyle || 'default'}`;
    
    // Check cache first
    const cached = generatedClips.get(cacheKey);
    if (cached && !customPrompt) {
      return cached;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-pov-clip', {
        body: {
          clipVariant,
          instrumentSkin,
          sleeveStyle,
          customPrompt,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to generate clip');
      }

      const generatedClip: GeneratedClip = {
        clipVariant: data.clipVariant,
        imageUrl: data.imageUrl,
        description: data.description,
        prompt: data.prompt,
        generatedAt: new Date(),
      };

      // Cache the result
      if (!customPrompt) {
        setGeneratedClips(prev => new Map(prev).set(cacheKey, generatedClip));
      }

      return generatedClip;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('POV clip generation error:', err);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [generatedClips]);

  const clearCache = useCallback(() => {
    setGeneratedClips(new Map());
  }, []);

  return {
    generateClip,
    isGenerating,
    error,
    generatedClips,
    clearCache,
  };
};
