import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Users } from "lucide-react";

export function PlayerStaffBonusCard({ companyId }: { companyId: string }) {
  const { data } = useQuery({
    queryKey: ["staff-bonus", companyId],
    queryFn: async () => {
      const [emp, comp] = await Promise.all([
        (supabase as any).from("company_employees").select("id").eq("company_id", companyId).eq("status", "active"),
        (supabase as any).from("companies").select("npc_staff_count").eq("id", companyId).single(),
      ]);
      const players = emp.data?.length ?? 0;
      const npcs = comp.data?.npc_staff_count ?? 0;
      let bonus = 1 + Math.min(players, 10) * 0.04;
      if (players === 0 && npcs > 0) bonus *= 0.9;
      return { players, npcs, bonus };
    },
  });

  if (!data) return null;
  const pct = Math.round((data.bonus - 1) * 100);
  const positive = pct >= 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className={positive ? "h-4 w-4 text-emerald-500" : "h-4 w-4 text-amber-500"} />
          Staff output multiplier: <span className={positive ? "text-emerald-500" : "text-amber-500"}>{pct >= 0 ? "+" : ""}{pct}%</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-1">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Players: <strong className="text-foreground">{data.players}</strong></span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3 opacity-50" /> NPCs: <strong className="text-foreground">{data.npcs}</strong></span>
        </div>
        <p className="text-xs">
          Hiring real players adds +4% per active employee (capped at +40%). Running on NPCs only applies a −10% penalty.
          This multiplier scales daily customers, revenue and city tax.
        </p>
      </CardContent>
    </Card>
  );
}
