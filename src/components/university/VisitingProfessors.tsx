import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Visit = {
  id: string;
  university_id: string;
  name: string;
  skill_family: string;
  ends_at: string;
};

export function VisitingProfessors({ universityId }: { universityId: string }) {
  const { data: visits = [], isError } = useQuery({
    queryKey: ["visiting_professors", universityId],
    enabled: !!universityId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("active_professor_residencies")
        .select("id,university_id,name,skill_family,ends_at")
        .eq("university_id", universityId);
      if (error) throw error;
      return (data ?? []) as Visit[];
    },
  });

  if (isError) return <p role="status" className="text-sm text-muted-foreground">Visiting professor information is temporarily unavailable.</p>;
  if (!visits.length) return null;

  return (
    <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4" aria-label="Visiting professors">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <GraduationCap className="h-5 w-5" />
        Visiting Super Professors
      </div>
      <div className="space-y-2">
        {visits.map((visit) => (
          <div key={visit.id}>
            <p className="font-medium">{visit.name}</p>
            <p className="text-sm text-muted-foreground">
              +70% attendance XP for {visit.skill_family.replace(/_/g, " ")} courses
              {" · "}Until {new Date(new Date(visit.ends_at).getTime() - 1).toLocaleDateString("en-GB", { timeZone: "UTC" })}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
