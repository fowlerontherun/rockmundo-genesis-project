import { BAND_PERFORMANCE_ROLES } from "@/data/bandPerformanceRoles";
import { supabase } from "@/integrations/supabase/client";

export const VACANCY_STATUSES = ["draft", "open", "paused", "filled", "closed", "expired", "cancelled"] as const;
export type VacancyStatus = (typeof VACANCY_STATUSES)[number];
export type MatchSummary = { score: number; category: string; reasons: string[] };
export type ApplicationQuestion = { type: "text"; prompt: string; required?: boolean };

export type BandVacancy = {
  id: string;
  band_id: string;
  title: string;
  short_description?: string | null;
  description: string;
  status: VacancyStatus;
  visibility: string;
  role_type: string;
  instrument: string;
  vocal_role?: string | null;
  genres: string[];
  commitment_level: string;
  positions_available: number;
  positions_filled: number;
  application_deadline?: string | null;
  audition_required: boolean;
  remote_or_travel_allowed: boolean;
  direct_applications_allowed: boolean;
  application_questions?: ApplicationQuestion[] | null;
  created_at?: string;
  bands?: { name?: string | null; genre?: string | null; logo_url?: string | null } | null;
  match?: MatchSummary;
  saved?: boolean;
};

export type VacancyFormInput = Partial<BandVacancy>;

const htmlTagPattern = /<[^>]*>/g;
export const sanitizeRecruitmentText = (value: string) => value.replace(htmlTagPattern, "").trim();

export const normalizeApplicationQuestions = (questions: ApplicationQuestion[] | null | undefined): ApplicationQuestion[] =>
  (questions ?? [])
    .map((question) => ({
      type: "text" as const,
      prompt: sanitizeRecruitmentText(question.prompt ?? "").slice(0, 240),
      required: question.required ?? true,
    }))
    .filter((question) => question.prompt.length > 0)
    .slice(0, 8);

export const validateVacancyDraft = (input: VacancyFormInput) => {
  const errors: Record<string, string> = {};
  const title = sanitizeRecruitmentText(input.title ?? "");
  if (title.length < 3 || title.length > 120) errors.title = "Add a position title between 3 and 120 characters.";
  if (!sanitizeRecruitmentText(input.instrument ?? "")) errors.instrument = "Choose the role you are recruiting for.";
  if (sanitizeRecruitmentText(input.description ?? "").length > 4000) errors.description = "Description must be 4,000 characters or fewer.";
  if ((input.positions_available ?? 1) < 1 || (input.positions_available ?? 1) > 20) errors.positions_available = "Choose between 1 and 20 positions.";
  if ((input.application_questions?.length ?? 0) > 8) errors.application_questions = "Use 8 application questions or fewer.";
  return errors;
};

export const buildVacancyPayload = (input: VacancyFormInput) => ({
  title: sanitizeRecruitmentText(input.title ?? ""),
  short_description: sanitizeRecruitmentText(input.short_description ?? "").slice(0, 240) || null,
  description: sanitizeRecruitmentText(input.description ?? "").slice(0, 4000),
  visibility: input.visibility ?? "public",
  instrument: sanitizeRecruitmentText(input.instrument ?? ""),
  vocal_role: sanitizeRecruitmentText(input.vocal_role ?? "") || null,
  genres: input.genres ?? [],
  commitment_level: input.commitment_level ?? "flexible",
  positions_available: input.positions_available ?? 1,
  audition_required: input.audition_required ?? false,
  remote_or_travel_allowed: input.remote_or_travel_allowed ?? true,
  direct_applications_allowed: input.direct_applications_allowed ?? true,
  application_deadline: input.application_deadline || null,
  application_questions: normalizeApplicationQuestions(input.application_questions),
});

export async function loadBandPerformanceRoles() {
  return BAND_PERFORMANCE_ROLES;
}

export async function createBandVacancy(bandId: string, _profileId: string, input: VacancyFormInput, publish = false) {
  const errors = validateVacancyDraft(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);

  const { data, error } = await supabase.rpc("create_band_vacancy" as never, {
    target_band_id: bandId,
    vacancy_payload: buildVacancyPayload(input),
    publish,
  } as never);
  if (error) throw new Error(error.message || "Could not save band advert.");
  if (!data) throw new Error("Band advert could not be saved.");
  return data as unknown as BandVacancy;
}

export async function listBandVacancies(bandId: string) {
  const { data, error } = await supabase
    .from("band_vacancies" as never)
    .select("*")
    .eq("band_id", bandId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BandVacancy[];
}

export async function updateBandVacancyStatus(vacancyId: string, status: "open" | "paused" | "closed" | "cancelled") {
  const { data, error } = await supabase.rpc("update_band_vacancy_status" as never, {
    target_vacancy_id: vacancyId,
    next_status: status,
  } as never);
  if (error) throw new Error(error.message || "Could not update band advert.");
  if (!data) throw new Error("Band advert status could not be updated.");
  return data as unknown as BandVacancy;
}

export async function deleteBandVacancy(vacancyId: string) {
  const { data, error } = await supabase.rpc("delete_band_vacancy" as never, { target_vacancy_id: vacancyId } as never);
  if (error) throw new Error(error.message || "Could not delete band advert.");
  return Boolean(data);
}

export async function searchBandVacancies(filters: Record<string, string | boolean | undefined> = {}, page = 0, pageSize = 20) {
  let query = supabase
    .from("band_vacancies" as never)
    .select("*, bands(name, genre, logo_url)")
    .eq("status", "open")
    .eq("visibility", "public")
    .range(page * pageSize, page * pageSize + pageSize - 1)
    .order("created_at", { ascending: false });
  if (filters.instrument) query = query.eq("instrument", filters.instrument as string);
  if (filters.commitment_level) query = query.eq("commitment_level", filters.commitment_level as string);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as BandVacancy[];
}

export async function applyToVacancy(
  vacancy: BandVacancy,
  _applicantProfileId: string,
  coverMessage: string,
  answers: Record<string, string> = {},
) {
  if (!vacancy.direct_applications_allowed) throw new Error("This band is not accepting direct applications for this role.");
  const requiredQuestions = normalizeApplicationQuestions(vacancy.application_questions).filter((question) => question.required !== false);
  if (requiredQuestions.some((question) => !sanitizeRecruitmentText(answers[question.prompt] ?? ""))) {
    throw new Error("Answer all required application questions.");
  }

  const { data, error } = await supabase.rpc("submit_band_vacancy_application" as never, {
    target_vacancy_id: vacancy.id,
    cover: sanitizeRecruitmentText(coverMessage).slice(0, 500),
    answers: Object.fromEntries(
      Object.entries(answers).map(([key, value]) => [sanitizeRecruitmentText(key), sanitizeRecruitmentText(value).slice(0, 1000)]),
    ),
  } as never);
  if (error?.code === "23505") throw new Error("You already have a pending band application.");
  if (error) throw new Error(error.message || "Band application failed.");
  if (!data) throw new Error("Band application could not be submitted.");
  return data;
}
