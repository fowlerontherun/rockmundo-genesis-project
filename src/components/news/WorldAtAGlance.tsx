import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Globe2 } from "lucide-react";

async function countOf(table: string, filter?: (q: any) => any) {
  let query: any = (supabase as any).from(table).select("id", { count: "exact", head: true });
  if (filter) query = filter(query);
  const { count, error } = await query;
  if (error) return null;
  return count ?? 0;
}

export function WorldAtAGlance() {
  const { data } = useQuery({
    queryKey: ["news-world-at-a-glance"],
    queryFn: async () => {
      const [artists, bands, cities, songs, gigs, venues] = await Promise.all([
        countOf("profiles", (q) => q.eq("is_active", true)),
        countOf("bands"),
        countOf("cities"),
        countOf("songs"),
        countOf("gigs", (q) => q.eq("status", "completed")),
        countOf("venues"),
      ]);
      return { artists, bands, cities, songs, gigs, venues };
    },
    staleTime: 5 * 60 * 1000,
  });

  const allRows: { label: string; value: number | null | undefined }[] = [
    { label: "Registered artists", value: data?.artists },
    { label: "Active bands", value: data?.bands },
    { label: "Songs written", value: data?.songs },
    { label: "Shows performed", value: data?.gigs },
    { label: "Venues worldwide", value: data?.venues },
    { label: "Cities on the map", value: data?.cities },
  ];

  // Hide figures we could not read, so the box never prints a misleading zero
  const rows = allRows.filter((row) => typeof row.value === "number" && row.value > 0);

  return (
    <section className="border-2 border-foreground p-3">
      <h3 className="font-serif text-lg font-black flex items-center gap-2 border-b border-foreground pb-1 mb-2">
        <Globe2 className="h-4 w-4" />
        World at a Glance
      </h3>
      <dl className="space-y-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline gap-2 text-xs font-serif"
          >
            <dt className="text-muted-foreground whitespace-nowrap">{row.label}</dt>
            <span className="flex-1 border-b border-dotted border-border translate-y-[-2px]" />
            <dd className="font-mono font-bold tabular-nums">
              {row.value === null || row.value === undefined
                ? "—"
                : row.value.toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-[10px] font-mono uppercase text-muted-foreground mt-2 pt-1 border-t border-border">
        Figures compiled by the Rockmundo Times newsdesk
      </p>
    </section>
  );
}
