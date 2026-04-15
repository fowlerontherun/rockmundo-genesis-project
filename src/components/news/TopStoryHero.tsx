import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Flame } from "lucide-react";

export function TopStoryHero() {
  const today = new Date().toISOString().split("T")[0];

  const { data: story } = useQuery({
    queryKey: ["top-story-hero", today],
    queryFn: async () => {
      // Try biggest chart mover
      const { data: movers } = await supabase
        .from("chart_entries")
        .select("rank, trend, trend_change, songs!inner(title, bands(name))")
        .eq("chart_type", "top40")
        .not("trend_change", "is", null)
        .order("trend_change", { ascending: false })
        .limit(1);

      if (movers && movers.length > 0) {
        const m = movers[0] as any;
        return {
          headline: `"${m.songs.title}" by ${m.songs.bands?.name || "Unknown"} Surges to #${m.rank}`,
          subheadline: `The track climbed ${m.trend_change} spots on the Top 40 chart in a dramatic move that has the industry buzzing.`,
          category: "CHARTS",
        };
      }

      // Try biggest fame event
      const { data: fameEvents } = await supabase
        .from("band_fame_events")
        .select("fame_gained, event_type, bands(name)")
        .gte("created_at", `${today}T00:00:00`)
        .order("fame_gained", { ascending: false })
        .limit(1);

      if (fameEvents && fameEvents.length > 0) {
        const f = fameEvents[0] as any;
        return {
          headline: `${f.bands?.name || "A Band"} Gains ${f.fame_gained} Fame in Explosive ${f.event_type.replace(/_/g, " ")}`,
          subheadline: "The music world watches as another act rises through the ranks of Rockmundo's competitive scene.",
          category: "FAME",
        };
      }

      // Try new release
      const { data: releases } = await supabase
        .from("releases")
        .select("title, bands(name)")
        .eq("release_status", "released")
        .gte("release_date", `${today}T00:00:00`)
        .order("release_date", { ascending: false })
        .limit(1);

      if (releases && releases.length > 0) {
        const r = releases[0] as any;
        return {
          headline: `${r.bands?.name || "Unknown Artist"} Drops New Release: "${r.title}"`,
          subheadline: "Fresh music hits the airwaves today as fans eagerly await their verdict.",
          category: "RELEASES",
        };
      }

      return {
        headline: "Another Day in the World of Rockmundo",
        subheadline: "The stages are set, the instruments are tuned, and the music plays on.",
        category: "EDITORIAL",
      };
    },
    staleTime: 10 * 60 * 1000,
  });

  if (!story) return null;

  return (
    <div className="border-b-2 border-border pb-6 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Flame className="h-4 w-4 text-destructive" />
        <span className="text-xs font-bold uppercase tracking-widest text-destructive">{story.category}</span>
      </div>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-black leading-tight mb-3">
        {story.headline}
      </h2>
      <p className="text-sm sm:text-base text-muted-foreground font-serif leading-relaxed max-w-3xl">
        {story.subheadline}
      </p>
    </div>
  );
}
