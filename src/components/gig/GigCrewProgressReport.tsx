import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CrewSettlement {
  id: string;
  crew_name: string;
  crew_role: string;
  salary_paid: number;
  xp_awarded: number;
  skill_before: number;
  skill_after: number;
  cohesion_before: number;
  cohesion_after: number;
}

export function GigCrewProgressReport({ gigId, visible }: { gigId?: string | null; visible: boolean }) {
  const { data: crew = [], isLoading, isError } = useQuery<CrewSettlement[]>({
    queryKey: ["gig-crew-settlement", gigId],
    enabled: visible && !!gigId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gig_crew_settlements")
        .select("id,crew_name,crew_role,salary_paid,xp_awarded,skill_before,skill_after,cohesion_before,cohesion_after")
        .eq("gig_id", gigId)
        .order("crew_role");
      if (error) throw error;
      return (data || []) as CrewSettlement[];
    },
  });

  if (!gigId || (!isLoading && !isError && crew.length === 0)) return null;

  return (
    <Card id="crew-progression">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Crew development</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading crew progression…</p>}
        {isError && <p className="text-sm text-muted-foreground">Crew progression is temporarily unavailable.</p>}
        {crew.map((member) => (
          <div key={member.id} className="rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{member.crew_name}</p>
                <p className="text-xs text-muted-foreground">{member.crew_role}</p>
              </div>
              <Badge variant="secondary">+{member.xp_awarded} XP</Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
              <span>Skill: {member.skill_before} → {member.skill_after}</span>
              <span>Cohesion: {member.cohesion_before} → {member.cohesion_after}</span>
              <span>Wages: ${Number(member.salary_paid).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
