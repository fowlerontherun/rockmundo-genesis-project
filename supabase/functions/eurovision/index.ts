import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeJson } from "../_shared/job-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-triggered-by",
};

type EurovisionPhase =
  | "SubmissionsOpen"
  | "SelectionsDone"
  | "EventLive"
  | "VotingClosed"
  | "Results";

type SubmissionStatus = "Pending" | "Selected" | "Rejected";

type EurovisionRequest =
  | ({ action: "submit" } & SubmitPayload)
  | { action: "run-selections"; year: number }
  | { action: "start-event"; year: number }
  | ({ action: "cast-vote" } & CastVotePayload)
  | ({ action: "advance-phase" } & AdvancePhasePayload);

interface SubmitPayload {
  year: number;
  countryCode: string;
  artistName: string;
  songTitle: string;
  playerId: string;
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

interface YearRecord {
  year: number;
  phase: EurovisionPhase;
  submission_window_open: boolean;
  selection_completed_at: string | null;
  event_started_at: string | null;
}

interface SubmissionRecord {
  id: string;
  year: number;
  country_code: string;
  artist_name: string;
  song_title: string;
  submitted_by: string;
  status: SubmissionStatus;
  created_at: string;
}

interface EntryRecord {
  id: string;
  year: number;
  submission_id: string;
  country_code: string;
  artist_name: string;
  song_title: string;
  running_order: number | null;
  selection_method: string | null;
  vote_total: number;
  vote_count: number;
}

interface VoteRecord {
  id: string;
  year: number;
  voter_id: string;
  entry_id: string;
  points: number;
  created_at: string;
}

const MAX_VOTES_PER_PLAYER = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const payload = await safeJson<EurovisionRequest>(req);

  if (!payload || !("action" in payload)) {
    return jsonError("Invalid payload", 400);
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    switch (payload.action) {
      case "submit":
        return handleSubmission(supabaseClient, payload);
      case "run-selections":
        return handleSelections(supabaseClient, payload.year);
      case "start-event":
        return handleStartEvent(supabaseClient, payload.year);
      case "cast-vote":
        return handleVote(supabaseClient, payload);
      case "advance-phase":
        return handleAdvancePhase(supabaseClient, payload);
      default:
        return jsonError("Unsupported action", 400);
    }
  } catch (error) {
    console.error("[eurovision] Unexpected error", error);
    return jsonError("Unexpected error", 500);
  }
});

async function ensureYear(
  supabaseClient: ReturnType<typeof createClient>,
  year: number
): Promise<YearRecord> {
  const { data, error } = await supabaseClient
    .from("eurovision_years")
    .select("year, phase, submission_window_open, selection_completed_at, event_started_at")
    .eq("year", year)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (data) return data as YearRecord;

  const { data: inserted, error: insertError } = await supabaseClient
    .from("eurovision_years")
    .insert({
      year,
      phase: "SubmissionsOpen",
      submission_window_open: true,
    })
    .select()
    .single();

  if (insertError || !inserted) {
    throw insertError ?? new Error("Failed to create year record");
  }

  return inserted as YearRecord;
}

async function validateCountryEligibility(
  supabaseClient: ReturnType<typeof createClient>,
  countryCode: string
) {
  const { data, error } = await supabaseClient
    .from("eurovision_countries")
    .select("code, eligible")
    .eq("code", countryCode)
    .single();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  if (data && data.eligible === false) {
    throw new Error(`Country ${countryCode} is not eligible this year`);
  }
}

async function handleSubmission(
  supabaseClient: ReturnType<typeof createClient>,
  payload: SubmitPayload
) {
  const yearRecord = await ensureYear(supabaseClient, payload.year);

  if (!yearRecord.submission_window_open || yearRecord.phase !== "SubmissionsOpen") {
    return jsonError("Submissions are closed for this year", 400);
  }

  await validateCountryEligibility(supabaseClient, payload.countryCode);

  const { data: duplicate } = await supabaseClient
    .from("eurovision_submissions")
    .select("id")
    .eq("year", payload.year)
    .eq("country_code", payload.countryCode)
    .eq("artist_name", payload.artistName)
    .maybeSingle();

  if (duplicate) {
    return jsonError("This artist already submitted for the selected country", 409);
  }

  const submission: Omit<SubmissionRecord, "created_at" | "status"> & {
    created_at: string;
    status: SubmissionStatus;
  } = {
    id: crypto.randomUUID(),
    year: payload.year,
    country_code: payload.countryCode,
    artist_name: payload.artistName,
    song_title: payload.songTitle,
    submitted_by: payload.playerId,
    status: "Pending",
    created_at: new Date().toISOString(),
  };

  const { error } = await supabaseClient
    .from("eurovision_submissions")
    .insert(submission);

  if (error) {
    return jsonError(error.message, 400);
  }

  return jsonResponse({
    id: submission.id,
    year: submission.year,
    countryCode: submission.country_code,
    artistName: submission.artist_name,
    songTitle: submission.song_title,
    submittedBy: submission.submitted_by,
    status: submission.status,
    submittedAt: submission.created_at,
  });
}

