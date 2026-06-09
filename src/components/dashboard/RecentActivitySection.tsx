import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { FMFilterBar, type FilterPill } from "@/components/fm/FMFilterBar";

interface RecentActivitySectionProps {
  userId: string | undefined;
}

type EarningsFilter = "all" | "earnings" | "noearnings";

export function RecentActivitySection({ userId: _userId }: RecentActivitySectionProps) {
  const { profileId } = useActiveProfile();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<EarningsFilter>("all");

  const { data: activities } = useQuery({
    queryKey: ["recent-activity", profileId],
    queryFn: async () => {
      if (!profileId) return [];
      const { data } = await supabase
        .from("activity_feed")
        .select("*")
        .eq("profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!profileId,
  });

  const filtered = useMemo(() => {
    if (!activities) return [];
    const q = search.trim().toLowerCase();
    return activities.filter((a: any) => {
      if (filter === "earnings" && !(a.earnings && a.earnings > 0)) return false;
      if (filter === "noearnings" && a.earnings && a.earnings > 0) return false;
      if (!q) return true;
      return String(a.message ?? "").toLowerCase().includes(q);
    });
  }, [activities, search, filter]);

  const counts = useMemo(() => {
    const list = activities ?? [];
    let earnings = 0;
    for (const a of list as any[]) if (a.earnings && a.earnings > 0) earnings++;
    return { all: list.length, earnings, noearnings: list.length - earnings };
  }, [activities]);

  const pills: FilterPill<EarningsFilter>[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "earnings", label: "Paid", count: counts.earnings },
    { value: "noearnings", label: "Other", count: counts.noearnings },
  ];

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-fm-fg-muted">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No recent activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <FMFilterBar<EarningsFilter>
        label="Activity"
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search activity…"
        pills={pills}
        activePill={filter}
        onPillChange={setFilter}
      />
      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center text-xs text-fm-fg-muted py-6">No activity matches your filters.</p>
          ) : (
            filtered.map((activity: any) => (
              <div
                key={activity.id}
                className="p-2.5 border border-fm-border bg-fm-panel rounded-sm hover:border-fm-accent/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-fm-fg truncate">{activity.message}</p>
                    <p className="text-[10px] text-fm-fg-muted mt-1">
                      {activity.created_at &&
                        formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {activity.earnings !== null && activity.earnings > 0 && (
                    <span className="text-xs font-semibold text-fm-good tabular-nums">
                      +${activity.earnings}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
