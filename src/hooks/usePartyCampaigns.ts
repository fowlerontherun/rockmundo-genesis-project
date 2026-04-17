import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PartyCampaignRow {
  endorsement_id: string;
  endorsed_at: string;
  statement: string | null;

  candidate_id: string;
  candidate_name: string;
  candidate_avatar: string | null;
  candidate_slogan: string | null;
  player_votes: number;
  endorsement_bonus: number;
  total_votes: number;

  election_id: string;
  election_year: number;
  election_status: string;
  voting_end: string;

  city_id: string;
  city_name: string;
  country: string | null;

  // Standing within the election
  rank: number;
  total_candidates: number;
  is_leading: boolean;
}

/**
 * Aggregates every candidate the party has endorsed across all active elections
 * along with their live ranking & vote performance.
 */
export function usePartyCampaigns(partyId: string | undefined) {
  return useQuery({
    queryKey: ["party-campaigns", partyId],
    queryFn: async (): Promise<PartyCampaignRow[]> => {
      if (!partyId) return [];

      // 1. All endorsements by this party
      const { data: endorsements, error: eErr } = await supabase
        .from("party_endorsements")
        .select("id, candidate_id, election_id, statement, created_at")
        .eq("party_id", partyId);
      if (eErr) throw eErr;
      if (!endorsements || endorsements.length === 0) return [];

      const electionIds = Array.from(new Set(endorsements.map((e) => e.election_id)));

      // 2. Pull all candidates for those elections (to compute ranks)
      const { data: allCandidates, error: cErr } = await supabase
        .from("city_candidates")
        .select("id, election_id, profile_id, vote_count, endorsement_bonus_votes, campaign_slogan")
        .in("election_id", electionIds)
        .in("status", ["pending", "approved"]);
      if (cErr) throw cErr;

      // 3. Elections + cities
      const { data: elections } = await supabase
        .from("city_elections")
        .select("id, election_year, status, voting_end, city_id")
        .in("id", electionIds);

      const cityIds = Array.from(new Set((elections ?? []).map((e) => e.city_id)));
      const { data: cities } = await supabase
        .from("cities")
        .select("id, name, country")
        .in("id", cityIds);

      // 4. Profiles for endorsed candidates
      const endorsedCandidateIds = endorsements.map((e) => e.candidate_id);
      const profileIds = (allCandidates ?? [])
        .filter((c) => endorsedCandidateIds.includes(c.id))
        .map((c) => c.profile_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, stage_name, display_name, avatar_url")
        .in("id", profileIds);

      const electionMap = new Map((elections ?? []).map((e) => [e.id, e]));
      const cityMap = new Map((cities ?? []).map((c) => [c.id, c]));
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      // Group candidates by election & sort by total votes desc
      const candidatesByElection = new Map<string, typeof allCandidates>();
      for (const c of allCandidates ?? []) {
        if (!candidatesByElection.has(c.election_id)) {
          candidatesByElection.set(c.election_id, []);
        }
        candidatesByElection.get(c.election_id)!.push(c);
      }
      for (const list of candidatesByElection.values()) {
        list.sort(
          (a, b) =>
            b.vote_count + (b.endorsement_bonus_votes ?? 0) -
            (a.vote_count + (a.endorsement_bonus_votes ?? 0)),
        );
      }

      const rows: PartyCampaignRow[] = endorsements.map((endo) => {
        const election = electionMap.get(endo.election_id);
        const city = election ? cityMap.get(election.city_id) : null;
        const electionRoster = candidatesByElection.get(endo.election_id) ?? [];
        const candidate = electionRoster.find((c) => c.id === endo.candidate_id);
        const profile = candidate ? profileMap.get(candidate.profile_id) : null;

        const playerVotes = candidate?.vote_count ?? 0;
        const bonus = candidate?.endorsement_bonus_votes ?? 0;
        const total = playerVotes + bonus;
        const rank = candidate ? electionRoster.findIndex((c) => c.id === candidate.id) + 1 : 0;

        return {
          endorsement_id: endo.id,
          endorsed_at: endo.created_at,
          statement: endo.statement,

          candidate_id: endo.candidate_id,
          candidate_name: profile?.stage_name ?? profile?.display_name ?? "Unknown",
          candidate_avatar: profile?.avatar_url ?? null,
          candidate_slogan: candidate?.campaign_slogan ?? null,
          player_votes: playerVotes,
          endorsement_bonus: bonus,
          total_votes: total,

          election_id: endo.election_id,
          election_year: election?.election_year ?? 0,
          election_status: election?.status ?? "unknown",
          voting_end: election?.voting_end ?? "",

          city_id: election?.city_id ?? "",
          city_name: city?.name ?? "Unknown city",
          country: city?.country ?? null,

          rank,
          total_candidates: electionRoster.length,
          is_leading: rank === 1,
        };
      });

      // Sort: active elections first, then by rank ascending
      const statusWeight = (s: string) =>
        s === "voting" ? 0 : s === "nomination" ? 1 : s === "completed" ? 2 : 3;
      rows.sort((a, b) => {
        const sw = statusWeight(a.election_status) - statusWeight(b.election_status);
        if (sw !== 0) return sw;
        return a.rank - b.rank;
      });

      return rows;
    },
    enabled: !!partyId,
  });
}
