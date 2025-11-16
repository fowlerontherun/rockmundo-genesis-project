// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";
import {
  calculateNextTrainingSession,
  type TrainingCadence,
  type TrainingScheduleOptions,
} from "@/lib/schedulers/training";

export type TrainingDifficulty = "beginner" | "intermediate" | "advanced";
export type TrainingFormat = "self-paced" | "cohort" | "live";

export interface TrainingCourseRecord {
  id: string;
  title: string;
  description: string;
  focus: string;
  difficulty: TrainingDifficulty;
  cadence: TrainingCadence;
  sessions_per_week: number;
  duration_weeks: number;
  format: TrainingFormat;
  mentor?: string | null;
  price?: number | null;
  default_weekdays?: number[] | null;
  default_start_time?: string | null;
  session_duration_minutes?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type TrainingEnrollmentStatus = "enrolled" | "in_progress" | "completed" | "dropped";

export interface TrainingEnrollmentRecord {
  id: string;
  profile_id: string;
  course_id: string;
  status: TrainingEnrollmentStatus;
  progress: number;
  last_session_at?: string | null;
  next_session_at?: string | null;
  preferred_weekdays?: number[] | null;
  preferred_start_time?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface UpsertTrainingEnrollmentInput {
  profileId: string;
  course: TrainingCourseRecord;
  progress?: number;
  status?: TrainingEnrollmentStatus;
  lastSessionAt?: string | null;
  preferredWeekdays?: number[] | null;
  preferredStartTime?: string | null;
  startDate?: Date;
}

const FALLBACK_COURSES: TrainingCourseRecord[] = [
  {
    id: "creative-arrangement-101",
    title: "Creative Arrangement Fundamentals",
    description:
      "Structure dynamic arrangements that translate studio ideas into show-ready performances.",
    focus: "arrangement",
    difficulty: "beginner",
    cadence: "weekly",
    sessions_per_week: 2,
    duration_weeks: 6,
    format: "cohort",
    mentor: "Ava Sinclair",
    price: 120,
    default_weekdays: [2, 5],
    default_start_time: "18:30",
    session_duration_minutes: 75,
  },
  {
    id: "stagecraft-express",
    title: "Stagecraft Express Lab",
    description:
      "Polish your stage presence with rapid-fire workshops and feedback from touring directors.",
    focus: "performance",
    difficulty: "intermediate",
    cadence: "weekly",
    sessions_per_week: 3,
    duration_weeks: 4,
    format: "live",
    mentor: "Marco Reyes",
    price: 240,
    default_weekdays: [1, 3, 5],
    default_start_time: "17:00",
    session_duration_minutes: 90,
  },
  {
    id: "daily-vocal-fix",
    title: "Daily Vocal Repair Routine",
    description:
      "Targeted vocal maintenance drills to expand range and recover faster between demanding shows.",
    focus: "vocals",
    difficulty: "advanced",
    cadence: "daily",
    sessions_per_week: 5,
    duration_weeks: 8,
    format: "self-paced",
    mentor: "Sumi Takahashi",
    price: 90,
    default_weekdays: [1, 2, 3, 4, 5],
    default_start_time: "09:00",
    session_duration_minutes: 35,
  },
  {
    id: "production-lab",
    title: "Hybrid Production Lab",
    description:
      "Blend analog warmth with digital precision in collaborative studio challenges each week.",
    focus: "production",
    difficulty: "intermediate",
    cadence: "biweekly",
    sessions_per_week: 1,
    duration_weeks: 10,
    format: "cohort",
    mentor: "Nova Chambers",
    price: 360,
    default_weekdays: [6],
    default_start_time: "11:00",
    session_duration_minutes: 120,
  },
];

const mapCourseRecord = (record: any): TrainingCourseRecord => ({
  id: record.id,
  title: record.title,
  description: record.description,
  focus: record.focus ?? record.focus_area ?? "general",
  difficulty: record.difficulty,
  cadence: record.cadence,
  sessions_per_week: Number(record.sessions_per_week ?? 1),
  duration_weeks: Number(record.duration_weeks ?? 1),
  format: record.format,
  mentor: record.mentor ?? null,
  price: record.price ?? null,
  default_weekdays: Array.isArray(record.default_weekdays)
    ? record.default_weekdays
    : Array.isArray(record.default_week_days)
      ? record.default_week_days
      : null,
  default_start_time: record.default_start_time ?? null,
  session_duration_minutes: record.session_duration_minutes
    ? Number(record.session_duration_minutes)
    : null,
  created_at: record.created_at ?? null,
  updated_at: record.updated_at ?? null,
});

const coerceWeekdayArray = (value: any): number[] | null => {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(Number).filter((day) => !Number.isNaN(day));
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(Number).filter((day) => !Number.isNaN(day));
      }
    } catch (error) {
      console.warn("Unable to parse preferred weekdays", error);
    }
  }

  return null;
};

