import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { asAny } from "@/lib/type-helpers";

export interface ChildTrait {
  key: string;
  name: string;
  description: string;
  icon: string;
  modifiers: Record<string, Record<string, number>>;
  baseline_adjustments: Record<string, number>;
  conflicts_with: string[];
}

/** Fetch the global child personality trait catalog. */
export function useChildTraitCatalog() {
  return useQuery({
    queryKey: ["child-trait-catalog"],
    staleTime: 1000 * 60 * 60, // catalog is effectively static
    queryFn: async (): Promise<ChildTrait[]> => {
      const { data, error } = await supabase
        .from(asAny("child_trait_catalog"))
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as ChildTrait[];
    },
  });
}

/**
 * Resolve a list of trait keys to their catalog rows.
 * Returns an empty array while the catalog is still loading.
 */
export function useResolvedChildTraits(traitKeys: string[] | null | undefined) {
  const { data: catalog = [] } = useChildTraitCatalog();
  const map = new Map(catalog.map((t) => [t.key, t]));
  return (traitKeys ?? [])
    .map((k) => map.get(k))
    .filter((t): t is ChildTrait => !!t);
}
