import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NavStyle = "sidebar" | "horizontal";

export function useNavStyle() {
  const queryClient = useQueryClient();

  const { data: navStyle = "sidebar", isLoading } = useQuery({
    queryKey: ["nav-style"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "nav_style")
        .single();
      if (error || !data) return "sidebar" as NavStyle;
      const val = typeof data.value === "string" ? data.value : JSON.stringify(data.value);
      return (val.replace(/"/g, "") as NavStyle) || "sidebar";
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (style: NavStyle) => {
      const { error } = await supabase
        .from("system_settings")
        .update({ value: JSON.stringify(style) as any })
        .eq("key", "nav_style");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nav-style"] });
    },
  });

  return {
    navStyle: navStyle as NavStyle,
    isLoading,
    setNavStyle: mutation.mutate,
  };
}
