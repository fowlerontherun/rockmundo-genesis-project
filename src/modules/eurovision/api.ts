import type {
  ArtistSubmission,
  EurovisionPhase,
  EurovisionYear,
  SelectedEntry,
  Vote,
} from "./types";

interface SubmitPayload {
  year: number;
  countryCode: string;
  artistName: string;
  songTitle: string;
  playerId: string;
}

interface StartEventPayload {
  year: number;
}

interface CastVotePayload {
  year: number;
  entryId: string;
  voterId: string;
  points: number;
}

interface AdvancePhasePayload {
  year: number;
  forcePhase?: EurovisionPhase;
  triggeredBy?: string;
}

const BASE_URL =
  `${import.meta.env.VITE_SUPABASE_URL ?? ""}/functions/v1/eurovision`;

async function postEurovision<T>(body: unknown): Promise<T> {
  const resp = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ""}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(
      `Eurovision API error (${resp.status}): ${errorText || resp.statusText}`
    );
  }

  return resp.json() as Promise<T>;
}

export function submitSong(payload: SubmitPayload) {
  return postEurovision<ArtistSubmission>({ action: "submit", ...payload });
}

export function runNationalSelections(year: number) {
  return postEurovision<SelectedEntry[]>({ action: "run-selections", year });
}

export function startEurovisionEvent(payload: StartEventPayload) {
  return postEurovision<EurovisionYear>({ action: "start-event", ...payload });
}

export function castEurovisionVote(payload: CastVotePayload) {
  return postEurovision<Vote>({ action: "cast-vote", ...payload });
}

export function advanceEurovisionPhase(payload: AdvancePhasePayload) {
  return postEurovision<EurovisionYear>({ action: "advance-phase", ...payload });
}
