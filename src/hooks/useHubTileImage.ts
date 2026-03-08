import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "hub-tile-images";

export function useHubTileImage(tileKey: string, prompt: string) {
  return useQuery({
    queryKey: ["hub-tile-image", tileKey],
    queryFn: async () => {
      // First check if image exists in storage
      const { data: publicUrl } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(`${tileKey}.png`);

      // Try to fetch the image to see if it exists
      try {
        const res = await fetch(publicUrl.publicUrl, { method: "HEAD" });
        if (res.ok) {
          return publicUrl.publicUrl;
        }
      } catch {
        // Image doesn't exist, generate it
      }

      // Generate via edge function
      const { data, error } = await supabase.functions.invoke("generate-hub-image", {
        body: { prompt, tileKey },
      });

      if (error) {
        console.error("Failed to generate hub image:", error);
        return null;
      }

      return data?.imageUrl || null;
    },
    staleTime: Infinity, // Images don't change
    retry: 1,
  });
}
