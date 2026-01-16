import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface OwnershipEntry {
  user_id: string;
  ownership_percentage: number;
  role: string;
  is_active_member: boolean;
}

interface OwnershipBreakdownProps {
  ownership: OwnershipEntry[];
}

export const OwnershipBreakdown = ({ ownership }: OwnershipBreakdownProps) => {
  // Fetch user profiles for display names
  const userIds = ownership.map((o) => o.user_id);

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["ownership-profiles", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];

      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, username")
        .in("id", userIds);

      return data || [];
    },
    enabled: userIds.length > 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
      </div>
    );
  }

  const getProfileName = (userId: string) => {
    const profile = profiles.find((p) => p.id === userId);
    return profile?.display_name || profile?.username || "Unknown";
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (role) {
      case "writer":
        return "default";
      case "co-writer":
        return "secondary";
      case "former_member":
        return "outline";
      default:
        return "outline";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "writer":
        return "Writer";
      case "co-writer":
        return "Co-Writer";
      case "former_member":
        return "Former Member";
      default:
        return role;
    }
  };

  // Calculate total percentage for bar visualization
  const totalPercentage = ownership.reduce((sum, o) => sum + o.ownership_percentage, 0);

  return (
    <div className="space-y-3">
      {/* Stacked bar visualization */}
      <div className="h-4 rounded-full overflow-hidden flex bg-muted">
        {ownership.map((entry, index) => {
          const width = (entry.ownership_percentage / Math.max(totalPercentage, 100)) * 100;
          const colors = [
            "bg-primary",
            "bg-blue-500",
            "bg-green-500",
            "bg-orange-500",
            "bg-purple-500",
          ];
          const colorClass = entry.is_active_member ? colors[index % colors.length] : "bg-muted-foreground";
          
          return (
            <div
              key={entry.user_id}
              className={`${colorClass} ${!entry.is_active_member ? "opacity-50" : ""}`}
              style={{ width: `${width}%` }}
              title={`${getProfileName(entry.user_id)}: ${entry.ownership_percentage}%`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="grid gap-2">
        {ownership.map((entry) => (
          <div
            key={entry.user_id}
            className={`flex items-center justify-between p-2 rounded-lg ${
              entry.is_active_member ? "bg-muted/50" : "bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`font-medium ${!entry.is_active_member ? "text-muted-foreground" : ""}`}>
                {getProfileName(entry.user_id)}
              </span>
              <Badge variant={getRoleBadgeVariant(entry.role)} className="text-xs">
                {getRoleLabel(entry.role)}
              </Badge>
              {!entry.is_active_member && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Inactive
                </Badge>
              )}
            </div>
            <span className="font-bold">
              {entry.ownership_percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
