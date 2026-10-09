import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function LocalMayorColumn({ cityId, cityName }: { cityId?: string | null; cityName?: string | null }) {
  const { data: column, isError } = useQuery({
    queryKey: ["mayor-news", cityId],
    enabled: !!cityId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("mayor_news_columns")
        .select("id, headline, body, published_at, mayor_profile_id")
        .eq("city_id", cityId!)
        .order("published_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: mayor } = await supabase.from("profiles")
        .select("display_name").eq("id", data.mayor_profile_id).maybeSingle();
      return { ...data, author: mayor?.display_name || "City Mayor" } as {
        id: string; headline: string; body: string; published_at: string; author: string;
      };
    },
  });

  if (!cityId || (!column && !isError)) return null;
  if (isError) return <p role="status" className="text-sm text-muted-foreground">The mayor's column is temporarily unavailable.</p>;
  return (
    <details className="group rounded-md border border-foreground/40 bg-card/60 p-4">
      <summary className="cursor-pointer font-serif text-lg font-bold">Mayor's Column — {cityName || "Your City"}</summary>
      <article className="mt-3 whitespace-pre-wrap border-t pt-3">
        <h3 className="font-serif text-lg font-semibold">{column!.headline}</h3>
        <p className="mb-3 text-xs text-muted-foreground">By {column!.author} · {new Date(column!.published_at).toLocaleDateString()}</p>
        <p className="text-sm">{column!.body}</p>
      </article>
    </details>
  );
}
