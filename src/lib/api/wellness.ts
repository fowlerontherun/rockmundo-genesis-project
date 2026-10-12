import { differenceInCalendarDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getActiveProfile } from "@/services/profileService";

export interface HealthStat {
  id: string;
  label: string;
  value: number;
  unit?: string;
  change?: number;
  changeDirection?: "up" | "down";
  description?: string;
}

export type AppointmentStatus = "confirmed" | "pending" | "completed" | "cancelled";

export interface WellnessAppointment {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  type: string;
  status: AppointmentStatus;
  notes?: string;
}

export type HabitFrequency = "daily" | "weekly" | "custom";

export interface HabitTrackerEntry {
  id: string;
  name: string;
  description?: string;
  category?: string;
  frequency: HabitFrequency;
  targetPerWeek: number;
  streak: number;
  lastCompletedDate?: string | null;
  completedDates: string[];
}

export interface WellnessOverviewData {
  healthStats: HealthStat[];
  appointments: WellnessAppointment[];
  habits: HabitTrackerEntry[];
  lastUpdated: string;
}

const WELLNESS_STORAGE_KEY = "wellness-overview";

const defaultWellnessData: WellnessOverviewData = {
  healthStats: [
    {
      id: "resting-heart-rate",
      label: "Resting Heart Rate",
      value: 62,
      unit: "bpm",
      change: -3,
      changeDirection: "down",
      description: "Sample indicator only; not a measured health reading.",
    },
    {
      id: "sleep-quality",
      label: "Sleep Quality",
      value: 85,
      unit: "%",
      change: 4,
      changeDirection: "up",
      description: "Sample indicator only; not a measured health reading.",
    },
    {
      id: "hydration",
      label: "Hydration",
      value: 92,
      unit: "%",
      change: 6,
      changeDirection: "up",
      description: "Sample indicator only; not a measured health reading.",
    },
    {
      id: "stress-index",
      label: "Stress Index",
      value: 34,
      unit: "%",
      change: -5,
      changeDirection: "down",
      description: "Sample indicator only; not a measured health reading.",
    },
  ],
  appointments: [
    {
      id: "appt-physio",
      title: "Physical Therapy",
      date: new Date().toISOString(),
      time: "09:30",
      location: "City Performance Clinic",
      type: "Recovery",
      status: "confirmed",
      notes: "Sample appointment — not a confirmed booking.",
    },
    {
      id: "appt-nutrition",
      title: "Nutrition Check-In",
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      time: "14:00",
      location: "Harmony Wellness Center",
      type: "Consultation",
      status: "pending",
      notes: "Sample appointment — not a confirmed booking.",
    },
  ],
  habits: [
    {
      id: "habit-hydration",
      name: "Hydration Log",
      description: "Log at least 8 glasses of water each day.",
      category: "Recovery",
      frequency: "daily",
      targetPerWeek: 7,
      streak: 3,
      lastCompletedDate: null,
      completedDates: [],
    },
    {
      id: "habit-mobility",
      name: "Mobility Flow",
      description: "10 minute morning mobility routine.",
      category: "Movement",
      frequency: "daily",
      targetPerWeek: 6,
      streak: 5,
      lastCompletedDate: null,
      completedDates: [],
    },
    {
      id: "habit-journal",
      name: "Evening Journal",
      description: "Reflect on energy levels and focus after gigs.",
      category: "Mindset",
      frequency: "daily",
      targetPerWeek: 5,
      streak: 2,
      lastCompletedDate: null,
      completedDates: [],
    },
  ],
  lastUpdated: new Date().toISOString(),
};

const inMemoryStore = new Map<string, WellnessOverviewData>();

const cloneData = (data: WellnessOverviewData): WellnessOverviewData =>
  JSON.parse(JSON.stringify(data)) as WellnessOverviewData;

export const getDateKey = (date: Date): string => date.toISOString().split("T")[0];

const getScopedStorageKey = async (): Promise<string | null> => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) return null;
  const profile = await getActiveProfile(user.id);
  return profile ? `${WELLNESS_STORAGE_KEY}:${user.id}:${profile.id}` : null;
};

const loadFromStorage = async (): Promise<WellnessOverviewData> => {
  const key = await getScopedStorageKey();
  if (!key) return cloneData(defaultWellnessData);
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (raw) return cloneData(JSON.parse(raw) as WellnessOverviewData);
  } catch (error) {
    console.warn("Unable to load stored wellness data", error);
  }
  return cloneData(inMemoryStore.get(key) ?? defaultWellnessData);
};

const persistToStorage = async (data: WellnessOverviewData): Promise<void> => {
  const key = await getScopedStorageKey();
  if (!key) return;
  const snapshot = cloneData(data);
  inMemoryStore.set(key, snapshot);
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Keep the active character's data in memory when storage is unavailable.
  }
};

