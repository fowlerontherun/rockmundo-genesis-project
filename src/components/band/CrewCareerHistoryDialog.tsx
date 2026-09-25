import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, CalendarDays } from "lucide-react";
import { crewDb } from "@/components/gig/crewDb";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export interface CareerCrewMember {
  id: string;
  name: string;
  crew_type: string;
  career_xp?: number;
  skill_level: number;
  gigs_together: number;
}

interface CareerGig {
  id: string;
  settled_at: string;
  crew_role: string;
  salary_paid: number;
  xp_awarded: number;
  skill_before: number;
  skill_after: number;
  cohesion_before: number;
  cohesion_after: number;
}

export function CrewCareerHistoryDialog({
  crew,
  onClose,
}: {
  crew: CareerCrewMember | null;
  onClose: () => void;
}) {
  const { data: gigs = [], isLoading, isError } = useQuery<CareerGig[]>({
    queryKey: ["crew-career-history", crew?.id],
    enabled: Boolean(crew?.id),
    queryFn: async () => {
      if (!crew) return [];
      const { data, error } = await crewDb
        .from<CareerGig>("gig_crew_settlements")
        .select("id,settled_at,crew_role,salary_paid,xp_awarded,skill_before,skill_after,cohesion_before,cohesion_after")
        .eq("crew_member_id", crew.id)
        .order("settled_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Dialog open={Boolean(crew)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BriefcaseBusiness className="h-5 w-5" />
            {crew?.name || "Crew career"}
          </DialogTitle>
          <DialogDescription>
            {crew?.crew_type}. Only gigs they actually attended count towards this career record.
          </DialogDescription>
        </DialogHeader>
        {crew && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-center">
              <div><p className="text-xs text-muted-foreground">Gigs worked</p><p className="text-xl font-bold">{crew.gigs_together}</p></div>
              <div><p className="text-xs text-muted-foreground">Technical skill</p><p className="text-xl font-bold">{crew.skill_level}/100</p></div>
              <div><p className="text-xs text-muted-foreground">Career XP</p><p className="text-xl font-bold">{crew.career_xp ?? 0}</p></div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress to next technical skill point</span>
                <span>{crew.skill_level >= 100 ? "Maximum technical skill" : `${100 - ((crew.career_xp ?? 0) % 100)} XP to go`}</span>
              </div>
              <Progress value={crew.skill_level >= 100 ? 100 : (crew.career_xp ?? 0) % 100} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Recent gig experience</h3>
              {isLoading && <p className="text-sm text-muted-foreground">Loading career history…</p>}
              {isError && <p role="alert" className="text-sm text-destructive">Could not load the crew career record.</p>}
              {!isLoading && !isError && gigs.length === 0 && (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No completed gigs recorded yet. Assign this crew member to an upcoming show to start building their career.
                </p>
              )}
              <div className="space-y-2">
                {gigs.map((gig) => (
                  <div key={gig.id} className="rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1 text-sm font-semibold">
                        <CalendarDays className="h-4 w-4" />
                        {new Date(gig.settled_at).toLocaleDateString()}
                      </span>
                      <Badge variant="secondary">+{gig.xp_awarded} XP</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <span>Skill: {gig.skill_before} → {gig.skill_after}</span>
                      <span>Cohesion: {gig.cohesion_before} → {gig.cohesion_after}</span>
                      <span>Pay: ${gig.salary_paid.toLocaleString()}</span>
                      <span>{gig.crew_role}</span>
                    </div>
                  </div>
                ))}
              </div>
              {gigs.length === 10 && <p className="mt-2 text-xs text-muted-foreground">Showing the 10 most recent gigs.</p>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
