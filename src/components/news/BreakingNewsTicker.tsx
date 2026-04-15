import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle } from "lucide-react";

export function BreakingNewsTicker() {
  const today = new Date().toISOString().split("T")[0];

  const { data: headlines } = useQuery({
    queryKey: ["breaking-news-ticker", today],
    queryFn: async () => {
      const items: string[] = [];

      const [{ data: bands }, { data: releases }, { data: contracts }] = await Promise.all([
        supabase
          .from("bands")
          .select("name, genre")
          .gte("created_at", `${today}T00:00:00`)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("releases")
          .select("title, bands(name)")
          .eq("release_status", "released")
          .gte("release_date", `${today}T00:00:00`)
          .order("release_date", { ascending: false })
          .limit(5),
        supabase
          .from("artist_label_contracts")
          .select("bands(name), labels(name)")
          .eq("status", "active")
          .gte("created_at", `${today}T00:00:00`)
          .limit(5),
      ]);

      bands?.forEach((b: any) => items.push(`🎸 New band "${b.name}" formed (${b.genre})`));
      releases?.forEach((r: any) => items.push(`💿 "${r.title}" by ${r.bands?.name || "Unknown"} released today`));
      contracts?.forEach((c: any) => {
        if (c.bands && c.labels) items.push(`✍️ ${(c as any).bands.name} signs with ${(c as any).labels.name}`);
      });

      return items.length > 0 ? items : ["📰 Stay tuned for today's breaking stories..."];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!headlines || headlines.length === 0) return null;

  const tickerText = headlines.join("   ●   ");

  return (
    <div className="bg-destructive/10 border border-destructive/30 rounded-md overflow-hidden mb-6">
      <div className="flex items-center">
        <div className="bg-destructive text-destructive-foreground px-3 py-1.5 flex items-center gap-1.5 shrink-0">
          <AlertCircle className="h-3.5 w-3.5" />
          <span className="text-xs font-bold uppercase tracking-wider">Breaking</span>
        </div>
        <div className="overflow-hidden flex-1">
          <div className="animate-marquee whitespace-nowrap py-1.5 px-4 text-sm">
            {tickerText}
          </div>
        </div>
      </div>
    </div>
  );
}