const calculateDailyStreak = (
  completedDates: string[],
  referenceDate: string
): number => {
  if (!completedDates.length) {
    return 0;
  }

  const dateSet = new Set(completedDates);
  let streak = 0;
  const cursor = new Date(referenceDate);

  while (streak < completedDates.length) {
    const key = getDateKey(cursor);
    if (!dateSet.has(key)) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

const updateHabitMetadata = (
  habit: HabitTrackerEntry,
  referenceDateKey: string
): HabitTrackerEntry => {
  const sortedDates = [...habit.completedDates].sort();
  const lastCompletedDate = sortedDates.length
    ? sortedDates[sortedDates.length - 1]
    : null;

  const streak = calculateDailyStreak(sortedDates, referenceDateKey);

  return {
    ...habit,
    streak,
    lastCompletedDate,
    completedDates: sortedDates,
  };
};

const sanitizeWellnessData = (
  data: WellnessOverviewData,
  referenceDateKey: string
): WellnessOverviewData => {
  const habits = data.habits.map(habit =>
    updateHabitMetadata(habit, referenceDateKey)
  );

  return {
    ...data,
    habits,
    lastUpdated: new Date().toISOString(),
  };
};

export const fetchWellnessOverview = async (): Promise<WellnessOverviewData> => {
  const referenceDateKey = getDateKey(new Date());
  const data = await loadFromStorage();
  return sanitizeWellnessData(data, referenceDateKey);
};

export const setHabitCompletion = async (
  habitId: string,
  dateKey: string,
  completed: boolean
): Promise<WellnessOverviewData> => {
  const data = await loadFromStorage();
  const habits = data.habits.map(habit => {
    if (habit.id !== habitId) {
      return habit;
    }

    const completionSet = new Set(habit.completedDates);

    if (completed) {
      completionSet.add(dateKey);
    } else {
      completionSet.delete(dateKey);
    }

    return {
      ...habit,
      completedDates: Array.from(completionSet),
    };
  });

  const updated = sanitizeWellnessData(
    {
      ...data,
      habits,
    },
    getDateKey(new Date())
  );

  await persistToStorage(updated);
  return cloneData(updated);
};

export const logCustomHabitCompletion = async (
  habitId: string,
  completionDateIso: string
): Promise<WellnessOverviewData> => {
  const data = await loadFromStorage();
  const referenceKey = getDateKey(new Date());
  const normalizedDate = getDateKey(parseISO(completionDateIso));

  const habits = data.habits.map(habit => {
    if (habit.id !== habitId) {
      return habit;
    }

    const completionSet = new Set(habit.completedDates);
    completionSet.add(normalizedDate);

    return {
      ...habit,
      completedDates: Array.from(completionSet),
    };
  });

  const updated = sanitizeWellnessData(
    {
      ...data,
      habits,
    },
    referenceKey
  );

  await persistToStorage(updated);
  return cloneData(updated);
};

export const upsertAppointment = async (
  appointment: WellnessAppointment
): Promise<WellnessOverviewData> => {
  const data = await loadFromStorage();
  const appointments = data.appointments.some(item => item.id === appointment.id)
    ? data.appointments.map(item => (item.id === appointment.id ? appointment : item))
    : [...data.appointments, appointment];

  const updated: WellnessOverviewData = {
    ...data,
    appointments,
    lastUpdated: new Date().toISOString(),
  };

  await persistToStorage(updated);
  return cloneData(updated);
};

export const deleteAppointment = async (
  appointmentId: string
): Promise<WellnessOverviewData> => {
  const data = await loadFromStorage();
  const appointments = data.appointments.filter(
    appointment => appointment.id !== appointmentId
  );

  const updated: WellnessOverviewData = {
    ...data,
    appointments,
    lastUpdated: new Date().toISOString(),
  };

  await persistToStorage(updated);
  return cloneData(updated);
};

export const getHabitCompletionRate = (
  habit: HabitTrackerEntry,
  referenceDate: Date,
  days = 7
): number => {
  if (!habit.completedDates.length) {
    return 0;
  }

  const completions = habit.completedDates.filter(dateKey => {
    const parsed = parseISO(dateKey);
    const difference = differenceInCalendarDays(referenceDate, parsed);
    return !Number.isNaN(parsed.getTime()) && difference >= 0 && difference < days;
  }).length;

  if (habit.targetPerWeek <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((completions / habit.targetPerWeek) * 100));
};

export const resetWellnessData = async (): Promise<void> => {
  const key = await getScopedStorageKey();
  if (!key) return;
  inMemoryStore.delete(key);
  try {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  } catch {
    // Reset remains usable even when browser storage is denied.
  }
};
