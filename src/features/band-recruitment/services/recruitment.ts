import { supabase } from "@/integrations/supabase/client";

export const VACANCY_STATUSES = ["draft", "open", "paused", "filled", "closed", "expired", "cancelled"] as const;
export type VacancyStatus = (typeof VACANCY_STATUSES)[number];
export const APPLICATION_STAGES = ["new", "under_review", "shortlisted", "audition_requested", "offer_made", "accepted", "rejected", "withdrawn"] as const;

export type MatchSummary = { score: number; category: string; reasons: string[] };
export type BandVacancy = {
  id: string; band_id: string; title: string; short_description?: string | null; description: string; status: VacancyStatus; visibility: string;
  role_type: string; instrument: string; genres: string[]; commitment_level: string; positions_available: number; positions_filled: number;
  application_deadline?: string | null; audition_required: boolean; remote_or_travel_allowed: boolean;
  bands?: { name?: string | null; genre?: string | null; avatar_url?: string | null } | null;
  match?: MatchSummary; application_status?: string | null; saved?: boolean;
};

export type VacancyFormInput = Partial<BandVacancy> & {
  secondary_instruments?: string[]; city_id?: string | null; rehearsal_expectation?: string; gig_expectation?: string;
  touring_required?: boolean; direct_applications_allowed?: boolean; application_questions?: unknown[];
};

const htmlTagPattern = /<[^>]*>/g;
export const sanitizeRecruitmentText = (value: string) => value.replace(htmlTagPattern, "").trim();

export const validateVacancyDraft = (input: VacancyFormInput) => {
  const errors: Record<string, string> = {};
  if (!sanitizeRecruitmentText(input.title ?? "") || sanitizeRecruitmentText(input.title ?? "").length < 3) errors.title = "Add a position title of at least 3 characters.";
  if (sanitizeRecruitmentText(input.description ?? "").length > 4000) errors.description = "Description must be 4,000 characters or fewer.";
  if ((input.application_questions?.length ?? 0) > 8) errors.application_questions = "Use 8 questions or fewer.";
  if ((input.positions_available ?? 1) < 1) errors.positions_available = "At least one position is required.";
  return errors;
};

export const buildVacancyPayload = (input: VacancyFormInput) => ({
  ...input,
  title: sanitizeRecruitmentText(input.title ?? ""),
  short_description: sanitizeRecruitmentText(input.short_description ?? ""),
  description: sanitizeRecruitmentText(input.description ?? ""),
  genres: input.genres ?? [],
  application_questions: input.application_questions ?? [],
});

export async function createBandVacancy(bandId: string, input: VacancyFormInput, publish = false) {
  const errors = validateVacancyDraft(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const { data, error } = await supabase.rpc("create_band_vacancy" as never, { target_band_id: bandId, vacancy_payload: buildVacancyPayload(input), publish } as never);
  if (error) throw error;
  return data as unknown as BandVacancy;
}

export async function searchBandVacancies(filters: Record<string, string | boolean | undefined> = {}, page = 0, pageSize = 20) {
  let query = supabase.from("band_vacancies" as never).select("*, bands(name, genre, avatar_url)").eq("status", "open").eq("visibility", "public").range(page * pageSize, page * pageSize + pageSize - 1).order("created_at", { ascending: false });
  if (filters.instrument) query = query.eq("instrument", filters.instrument as string);
  if (filters.commitment_level) query = query.eq("commitment_level", filters.commitment_level as string);
  if (typeof filters.audition_required === "boolean") query = query.eq("audition_required", filters.audition_required);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as BandVacancy[];
}

export async function applyToVacancy(vacancyId: string, coverMessage: string, answers: Record<string, unknown>) {
  const { data, error } = await supabase.rpc("submit_band_vacancy_application" as never, { target_vacancy_id: vacancyId, cover: sanitizeRecruitmentText(coverMessage).slice(0, 2000), answers } as never);
  if (error) throw error;
  return data;
}

export async function updateApplicationStage(applicationId: string, nextStatus: string) {
  const { data, error } = await supabase.rpc("update_band_application_stage" as never, { application_id: applicationId, next_status: nextStatus } as never);
  if (error) throw error;
  return data;
}

export async function acceptBandOffer(offerId: string) {
  const { data, error } = await supabase.rpc("accept_band_offer" as never, { offer_id: offerId } as never);
  if (error) throw error;
  return data;
}