async function handleSelections(
  supabaseClient: ReturnType<typeof createClient>,
  year: number
) {
  const yearRecord = await ensureYear(supabaseClient, year);

  if (yearRecord.phase !== "SubmissionsOpen") {
    return jsonError("Selections can only run while submissions are open", 400);
  }

  const { data: submissions, error } = await supabaseClient
    .from("eurovision_submissions")
    .select("id, year, country_code, artist_name, song_title, submitted_by")
    .eq("year", year)
    .eq("status", "Pending");

  if (error) {
    return jsonError(error.message, 400);
  }

  const grouped = new Map<string, SubmissionRecord[]>();
  for (const submission of submissions ?? []) {
    const list = grouped.get(submission.country_code) ?? [];
    list.push(submission as SubmissionRecord);
    grouped.set(submission.country_code, list);
  }

  const selections: EntryRecord[] = [];
  const selectedIds: string[] = [];

  for (const [country, countrySubmissions] of grouped.entries()) {
    if (countrySubmissions.length === 0) continue;
    const randomIndex = Math.floor(Math.random() * countrySubmissions.length);
    const chosen = countrySubmissions[randomIndex];
    selectedIds.push(chosen.id);
    selections.push({
      id: crypto.randomUUID(),
      year,
      submission_id: chosen.id,
      country_code: country,
      artist_name: chosen.artist_name,
      song_title: chosen.song_title,
      running_order: null,
      selection_method: "Random",
      vote_total: 0,
      vote_count: 0,
    });
  }

  if (selections.length === 0) {
    return jsonError("No submissions available for selection", 400);
  }

  const { error: entryError } = await supabaseClient
    .from("eurovision_entries")
    .upsert(selections, { onConflict: "year,country_code" });

  if (entryError) {
    return jsonError(entryError.message, 400);
  }

  await supabaseClient
    .from("eurovision_submissions")
    .update({ status: "Selected" })
    .in("id", selectedIds);

  const { error: yearUpdateError } = await supabaseClient
    .from("eurovision_years")
    .update({
      phase: "SelectionsDone",
      submission_window_open: false,
      selection_completed_at: new Date().toISOString(),
    })
    .eq("year", year);

  if (yearUpdateError) {
    return jsonError(yearUpdateError.message, 400);
  }

  return jsonResponse(
    selections.map((entry) => ({
      id: entry.id,
      submissionId: entry.submission_id,
      countryCode: entry.country_code,
      artistName: entry.artist_name,
      songTitle: entry.song_title,
      runningOrder: entry.running_order,
      selectionMethod: "Random" as const,
      voteCount: entry.vote_count,
      pointsTotal: entry.vote_total,
    }))
  );
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function handleStartEvent(
  supabaseClient: ReturnType<typeof createClient>,
  year: number
) {
  const yearRecord = await ensureYear(supabaseClient, year);

  if (yearRecord.phase !== "SelectionsDone") {
    return jsonError("Event can only start after selections", 400);
  }

  const { data: entries, error } = await supabaseClient
    .from("eurovision_entries")
    .select("id, submission_id, country_code, artist_name, song_title, vote_total, vote_count")
    .eq("year", year);

  if (error) {
    return jsonError(error.message, 400);
  }

  const shuffled = shuffle(entries ?? []);
  const runningOrderUpdates = shuffled.map((entry, index) => ({
    id: entry.id,
    running_order: index + 1,
  }));

  await supabaseClient.from("eurovision_entries").upsert(runningOrderUpdates);

  const startedAt = new Date().toISOString();
  const { data: updatedYear, error: yearUpdateError } = await supabaseClient
    .from("eurovision_years")
    .update({ phase: "EventLive", event_started_at: startedAt })
    .eq("year", year)
    .select()
    .single();

  if (yearUpdateError) {
    return jsonError(yearUpdateError.message, 400);
  }

  return jsonResponse({
    year: updatedYear?.year ?? year,
    phase: "EventLive" as EurovisionPhase,
    submissionWindowOpen: false,
    selectionCompletedAt: updatedYear?.selection_completed_at ?? null,
    eventStartedAt: startedAt,
    runningOrder: shuffled.map((entry, index) => ({
      id: entry.id,
      submissionId: entry.submission_id,
      countryCode: entry.country_code,
      artistName: entry.artist_name,
      songTitle: entry.song_title,
      runningOrder: index + 1,
      selectionMethod: "Random" as const,
      voteCount: entry.vote_count,
      pointsTotal: entry.vote_total,
    })),
    maxVotesPerPlayer: MAX_VOTES_PER_PLAYER,
  });
}

async function handleVote(
  supabaseClient: ReturnType<typeof createClient>,
  payload: CastVotePayload
) {
  const yearRecord = await ensureYear(supabaseClient, payload.year);
  if (yearRecord.phase !== "EventLive") {
    return jsonError("Voting is not open", 400);
  }

  const { data: entry, error: entryError } = await supabaseClient
    .from("eurovision_entries")
    .select("id, country_code, year")
    .eq("id", payload.entryId)
    .single();

  if (entryError || !entry) {
    return jsonError("Entry not found", 404);
  }

  if (entry.year !== payload.year) {
    return jsonError("Entry does not belong to this year", 400);
  }

  const { count } = await supabaseClient
    .from("eurovision_votes")
    .select("id", { count: "exact", head: true })
    .eq("year", payload.year)
    .eq("voter_id", payload.voterId);

  if ((count ?? 0) >= MAX_VOTES_PER_PLAYER) {
    return jsonError("Vote limit reached for this player", 400);
  }

  const vote: Omit<VoteRecord, "created_at"> & { created_at?: string } = {
    id: crypto.randomUUID(),
    year: payload.year,
    voter_id: payload.voterId,
    entry_id: payload.entryId,
    points: payload.points,
  };

  const { error: voteError } = await supabaseClient
    .from("eurovision_votes")
    .upsert(vote, { onConflict: "year,voter_id,entry_id" });

  if (voteError) {
    return jsonError(voteError.message, 400);
  }

  const { data: entryVotes, error: tallyError } = await supabaseClient
    .from("eurovision_votes")
    .select("points")
    .eq("entry_id", payload.entryId)
    .eq("year", payload.year);

  if (tallyError) {
    return jsonError(tallyError.message, 400);
  }

  const pointsTotal = (entryVotes ?? []).reduce((sum, row) => sum + (row.points ?? 0), 0);
  const voteCount = entryVotes?.length ?? 0;

  await supabaseClient
    .from("eurovision_entries")
    .update({ vote_total: pointsTotal, vote_count: voteCount })
    .eq("id", payload.entryId);

  return jsonResponse({
    id: vote.id,
    year: payload.year,
    voterId: payload.voterId,
    entryId: payload.entryId,
    points: payload.points,
    castAt: new Date().toISOString(),
  });
}

async function handleAdvancePhase(
  supabaseClient: ReturnType<typeof createClient>,
  payload: AdvancePhasePayload
) {
  const yearRecord = await ensureYear(supabaseClient, payload.year);
  const nextPhase = payload.forcePhase ?? getNextPhase(yearRecord.phase);

  switch (nextPhase) {
    case "SelectionsDone":
      return handleSelections(supabaseClient, payload.year);
    case "EventLive":
      return handleStartEvent(supabaseClient, payload.year);
    case "VotingClosed": {
      const { error } = await supabaseClient
        .from("eurovision_years")
        .update({ phase: "VotingClosed" })
        .eq("year", payload.year);

      if (error) return jsonError(error.message, 400);

      return jsonResponse({
        year: payload.year,
        phase: "VotingClosed" as EurovisionPhase,
        submissionWindowOpen: false,
        runningOrder: [],
        maxVotesPerPlayer: MAX_VOTES_PER_PLAYER,
      });
    }
    case "Results": {
      const { data: entries } = await supabaseClient
        .from("eurovision_entries")
        .select("id, vote_total, vote_count");

      const tally = Object.fromEntries(
        (entries ?? []).map((entry) => [
          entry.id,
          { voteCount: entry.vote_count, points: entry.vote_total },
        ])
      );

      const { error } = await supabaseClient
        .from("eurovision_years")
        .update({ phase: "Results" })
        .eq("year", payload.year);

      if (error) return jsonError(error.message, 400);

      return jsonResponse({
        year: payload.year,
        phase: "Results" as EurovisionPhase,
        submissionWindowOpen: false,
        runningOrder: [],
        maxVotesPerPlayer: MAX_VOTES_PER_PLAYER,
        tally,
      });
    }
    default:
      return jsonResponse(yearRecord);
  }
}

function getNextPhase(current: EurovisionPhase): EurovisionPhase {
  switch (current) {
    case "SubmissionsOpen":
      return "SelectionsDone";
    case "SelectionsDone":
      return "EventLive";
    case "EventLive":
      return "VotingClosed";
    case "VotingClosed":
      return "Results";
    default:
      return current;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}