const mapEnrollmentRecord = (record: any): TrainingEnrollmentRecord => ({
  id: record.id,
  profile_id: record.profile_id,
  course_id: record.course_id,
  status: record.status ?? "enrolled",
  progress: Number(record.progress ?? 0),
  last_session_at: record.last_session_at ?? null,
  next_session_at: record.next_session_at ?? null,
  preferred_weekdays: coerceWeekdayArray(record.preferred_weekdays),
  preferred_start_time: record.preferred_start_time ?? null,
  created_at: record.created_at ?? null,
  updated_at: record.updated_at ?? null,
});

export const listTrainingCourses = async (): Promise<TrainingCourseRecord[]> => {
  const { data, error } = await supabase
    .from("training_courses")
    .select("*")
    .order("title", { ascending: true });

  if (error) {
    console.warn("Failed to fetch training courses, using fallback", error.message);
    return FALLBACK_COURSES;
  }

  if (!data) {
    return FALLBACK_COURSES;
  }

  return data.map(mapCourseRecord);
};

export const listTrainingEnrollments = async (
  profileId: string | null | undefined
): Promise<TrainingEnrollmentRecord[]> => {
  if (!profileId) {
    return [];
  }

  const { data, error } = await supabase
    .from("training_enrollments")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Failed to fetch training enrollments", error.message);
    return [];
  }

  return (data ?? []).map(mapEnrollmentRecord);
};

const buildScheduleOptions = (
  course: TrainingCourseRecord,
  overrides: Partial<TrainingScheduleOptions> = {}
): TrainingScheduleOptions => ({
  cadence: course.cadence,
  sessionsPerWeek: course.sessions_per_week,
  preferredWeekdays: overrides.preferredWeekdays ?? course.default_weekdays ?? undefined,
  preferredTime: overrides.preferredTime ?? course.default_start_time ?? undefined,
  startDate: overrides.startDate ?? new Date(),
  lastCompletedAt: overrides.lastCompletedAt,
});

export const upsertTrainingEnrollment = async (
  input: UpsertTrainingEnrollmentInput
): Promise<TrainingEnrollmentRecord> => {
  const {
    profileId,
    course,
    progress = 0,
    status = "enrolled",
    lastSessionAt,
    preferredWeekdays,
    preferredStartTime,
    startDate,
  } = input;

  if (!profileId) {
    throw new Error("A valid profile ID is required to enroll in training courses.");
  }

  const scheduleOptions = buildScheduleOptions(course, {
    preferredWeekdays,
    preferredTime: preferredStartTime,
    startDate,
    lastCompletedAt: lastSessionAt ? new Date(lastSessionAt) : undefined,
  });

  const nextSession = calculateNextTrainingSession(scheduleOptions);

  const payload = {
    profile_id: profileId,
    course_id: course.id,
    status,
    progress,
    last_session_at: lastSessionAt ?? null,
    next_session_at: nextSession?.toISOString() ?? null,
    preferred_weekdays: preferredWeekdays ?? course.default_weekdays ?? null,
    preferred_start_time: preferredStartTime ?? course.default_start_time ?? null,
  } satisfies Partial<TrainingEnrollmentRecord> & {
    profile_id: string;
    course_id: string;
  };

  const { data, error } = await supabase
    .from("training_enrollments")
    .upsert(payload, { onConflict: "profile_id,course_id" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Failed to persist training enrollment.");
  }

  return mapEnrollmentRecord(data);
};
