// @ts-nocheck
import { supabase } from "@/lib/supabase-client";
import type { Tables, TablesInsert } from "@/lib/supabase-types";

export type CastingCallRecord = Tables<"casting_calls">;
export type CastingCallRoleRecord = Tables<"casting_call_roles">;
export type CastingSubmissionRecord = Tables<"casting_submissions">;
export type CastingReviewRecord = Tables<"casting_reviews">;

export interface CastingCallSummary extends CastingCallRecord {
  roles: CastingCallRoleRecord[];
  submissionStats: {
    total: number;
    submitted: number;
    underReview: number;
    shortlisted: number;
    callbacks: number;
    hired: number;
    declined: number;
  };
}

export interface CastingCallFilters {
  searchTerm?: string;
  projectTypes?: string[];
  unionStatuses?: string[];
  statuses?: string[];
  location?: string;
  remoteOnly?: boolean;
}

export interface SubmitCastingSubmissionInput {
  castingCallId: string;
  talentProfileId: string;
  castingCallRoleId?: string | null;
  coverLetter?: string | null;
  experienceSummary?: string | null;
  portfolioUrl?: string | null;
  resumeUrl?: string | null;
  auditionVideoUrl?: string | null;
  status?: CastingSubmissionRecord["status"];
}

export interface SubmitCastingReviewInput {
  submissionId: string;
  reviewerProfileId: string | null;
  decision: CastingReviewRecord["decision"];
  feedback?: string | null;
  score?: number | null;
  statusUpdate?: CastingSubmissionRecord["status"];
}

type CastingCallQueryRow = CastingCallRecord & {
  casting_call_roles: CastingCallRoleRecord[] | null;
  casting_submissions: Array<Pick<CastingSubmissionRecord, "id" | "status" | "talent_profile_id">> | null;
};

type CastingSubmissionQueryRow = CastingSubmissionRecord & {
  casting_call: Pick<CastingCallRecord, "id" | "title" | "project_type" | "location" | "application_deadline"> | null;
  role: Pick<CastingCallRoleRecord, "id" | "name" | "role_type"> | null;
  casting_reviews: CastingReviewRecord[] | null;
};

const CASTING_CALL_SELECT = `*,
  casting_call_roles (*),
  casting_submissions (id, status, talent_profile_id)`;

const SUBMISSION_SELECT = `*,
  casting_call:casting_calls (id, title, project_type, location, application_deadline),
  role:casting_call_roles (id, name, role_type),
  casting_reviews (*)`;

const mapCastingCall = (row: CastingCallQueryRow): CastingCallSummary => {
  const submissions = row.casting_submissions ?? [];
  const statusCounts = submissions.reduce(
    (acc, submission) => {
      acc.total += 1;
      switch (submission.status) {
        case "submitted":
          acc.submitted += 1;
          break;
        case "under_review":
          acc.underReview += 1;
          break;
        case "shortlisted":
          acc.shortlisted += 1;
          break;
        case "callback":
          acc.callbacks += 1;
          break;
        case "hired":
          acc.hired += 1;
          break;
        case "declined":
          acc.declined += 1;
          break;
        default:
          break;
      }
      return acc;
    },
    { total: 0, submitted: 0, underReview: 0, shortlisted: 0, callbacks: 0, hired: 0, declined: 0 },
  );

  const { casting_call_roles, casting_submissions, ...call } = row;

  return {
    ...call,
    roles: casting_call_roles ?? [],
    submissionStats: statusCounts,
  };
};

