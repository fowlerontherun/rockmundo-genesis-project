import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface RecentActivitySectionProps {
  userId: string | undefined;
}

export function RecentActivitySection({ userId }: RecentActivitySectionProps) {
  const { data: activities } = useQuery({
    queryKey: ["recent-activity", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("activity_feed")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!userId,
  });

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No recent activity yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {activity.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activity.created_at &&
                    formatDistanceToNow(new Date(activity.created_at), {
                      addSuffix: true,
                    })}
                </p>
              </div>
              {activity.earnings !== null && activity.earnings > 0 && (
                <span className="text-xs font-semibold text-emerald-600">
                  +${activity.earnings}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
