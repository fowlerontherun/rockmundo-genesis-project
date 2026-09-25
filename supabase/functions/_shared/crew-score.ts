/**
 * Role-specific Show Crew score. Only accepted workers referenced by this gig
 * count. A top sound engineer cannot hide a missing road or lighting department.
 */
export type CrewMemberScore = {
  id: string;
  skill_level: number | null;
  cohesion_rating?: number | null;
};
export type CrewGigAssignment = {
  band_crew_member_id?: string | null;
  crew_role: string;
  assignment_status: string;
};

const ROLE_WEIGHTS = {
  sound_engineer: 0.45,
  lighting_engineer: 0.15,
  stage_manager: 0.25,
  guitar_technician: 0.15,
} as const;

export function scoreAssignedShowCrew(
  roster: CrewMemberScore[],
  assignments: CrewGigAssignment[],
): { score: number; filledRoles: number; assignedCount: number } {
  const byId = new Map(roster.map((member) => [member.id, member]));
  const attending = assignments.filter(
    (assignment) => assignment.assignment_status === "accepted"
      && assignment.band_crew_member_id
      && byId.has(assignment.band_crew_member_id),
  );
  let filledRoles = 0;
  const weighted = Object.entries(ROLE_WEIGHTS).reduce((sum, [role, weight]) => {
    const assignment = attending.find((item) => item.crew_role === role);
    const member = assignment?.band_crew_member_id && byId.get(assignment.band_crew_member_id);
    if (!member) return sum + 25 * weight;
    filledRoles++;
    const ability = Math.max(0, Math.min(100,
      Number(member.skill_level || 0) + Number(member.cohesion_rating || 0) * 0.08));
    return sum + ability * weight;
  }, 0);
  return {
    score: attending.length === 0 && assignments.length === 0 ? 40 : Math.round(weighted),
    filledRoles,
    assignedCount: attending.length,
  };
}