export const listCastingCalls = async (
  filters: CastingCallFilters = {},
): Promise<CastingCallSummary[]> => {
  let query = supabase
    .from("casting_calls")
    .select(CASTING_CALL_SELECT)
    .order("application_deadline", { ascending: true });

  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in("status", filters.statuses);
  }

  if (filters.projectTypes && filters.projectTypes.length > 0) {
    query = query.in("project_type", filters.projectTypes);
  }

  if (filters.unionStatuses && filters.unionStatuses.length > 0) {
    query = query.in("union_status", filters.unionStatuses);
  }

  if (filters.remoteOnly) {
    query = query.eq("is_remote_friendly", true);
  }

  if (filters.location && filters.location.trim().length > 0) {
    query = query.ilike("location", `%${filters.location.trim()}%`);
  }

  if (filters.searchTerm && filters.searchTerm.trim().length > 0) {
    const term = filters.searchTerm.trim();
    query = query.or(
      `title.ilike.%${term}%,description.ilike.%${term}%,project_type.ilike.%${term}%,location.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data as CastingCallQueryRow[] | null)?.map(mapCastingCall) ?? [];
};

export const getCastingCallById = async (id: string): Promise<CastingCallSummary | null> => {
  const { data, error } = await supabase
    .from("casting_calls")
    .select(CASTING_CALL_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapCastingCall(data as CastingCallQueryRow);
};

export const listCastingSubmissionsByProfile = async (
  profileId: string,
): Promise<(CastingSubmissionRecord & CastingSubmissionQueryRow)[]> => {
  const { data, error } = await supabase
    .from("casting_submissions")
    .select(SUBMISSION_SELECT)
    .eq("talent_profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data as CastingSubmissionQueryRow[] | null)?.map((row) => ({
    ...row,
    casting_call: row.casting_call,
    role: row.role,
    casting_reviews: row.casting_reviews ?? [],
  })) ?? [];
};

export const listCastingSubmissionsForReview = async (
  statuses: CastingSubmissionRecord["status"][] = ["submitted", "under_review"],
): Promise<CastingSubmissionQueryRow[]> => {
  const { data, error } = await supabase
    .from("casting_submissions")
    .select(SUBMISSION_SELECT)
    .in("status", statuses)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as CastingSubmissionQueryRow[] | null)?.map((row) => ({
    ...row,
    casting_reviews: row.casting_reviews ?? [],
  })) ?? [];
};

export const submitCastingSubmission = async (
  input: SubmitCastingSubmissionInput,
): Promise<CastingSubmissionQueryRow> => {
  const payload: TablesInsert<"casting_submissions"> = {
    casting_call_id: input.castingCallId,
    casting_call_role_id: input.castingCallRoleId ?? null,
    talent_profile_id: input.talentProfileId,
    cover_letter: input.coverLetter ?? null,
    experience_summary: input.experienceSummary ?? null,
    portfolio_url: input.portfolioUrl ?? null,
    resume_url: input.resumeUrl ?? null,
    audition_video_url: input.auditionVideoUrl ?? null,
    status: input.status ?? "submitted",
  };

  const { data, error } = await supabase
    .from("casting_submissions")
    .insert(payload)
    .select(SUBMISSION_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const row = data as CastingSubmissionQueryRow;
  return {
    ...row,
    casting_reviews: row.casting_reviews ?? [],
  };
};

export const updateCastingSubmissionStatus = async (
  submissionId: string,
  status: CastingSubmissionRecord["status"],
): Promise<void> => {
  const { error } = await supabase
    .from("casting_submissions")
    .update({ status })
    .eq("id", submissionId);

  if (error) {
    throw error;
  }
};

export const submitCastingReview = async (
  input: SubmitCastingReviewInput,
): Promise<CastingReviewRecord> => {
  const reviewPayload: TablesInsert<"casting_reviews"> = {
    submission_id: input.submissionId,
    reviewer_profile_id: input.reviewerProfileId ?? null,
    decision: input.decision,
    feedback: input.feedback ?? null,
    score: input.score ?? null,
  };

  const { data, error } = await supabase
    .from("casting_reviews")
    .insert(reviewPayload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (input.statusUpdate) {
    await updateCastingSubmissionStatus(input.submissionId, input.statusUpdate);
  }

  return data as CastingReviewRecord;
};

export const deleteCastingSubmission = async (submissionId: string): Promise<void> => {
  const { error } = await supabase
    .from("casting_submissions")
    .delete()
    .eq("id", submissionId);

  if (error) {
    throw error;
  }
};

export type CastingSubmissionWithRelations = CastingSubmissionQueryRow;
