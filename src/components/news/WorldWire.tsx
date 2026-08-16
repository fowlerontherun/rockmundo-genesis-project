import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNowStrict } from "date-fns";
import { Radio } from "lucide-react";

type WireItem = {
  id: string;
  activity_type: string | null;
  message: string | null;
  earnings: number | null;
  created_at: string;
};

const KICKERS: Record<string, string> = {
  gig: "Live",
  performance: "Live",
  recording: "Studio",
  song: "Studio",
  release: "Release",
  band: "Bands",
  travel: "Travel",
  employment: "Working Life",
  wellness: "Health",
  achievement: "Milestone",
  purchase: "Commerce",
  merch: "Commerce",
};

function kickerFor(type: string | null) {
  if (!type) return "Newsdesk";
  const key = Object.keys(KICKERS).find((k) => type.toLowerCase().includes(k));
  return key ? KICKERS[key] : type.replace(/_/g, " ");
}

export function WorldWire({ limit = 12 }: { limit?: number }) {
  const { data: items } = useQuery({
    queryKey: ["news-world-wire", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_feed")
        .select("id, activity_type, message, earnings, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as WireItem[];
    },
    staleTime: 60_000,
  });

  return (
    <section className="border-t-2 border-foreground pt-3">
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="font-serif text-2xl font-black tracking-tight flex items-center gap-2">
          <Radio className="h-5 w-5" />
          The World Wire
        </h2>
        <span className="text-[10px] font-mono uppercase text-muted-foreground">
          Dispatches from across Rockmundo
        </span>
      </header>

      {items && items.length > 0 ? (
        <div className="columns-1 sm:columns-2 gap-6 [column-rule:1px_solid_hsl(var(--border))]">
          {items.map((item) => (
            <article
              key={item.id}
              className="break-inside-avoid mb-3 pb-3 border-b border-border/60"
            >
              <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
                {kickerFor(item.activity_type)}
              </p>
              <p className="font-serif text-sm leading-snug">
                {item.message || "An unreported incident in the music world."}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                {formatDistanceToNowStrict(new Date(item.created_at))} ago
                {item.earnings ? ` · $${item.earnings.toLocaleString()}` : ""}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="font-serif italic text-sm text-muted-foreground">
          The wire is quiet. Our correspondents are still chasing leads.
        </p>
      )}
    </section>
  );
}
