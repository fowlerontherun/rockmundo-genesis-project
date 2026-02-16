import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export const useMerchImageGenerator = (bandId: string | null) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async ({
      merchId,
      itemType,
      designName,
      bandName,
      qualityTier,
    }: {
      merchId: string;
      itemType: string;
      designName: string;
      bandName: string;
      qualityTier?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("generate-merch-image", {
        body: { merchId, itemType, designName, bandName, qualityTier: qualityTier || "basic" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { imageUrl: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["player-merchandise", bandId] });
      toast({ title: "Image generated!", description: "Your merch product now has an AI-generated preview." });
    },
    onError: (err: any) => {
      const message = err?.message || "Failed to generate image";
      if (message.includes("busy") || message.includes("429")) {
        toast({ title: "AI service busy", description: "Please try again in a moment.", variant: "destructive" });
      } else if (message.includes("credits") || message.includes("402")) {
        toast({ title: "AI credits exhausted", description: "Top up your Lovable AI credits.", variant: "destructive" });
      } else {
        toast({ title: "Image generation failed", description: message, variant: "destructive" });
      }
    },
  });

  const generateAllMutation = useMutation({
    mutationFn: async (items: { merchId: string; itemType: string; designName: string; bandName: string; qualityTier?: string }[]) => {
      const results: { merchId: string; success: boolean }[] = [];
      for (const item of items) {
        try {
          await generateMutation.mutateAsync(item);
          results.push({ merchId: item.merchId, success: true });
        } catch {
          results.push({ merchId: item.merchId, success: false });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const success = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;
      toast({
        title: "Batch generation complete",
        description: `${success} generated, ${failed} failed.`,
      });
    },
  });

  return {
    generateImage: generateMutation.mutate,
    generateImageAsync: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,
    generatingId: generateMutation.variables?.merchId,
    generateAllMissing: generateAllMutation.mutate,
    isGeneratingAll: generateAllMutation.isPending,
  };
};
