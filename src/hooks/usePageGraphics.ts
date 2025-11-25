import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PageGraphic {
  id: string;
  page_key: string;
  page_name: string;
  hero_image_url: string | null;
  background_image_url: string | null;
  accent_image_url: string | null;
  icon_image_url: string | null;
  banner_image_url: string | null;
  metadata: any;
  is_active: boolean;
}

export function usePageGraphics(pageKey?: string) {
  return useQuery({
    queryKey: pageKey ? ["page-graphics", pageKey] : ["page-graphics"],
    queryFn: async () => {
      if (pageKey) {
        const { data, error } = await supabase
          .from("page_graphics")
          .select("*")
          .eq("is_active", true)
          .eq("page_key", pageKey)
          .single();

        if (error) throw error;
        return data as PageGraphic;
      }

      const { data, error } = await supabase
        .from("page_graphics")
        .select("*")
        .eq("is_active", true);

      if (error) throw error;
      return data as PageGraphic[];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
