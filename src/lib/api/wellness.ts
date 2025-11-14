import { differenceInCalendarDays, parseISO } from "date-fns";

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
      description: "A calm baseline indicates steady recovery.",
    },
    {
      id: "sleep-quality",
      label: "Sleep Quality",
      value: 85,
      unit: "%",
      change: 4,
      changeDirection: "up",
      description: "Consistent routines are paying off.",
    },
    {
      id: "hydration",
      label: "Hydration",
      value: 92,
      unit: "%",
      change: 6,
      changeDirection: "up",
      description: "On track with the daily hydration target.",
    },
    {
      id: "stress-index",
      label: "Stress Index",
      value: 34,
      unit: "%",
      change: -5,
      changeDirection: "down",
      description: "Breathing exercises are reducing overall stress.",
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
      notes: "Focus on shoulder mobility and stability work.",
    },
    {
      id: "appt-nutrition",
      title: "Nutrition Check-In",
      date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      time: "14:00",
      location: "Harmony Wellness Center",
      type: "Consultation",
      status: "pending",
      notes: "Review meal plans ahead of the upcoming tour.",
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

let inMemoryStore: WellnessOverviewData | null = null;

const cloneData = (data: WellnessOverviewData): WellnessOverviewData =>
  JSON.parse(JSON.stringify(data)) as WellnessOverviewData;

export const getDateKey = (date: Date): string => date.toISOString().split("T")[0];

const loadFromStorage = (): WellnessOverviewData => {
  if (typeof window !== "undefined" && window.localStorage) {
    const raw = window.localStorage.getItem(WELLNESS_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as WellnessOverviewData;
        return cloneData(parsed);
      } catch (error) {
        console.warn("Failed to parse stored wellness data", error);
      }
    }
  }

  if (inMemoryStore) {
    return cloneData(inMemoryStore);
  }

  inMemoryStore = cloneData(defaultWellnessData);
  return cloneData(defaultWellnessData);
};

const persistToStorage = (data: WellnessOverviewData) => {
  const snapshot = cloneData(data);
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(WELLNESS_STORAGE_KEY, JSON.stringify(snapshot));
  } else {
    inMemoryStore = snapshot;
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
  const data = loadFromStorage();
  return sanitizeWellnessData(data, referenceDateKey);
};

export const setHabitCompletion = async (
  habitId: string,
  dateKey: string,
  completed: boolean
): Promise<WellnessOverviewData> => {
  const data = loadFromStorage();
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
    dateKey
  );

  persistToStorage(updated);
  return cloneData(updated);
};

export const logCustomHabitCompletion = async (
  habitId: string,
  completionDateIso: string
): Promise<WellnessOverviewData> => {
  const data = loadFromStorage();
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

  persistToStorage(updated);
  return cloneData(updated);
};

export const upsertAppointment = async (
  appointment: WellnessAppointment
): Promise<WellnessOverviewData> => {
  const data = loadFromStorage();
  const appointments = data.appointments.some(item => item.id === appointment.id)
    ? data.appointments.map(item => (item.id === appointment.id ? appointment : item))
    : [...data.appointments, appointment];

  const updated: WellnessOverviewData = {
    ...data,
    appointments,
    lastUpdated: new Date().toISOString(),
  };

  persistToStorage(updated);
  return cloneData(updated);
};

export const deleteAppointment = async (
  appointmentId: string
): Promise<WellnessOverviewData> => {
  const data = loadFromStorage();
  const appointments = data.appointments.filter(
    appointment => appointment.id !== appointmentId
  );

  const updated: WellnessOverviewData = {
    ...data,
    appointments,
    lastUpdated: new Date().toISOString(),
  };

  persistToStorage(updated);
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
    return differenceInCalendarDays(referenceDate, parsed) <= days - 1;
  }).length;

  if (habit.targetPerWeek <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((completions / habit.targetPerWeek) * 100));
};

export const resetWellnessData = () => {
  inMemoryStore = cloneData(defaultWellnessData);
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.removeItem(WELLNESS_STORAGE_KEY);
  }
};
