import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { crewDb } from "./crewDb";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RosterMember = { id: string; name: string; crew_type: string; skill_level: number; salary_per_gig: number; career_xp?: number };
type Assignment = { id: string; crew_role: string; band_crew_member_id: string | null; assignment_status: string; cost: number };

const roleOf = (label: string): string => ({
  "Front of House Engineer": "sound_engineer",
  "Lighting Director": "lighting_engineer",
  "Road Crew Chief": "stage_manager",
  "Backline Technician": "guitar_technician",
  "Tour Manager": "tour_manager",
  "Security Lead": "security",
  "Merch Director": "merchandise_manager",
  "Wardrobe Stylist": "wardrobe_stylist",
}[label] || label.trim().toLowerCase().replaceAll(" ", "_"));

const roleLabels: Record<string, string> = {
  sound_engineer: "Front of House",
  lighting_engineer: "Lighting",
  stage_manager: "Road Crew",
  guitar_technician: "Backline",
  tour_manager: "Tour Manager",
  security: "Security",
  merchandise_manager: "Merchandise",
  wardrobe_stylist: "Wardrobe",
};

export function GigCrewAssignmentCard({ gigId, bandId, locked }: {
  gigId: string; bandId: string; locked: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const rosterQuery = useQuery({
    queryKey: ["gig-crew-roster", bandId],
    enabled: !!bandId,
    queryFn: async (): Promise<RosterMember[]> => {
      const { data, error } = await crewDb
        .from<RosterMember>("band_crew_members")
        .select("id,name,crew_type,skill_level,salary_per_gig")
        .eq("band_id", bandId);
      if (error) throw error;
      return (data || []) as RosterMember[];
    },
  });

  const assignmentQuery = useQuery({
    queryKey: ["gig-crew-assignments", gigId],
    enabled: !!gigId,
    queryFn: async (): Promise<Assignment[]> => {
      const { data, error } = await crewDb
        .from<Assignment>("gig_crew_assignments")
        .select("id,crew_role,band_crew_member_id,assignment_status,cost")
        .eq("gig_id", gigId);
      if (error) throw error;
      return (data || []) as Assignment[];
    },
  });

  const roster = rosterQuery.data || [];
  const assignments = assignmentQuery.data || [];
  const roles = [...new Set(roster.map((member) => roleOf(member.crew_type)))];
  const assigned = assignments.filter((row) => row.assignment_status === "accepted" && roster.some((member) => member.id === row.band_crew_member_id));
  const payroll = assigned.reduce((sum, item) => sum + Number(item.cost || 0), 0);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["gig-crew-assignments", gigId] }),
      queryClient.invalidateQueries({ queryKey: ["gig-live-setup", gigId] }),
    ]);
  };

  const autoAssign = async () => {
    setSavingRole("all");
    try {
      const { error } = await crewDb.rpc("sync_band_crew_for_gig", { p_gig_id: gigId });
      if (error) throw error;
      await refresh();
      toast({ title: "Crew assigned", description: "Your available band crew are now scheduled for this gig." });
    } catch (error) {
      toast({ title: "Could not assign crew", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setSavingRole(null);
    }
  };

  const saveRole = async (role: string, selection: string) => {
    const selected = selection === "absent"
      ? roster.find((member) => member.id === assignments.find((row) => row.crew_role === role)?.band_crew_member_id)
        || roster.find((member) => roleOf(member.crew_type) === role)
      : roster.find((member) => member.id === selection && roleOf(member.crew_type) === role);
    if (!selected) return;
    setSavingRole(role);
    try {
      const { error } = await crewDb.rpc("save_gig_crew_assignment", {
        p_gig_id: gigId,
        p_crew_role: role,
        p_worker_type: "npc_staff",
        p_npc_staff_id: selected.id,
        p_assignment_status: selection === "absent" ? "declined" : "accepted",
        p_cost: 0, // Ignored: the server reads the contracted salary.
      });
      if (error) throw error;
      await refresh();
      toast({ title: "Crew schedule updated" });
    } catch (error) {
      toast({ title: "Crew schedule could not be saved", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setSavingRole(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Crew for this gig</CardTitle>
        <CardDescription>Only accepted, attending staff contribute to the show, receive a per-gig salary and earn career experience.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(rosterQuery.isError || assignmentQuery.isError) && <p className="text-sm text-destructive">Crew schedule is unavailable.</p>}
        {!rosterQuery.isLoading && !roster.length && (
          <p className="text-sm">No crew hired yet. <Link to="/band-crew" className="underline">Recruit your first crew member</Link>.</p>
        )}
        {roles.map((role) => {
          const current = assignments.find((item) => item.crew_role === role);
          const options = roster.filter((member) => roleOf(member.crew_type) === role);
          return (
            <div key={role} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-sm">{roleLabels[role] || role}</p>
                <p className="text-xs text-muted-foreground">
                  {current?.assignment_status === "accepted" ? "Confirmed for show" : "Not attending"}
                </p>
              </div>
              <Select
                value={current?.assignment_status === "accepted" && current.band_crew_member_id || "absent"}
                disabled={locked || savingRole !== null}
                onValueChange={(value) => void saveRole(role, value)}
              >
                <SelectTrigger className="w-full sm:w-[280px]" aria-label={roleLabels[role] || role}>
                  <SelectValue placeholder="Assign crew" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absent">Not attending</SelectItem>
                  {options.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} · {member.skill_level}/100 · ${member.salary_per_gig}/gig
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm"><Badge variant="outline">{assigned.length} attending</Badge> <span className="ml-2 text-muted-foreground">Crew payroll: ${payroll.toLocaleString()}</span></div>
          {!locked && roster.length > 0 && <Button size="sm" onClick={() => void autoAssign()} disabled={savingRole !== null}>Assign available band crew</Button>}
        </div>
        <p className="text-xs text-muted-foreground">Assignments lock when the gig starts. Existing choices are preserved when filling empty roles.</p>
      </CardContent>
    </Card>
  );
}
