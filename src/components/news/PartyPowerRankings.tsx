import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { useParties } from "@/hooks/useParties";

export function PartyPowerRankings() {
  const { data: parties } = useParties();
  const top = (parties ?? []).slice(0, 10);
  if (top.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-serif flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Party Power Rankings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {top.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
              <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.colour_hex }} />
              <span className="text-sm font-serif truncate">{p.name}</span>
            </div>
            <div className="text-xs text-muted-foreground flex gap-2">
              <span>{p.member_count} members</span>
              <span>·</span>
              <span>{p.mayor_count} mayors</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
