import { BAND_PERFORMANCE_ROLES } from "@/data/bandPerformanceRoles";
import { supabase } from "@/integrations/supabase/client";

export const VACANCY_STATUSES = ["draft", "open", "paused", "filled", "closed", "expired", "cancelled"] as const;
export type VacancyStatus = (typeof VACANCY_STATUSES)[number];
export type MatchSummary = { score: number; category: string; reasons: string[] };

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
  application_questions?: { type: string; prompt?: string }[] | null;
  created_at?: string;
  bands?: { name?: string | null; genre?: string | null; logo_url?: string | null } | null;
  match?: MatchSummary;
  saved?: boolean;
};

export type VacancyFormInput = Partial<BandVacancy>;

const htmlTagPattern = /<[^>]*>/g;
export const sanitizeRecruitmentText = (value: string) => value.replace(htmlTagPattern, "").trim();

export const validateVacancyDraft = (input: VacancyFormInput) => {
  const errors: Record<string, string> = {};
  if (sanitizeRecruitmentText(input.title ?? "").length < 3) errors.title = "Add a position title of at least 3 characters.";
  if (!sanitizeRecruitmentText(input.instrument ?? "")) errors.instrument = "Choose the role you are recruiting for.";
  if (sanitizeRecruitmentText(input.description ?? "").length > 4000) errors.description = "Description must be 4,000 characters or fewer.";
  if ((input.positions_available ?? 1) < 1) errors.positions_available = "At least one position is required.";
  if ((input.application_questions?.length ?? 0) > 8) errors.application_questions = "Use 8 application questions or fewer.";
  return errors;
};

export const buildVacancyPayload = (input: VacancyFormInput) => ({
  title: sanitizeRecruitmentText(input.title ?? ""),
  short_description: sanitizeRecruitmentText(input.short_description ?? "").slice(0, 240) || null,
  description: sanitizeRecruitmentText(input.description ?? "").slice(0, 4000),
  visibility: input.visibility ?? "public",
  instrument: sanitizeRecruitmentText(input.instrument ?? ""),
  vocal_role: input.vocal_role || null,
  genres: input.genres ?? [],
  commitment_level: input.commitment_level ?? "flexible",
  positions_available: input.positions_available ?? 1,
  audition_required: input.audition_required ?? false,
  remote_or_travel_allowed: input.remote_or_travel_allowed ?? true,
  direct_applications_allowed: input.direct_applications_allowed ?? true,
  application_deadline: input.application_deadline || null,
  application_questions: input.application_questions ?? [],
});

export async function loadBandPerformanceRoles() {
  return BAND_PERFORMANCE_ROLES;
}

export async function createBandVacancy(bandId: string, profileId: string, input: VacancyFormInput, publish = false) {
  const errors = validateVacancyDraft(input);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);

  const payload = {
    band_id: bandId,
    title: sanitizeRecruitmentText(input.title ?? ""),
    short_description: sanitizeRecruitmentText(input.short_description ?? "").slice(0, 240) || null,
    description: sanitizeRecruitmentText(input.description ?? "").slice(0, 4000),
    status: publish ? "open" : "draft",
    visibility: input.visibility ?? "public",
    role_type: "member",
    instrument: input.instrument!,
    vocal_role: input.vocal_role || null,
    genres: input.genres ?? [],
    commitment_level: input.commitment_level ?? "flexible",
    positions_available: input.positions_available ?? 1,
    audition_required: input.audition_required ?? false,
    remote_or_travel_allowed: input.remote_or_travel_allowed ?? true,
    direct_applications_allowed: input.direct_applications_allowed ?? true,
    application_deadline: input.application_deadline || null,
    created_by_profile_id: profileId,
  };

  const { data, error } = await supabase.from("band_vacancies" as never).insert(payload as never).select("*").single();
  if (error) throw error;
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

export async function updateBandVacancyStatus(vacancyId: string, status: VacancyStatus) {
  const { error } = await supabase
    .from("band_vacancies" as never)
    .update({ status, updated_at: new Date().toISOString() } as never)
    .eq("id", vacancyId);
  if (error) throw error;
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

export async function applyToVacancy(vacancy: BandVacancy, _applicantProfileId: string, coverMessage: string) {
  if (!vacancy.direct_applications_allowed) throw new Error("This band is not accepting direct applications for this role.");
  const { data, error } = await supabase.rpc("submit_band_vacancy_application", {
    target_vacancy_id: vacancy.id,
    cover: sanitizeRecruitmentText(coverMessage).slice(0, 500),
    answers: {},
  });
  if (error?.code === "23505") throw new Error("You already have a pending application for this role.");
  if (error) throw error;
  if (!data) throw new Error("Band application could not be submitted.");
  return data;
}
