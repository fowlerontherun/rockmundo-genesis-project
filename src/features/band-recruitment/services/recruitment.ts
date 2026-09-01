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
  const slugs = [
    "guitar", "bass", "drums", "basic_keyboard", "basic_percussions", "basic_strings",
    "basic_brass", "basic_woodwinds", "basic_electronic_instruments", "basic_dj_controller",
    "basic_singing", "basic_rapping",
  ];
  const { data, error } = await supabase
    .from("skill_definitions")
    .select("slug, display_name")
    .in("slug", slugs);
  if (error) throw error;
  const bySlug = new Map((data ?? []).map((row) => [row.slug, row.display_name]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((name): name is string => Boolean(name))
    .map((name) => name.replace(/^Basic\s+/i, "").trim());
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

export async function applyToVacancy(vacancy: BandVacancy, applicantProfileId: string, coverMessage: string) {
  if (!vacancy.direct_applications_allowed) throw new Error("This band is not accepting direct applications for this role.");
  const { data: existingMembership } = await supabase
    .from("band_members")
    .select("id")
    .eq("band_id", vacancy.band_id)
    .eq("profile_id", applicantProfileId)
    .maybeSingle();
  if (existingMembership) throw new Error("You are already a member of this band.");

  const { data, error } = await supabase
    .from("band_applications" as never)
    .insert({
      band_id: vacancy.band_id,
      vacancy_id: vacancy.id,
      applicant_profile_id: applicantProfileId,
      instrument_role: vacancy.instrument,
      vocal_role: vacancy.vocal_role || null,
      message: sanitizeRecruitmentText(coverMessage).slice(0, 2000),
      status: "pending",
    } as never)
    .select("*")
    .single();
  if ((error as any)?.code === "23505") throw new Error("You already have a pending application for this role.");
  if (error) throw error;
  return data;
}
