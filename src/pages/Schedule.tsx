import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/use-auth-context";
import { useGameData, type PlayerProfile, type PlayerSkills } from "@/hooks/useGameData";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar as CalendarIcon,
  Clock,
  Bell,
  MapPin,
  Users,
  Music,
  Plus,
  CheckCircle,
  AlertCircle,
  XCircle,
  Edit3,
  Trash2,
  Repeat,
  Download,
  Timer,
  Flame,
} from "lucide-react";
import { addMonths } from "date-fns";
import { calculateLevel } from "@/utils/gameBalance";

type EventType = "gig" | "recording" | "rehearsal" | "meeting" | "tour";
type EventStatus = "upcoming" | "in_progress" | "completed" | "cancelled";

interface ScheduleEvent {
  id: string;
  user_id: string;
  title: string;
  type: EventType;
  date: string;
  time: string;
  location: string;
  status: EventStatus;
  description: string | null;
  reminder_minutes: number | null;
  last_notified: string | null;
  recurrence_rule: string | null;
  duration_minutes: number;
  energy_cost: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  isOccurrence?: boolean;
  originalEventId?: string;
}

interface EventFormState {
  title: string;
  type: EventType;
  date: string;
  time: string;
  location: string;
  status: EventStatus;
  description: string;
  reminder_minutes: number | null;
  recurrence_rule: string | null;
  duration_minutes: number;
  energy_cost: number | null;
}

const eventTypes: { value: EventType; label: string }[] = [
  { value: "gig", label: "Gig" },
  { value: "recording", label: "Recording Session" },
  { value: "rehearsal", label: "Rehearsal" },
  { value: "meeting", label: "Meeting" },
  { value: "tour", label: "Tour Stop" },
];

const statusOptions: { value: EventStatus; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const reminderOptions: { value: number | null; label: string }[] = [
  { value: null, label: "No reminder" },
  { value: 0, label: "At start time" },
  { value: 5, label: "5 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 240, label: "4 hours before" },
  { value: 1440, label: "1 day before" },
];

type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly" | "yearly";

interface RecurrenceSettings {
  frequency: RecurrenceFrequency;
  interval: number;
  count: string;
  endDate: string;
}

const DEFAULT_RECURRENCE_SETTINGS: RecurrenceSettings = {
  frequency: "none",
  interval: 1,
  count: "",
  endDate: "",
};

const recurrenceFrequencyOptions: { value: RecurrenceFrequency; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const recurrenceUnitText: Record<Exclude<RecurrenceFrequency, "none">, { singular: string; plural: string }> = {
  daily: { singular: "day", plural: "days" },
  weekly: { singular: "week", plural: "weeks" },
  monthly: { singular: "month", plural: "months" },
  yearly: { singular: "year", plural: "years" },
};

const MAX_GENERATED_OCCURRENCES = 50;
const RECURRENCE_LOOKAHEAD_MONTHS = 12;

const reminderValueToString = (value: number | null) => (value === null ? "none" : value.toString());

type SkillGainKey =
  | "performance"
  | "songwriting"
  | "technical"
  | "composition"
  | "business"
  | "marketing"
  | "creativity"
  | "vocals"
  | "guitar"
  | "drums"
  | "bass";

type SkillGains = Partial<Record<SkillGainKey, number>>;

const EVENT_REWARD_CONFIG: Record<
  EventType,
  {
    label: string;
    cash: number;
    experience: number;
    fame: number;
    skillGains?: SkillGains;
  }
> = {
  gig: {
    label: "Gig",
    cash: 500,
    experience: 150,
    fame: 40,
    skillGains: { performance: 2, marketing: 1 },
  },
  recording: {
    label: "Recording Session",
    cash: 300,
    experience: 140,
    fame: 25,
    skillGains: { technical: 2, songwriting: 2, creativity: 1 },
  },
  rehearsal: {
    label: "Rehearsal",
    cash: 150,
    experience: 90,
    fame: 15,
    skillGains: { performance: 1, composition: 1, guitar: 1, drums: 1 },
  },
  meeting: {
    label: "Industry Meeting",
    cash: 200,
    experience: 70,
    fame: 10,
    skillGains: { business: 2, marketing: 1 },
  },
  tour: {
    label: "Tour Stop",
    cash: 800,
    experience: 220,
    fame: 60,
    skillGains: { performance: 3, marketing: 2, vocals: 2 },
  },
};

const formatSkillLabel = (skill: string) => skill.charAt(0).toUpperCase() + skill.slice(1);

const formatRelativeTime = (minutes: number) => {
  if (minutes === 0) {
    return "now";
  }

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  }

  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}`);
  }

  return parts.join(" ");
};

const formatReminderLabel = (minutes: number | null) => {
  if (minutes === null) {
    return "No reminder";
  }

  if (minutes === 0) {
    return "Reminder at start time";
  }

  return `Reminder ${formatRelativeTime(minutes)} before`;
};

const formatDuration = (minutes: number) => {
  if (minutes <= 0) {
    return "0 minutes";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  }

  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}`);
  }

  return parts.join(" ");
};

const calculateDayTotals = (dayEvents: ScheduleEvent[]) => {
  const totalDuration = dayEvents.reduce((sum, event) => sum + event.duration_minutes, 0);
  const energyValues = dayEvents
    .map((event) => event.energy_cost)
    .filter((value): value is number => value !== null);

  const totalEnergy = energyValues.reduce((sum, value) => sum + value, 0);

  return {
    totalDuration,
    totalEnergy,
    hasEnergy: energyValues.length > 0,
  };
};

const createEmptyFormState = (): EventFormState => ({
  title: "",
  type: "gig",
  date: new Date().toISOString().split("T")[0],
  time: "18:00",
  location: "",
  status: "upcoming",
  description: "",
  reminder_minutes: 30,
  recurrence_rule: null,
  duration_minutes: 60,
  energy_cost: null,
});

const normalizeTime = (value: string) => (value.length >= 5 ? value.slice(0, 5) : value);

const parseRecurrenceRule = (rule: string | null): RecurrenceSettings => {
  if (!rule) {
    return { ...DEFAULT_RECURRENCE_SETTINGS };
  }

  const settings: RecurrenceSettings = { ...DEFAULT_RECURRENCE_SETTINGS };
  const parts = rule.split(";").map((part) => part.trim()).filter(Boolean);

  for (const part of parts) {
    const [rawKey, rawValue] = part.split("=");
    if (!rawKey || !rawValue) {
      continue;
    }

    const key = rawKey.toUpperCase();
    const value = rawValue.trim();

    if (key === "FREQ") {
      const lowerValue = value.toLowerCase();
      if (["daily", "weekly", "monthly", "yearly"].includes(lowerValue)) {
        settings.frequency = lowerValue as RecurrenceFrequency;
      }
    } else if (key === "INTERVAL") {
      const interval = Number.parseInt(value, 10);
      if (Number.isFinite(interval) && interval > 0) {
        settings.interval = interval;
      }
    } else if (key === "COUNT") {
      settings.count = value;
    } else if (key === "UNTIL") {
      const normalizedValue = value.replace(/Z$/, "");
      const datePart = normalizedValue.slice(0, 8);
      if (datePart.length === 8) {
        const year = datePart.slice(0, 4);
        const month = datePart.slice(4, 6);
        const day = datePart.slice(6, 8);
        settings.endDate = `${year}-${month}-${day}`;
      }
    }
  }

  if (settings.frequency === "none") {
    return { ...DEFAULT_RECURRENCE_SETTINGS };
  }

  return settings;
};

const buildRecurrenceRule = (settings: RecurrenceSettings): string | null => {
  if (settings.frequency === "none") {
    return null;
  }

  const parts = [`FREQ=${settings.frequency.toUpperCase()}`];
  const interval = Number.isFinite(settings.interval) ? Math.max(1, Math.floor(settings.interval)) : 1;
  if (interval > 1) {
    parts.push(`INTERVAL=${interval}`);
  }

  const count = settings.count.trim();
  if (count) {
    const parsedCount = Number.parseInt(count, 10);
    if (Number.isFinite(parsedCount) && parsedCount > 0) {
      parts.push(`COUNT=${parsedCount}`);
    }
  }

  if (settings.endDate) {
    const normalizedDate = settings.endDate.replace(/-/g, "");
    parts.push(`UNTIL=${normalizedDate}T000000Z`);
  }

  return parts.join(";");
};

const getEventStartDate = (date: string, time: string): Date | null => {
  if (!date || !time) {
    return null;
  }

  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const startDate = new Date(`${date}T${normalizedTime}`);

  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  return startDate;
};

const getEventEndDate = (date: string, time: string, durationMinutes: number): Date | null => {
  const start = getEventStartDate(date, time);

  if (!start) {
    return null;
  }

  if (durationMinutes <= 0) {
    return start;
  }

  return new Date(start.getTime() + durationMinutes * 60000);
};

const formatTimeLabel = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDateParts = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
};

const addIntervalToDate = (date: Date, frequency: RecurrenceFrequency, interval: number) => {
  const next = new Date(date.getTime());
  const step = Math.max(1, interval);

  switch (frequency) {
    case "daily":
      next.setDate(next.getDate() + step);
      break;
    case "weekly":
      next.setDate(next.getDate() + step * 7);
      break;
    case "monthly":
      next.setMonth(next.getMonth() + step);
      break;
    case "yearly":
      next.setFullYear(next.getFullYear() + step);
      break;
    default:
      break;
  }

  return next;
};

const getRecurrenceDescription = (rule: string | null, _date?: string, _time?: string) => {
  if (!rule) {
    return null;
  }

  const settings = parseRecurrenceRule(rule);
  if (settings.frequency === "none") {
    return null;
  }

  const unit = recurrenceUnitText[settings.frequency];
  const interval = Math.max(1, settings.interval);
  const intervalLabel = interval === 1 ? unit.singular : `${interval} ${unit.plural}`;
  let description = `every ${intervalLabel}`;

  if (settings.count) {
    const countValue = Number.parseInt(settings.count, 10);
    if (Number.isFinite(countValue) && countValue > 0) {
      description += ` for ${countValue} occurrence${countValue === 1 ? "" : "s"}`;
    }
  }

  if (settings.endDate) {
    const untilDate = new Date(`${settings.endDate}T00:00:00`);
    if (!Number.isNaN(untilDate.getTime())) {
      description += ` until ${untilDate.toLocaleDateString()}`;
    }
  }

  return description;
};

const expandRecurringEvents = (events: ScheduleEvent[]) => {
  const now = new Date();
  const rangeEnd = addMonths(now, RECURRENCE_LOOKAHEAD_MONTHS);
  const expanded: ScheduleEvent[] = [];

  for (const event of events) {
    expanded.push(event);

    if (!event.recurrence_rule || !["upcoming", "in_progress"].includes(event.status)) {
      continue;
    }

    const settings = parseRecurrenceRule(event.recurrence_rule);
    if (settings.frequency === "none") {
      continue;
    }

    const startDate = getEventStartDate(event.date, event.time);
    if (!startDate) {
      continue;
    }

    const untilDate = settings.endDate ? new Date(`${settings.endDate}T23:59:59`) : null;
    const countValue = settings.count ? Number.parseInt(settings.count, 10) : NaN;
    let remainingOccurrences = Number.isFinite(countValue) && countValue > 0 ? countValue - 1 : Infinity;
    const interval = Math.max(1, settings.interval);

    const hasRemainingOccurrences = () => remainingOccurrences === Infinity || remainingOccurrences > 0;

    let nextDate = addIntervalToDate(startDate, settings.frequency, interval);

    while (
      hasRemainingOccurrences() &&
      nextDate.getTime() < now.getTime() &&
      nextDate.toDateString() !== now.toDateString() &&
      (!untilDate || nextDate.getTime() <= untilDate.getTime()) &&
      nextDate.getTime() <= rangeEnd.getTime()
    ) {
      if (remainingOccurrences !== Infinity) {
        remainingOccurrences -= 1;
      }

      if (!hasRemainingOccurrences()) {
        break;
      }

      const candidate = addIntervalToDate(nextDate, settings.frequency, interval);
      if (candidate.getTime() === nextDate.getTime()) {
        break;
      }
      nextDate = candidate;
    }

    let occurrencesGenerated = 0;

    while (
      hasRemainingOccurrences() &&
      occurrencesGenerated < MAX_GENERATED_OCCURRENCES &&
      nextDate.getTime() <= rangeEnd.getTime()
    ) {
      if (untilDate && nextDate.getTime() > untilDate.getTime()) {
        break;
      }

      const isPastOccurrence =
        nextDate.getTime() < now.getTime() && nextDate.toDateString() !== now.toDateString();
      if (!isPastOccurrence) {
        const { date: occurrenceDate, time: occurrenceTime } = formatDateParts(nextDate);
        expanded.push({
          ...event,
          id: `${event.id}__${nextDate.getTime()}`,
          date: occurrenceDate,
          time: occurrenceTime,
          isOccurrence: true,
          originalEventId: event.id,
        });
        occurrencesGenerated += 1;

        if (remainingOccurrences !== Infinity) {
          remainingOccurrences -= 1;
        }
      } else {
        if (remainingOccurrences !== Infinity) {
          remainingOccurrences -= 1;
        }
      }

      if (!hasRemainingOccurrences()) {
        break;
      }

      const candidate = addIntervalToDate(nextDate, settings.frequency, interval);
      if (candidate.getTime() === nextDate.getTime()) {
        break;
      }
      nextDate = candidate;
    }
  }

  return sortEvents(expanded);
};

const formatDateTimeForICS = (date: Date) => {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

const getICSDateRange = (date: string, time: string, durationMinutes: number) => {
  const start = getEventStartDate(date, time);
  if (!start) {
    return null;
  }

  const duration = Math.max(1, Math.round(durationMinutes));
  const end = new Date(start.getTime() + duration * 60000);

  return {
    start: formatDateTimeForICS(start),
    end: formatDateTimeForICS(end),
  };
};

const escapeICSValue = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

const generateICS = (events: ScheduleEvent[]) => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rockmundo Genesis//Schedule//EN",
  ];

  for (const event of events) {
    const dateRange = getICSDateRange(event.date, event.time, event.duration_minutes);
    if (!dateRange) {
      continue;
    }

    const timestamp = formatDateTimeForICS(new Date());
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@rockmundo`);
    lines.push(`DTSTAMP:${timestamp}`);
    lines.push(`DTSTART:${dateRange.start}`);
    lines.push(`DTEND:${dateRange.end}`);
    lines.push(`SUMMARY:${escapeICSValue(event.title)}`);
    if (event.location) {
      lines.push(`LOCATION:${escapeICSValue(event.location)}`);
    }
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICSValue(event.description)}`);
    }
    if (event.recurrence_rule) {
      lines.push(`RRULE:${event.recurrence_rule}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
};

const REMINDER_CHECK_INTERVAL = 30000;

const sortEvents = (list: ScheduleEvent[]) =>
  [...list].sort((a, b) => {
    const dateComparison =
      new Date(a.date + "T00:00:00").getTime() - new Date(b.date + "T00:00:00").getTime();
    if (dateComparison !== 0) {
      return dateComparison;
    }
    return a.time.localeCompare(b.time);
  });

const getStatusBadgeClass = (status: EventStatus) => {
  switch (status) {
    case "completed":
      return "border-success/40 bg-success/10 text-success";
    case "in_progress":
      return "border-warning/40 bg-warning/10 text-warning";
    case "cancelled":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    default:
      return "border-primary/40 bg-primary/10 text-primary";
  }
};

const getEventIcon = (type: EventType) => {
  switch (type) {
    case "gig":
      return <Music className="h-4 w-4" />;
    case "recording":
      return <Music className="h-4 w-4" />;
    case "rehearsal":
      return <Users className="h-4 w-4" />;
    case "meeting":
      return <Users className="h-4 w-4" />;
    case "tour":
      return <MapPin className="h-4 w-4" />;
    default:
      return <CalendarIcon className="h-4 w-4" />;
  }
};

const getStatusIcon = (status: EventStatus) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-success" />;
    case "in_progress":
      return <AlertCircle className="h-4 w-4 text-warning" />;
    case "cancelled":
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-primary" />;
  }
};

const getTypeColor = (type: EventType) => {
  switch (type) {
    case "gig":
      return "bg-gradient-primary";
    case "recording":
      return "bg-gradient-accent";
    case "rehearsal":
      return "bg-secondary";
    case "meeting":
      return "bg-muted";
    default:
      return "bg-secondary";
  }
};

const isSameDay = (dateString: string, compareDate: Date) => {
  const eventDate = new Date(dateString + "T00:00:00");
  return eventDate.toDateString() === compareDate.toDateString();
};

const Schedule = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { profile, skills, updateProfile, updateSkills, addActivity, refetch } = useGameData();
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<EventFormState>(() => createEmptyFormState());
  const [recurrenceSettings, setRecurrenceSettings] = useState<RecurrenceSettings>(
    DEFAULT_RECURRENCE_SETTINGS
  );
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<ScheduleEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleEvent | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const notifiedEventsRef = useRef<Set<string>>(new Set());
  const profileRef = useRef<PlayerProfile | null>(profile);
  const skillsRef = useRef<PlayerSkills | null>(skills);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    skillsRef.current = skills;
  }, [skills]);
  const fetchEvents = useCallback(async () => {
    if (!user) {
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("schedule_events")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true })
        .order("time", { ascending: true });

      if (error) throw error;

      const normalizedEvents: ScheduleEvent[] = (data ?? []).map((event) => ({
        id: event.id,
        user_id: event.user_id,
        title: event.title,
        type: event.type as EventType,
        date: event.date,
        time: normalizeTime(event.time),
        location: event.location,
        status: event.status as EventStatus,
        description: event.description,
        reminder_minutes:
          event.reminder_minutes !== null && event.reminder_minutes !== undefined
            ? Number(event.reminder_minutes)
            : null,
        last_notified: event.last_notified ?? null,
        recurrence_rule: event.recurrence_rule ?? null,
        duration_minutes:
          event.duration_minutes !== null && event.duration_minutes !== undefined
            ? Number(event.duration_minutes)
            : 60,
        energy_cost:
          event.energy_cost !== null && event.energy_cost !== undefined
            ? Number(event.energy_cost)
            : null,
        created_at: event.created_at,
        updated_at: event.updated_at,
      }));

      setEvents(sortEvents(normalizedEvents));
    } catch (error) {
      console.error("Error loading schedule:", error);
      toast({
        title: "Error",
        description: "Failed to load schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (user) {
      void fetchEvents();
    } else {
      setEvents([]);
      setLoading(false);
    }
  }, [fetchEvents, user]);

  useEffect(() => {
    const activeNotifications = new Set(events.filter((event) => event.last_notified).map((event) => event.id));
    for (const id of Array.from(notifiedEventsRef.current)) {
      if (!activeNotifications.has(id)) {
        notifiedEventsRef.current.delete(id);
      }
    }
  }, [events]);

  const checkReminders = useCallback(async () => {
    if (!user || loading) {
      return;
    }

    const now = new Date();

    const eventsToNotify = events.filter((event) => {
      if (event.reminder_minutes === null) {
        return false;
      }

      if (!["upcoming", "in_progress"].includes(event.status)) {
        return false;
      }

      const timeString = event.time.length === 5 ? `${event.time}:00` : event.time;
      const eventDateTime = new Date(`${event.date}T${timeString}`);

      if (Number.isNaN(eventDateTime.getTime())) {
        return false;
      }

      if (eventDateTime.getTime() < now.getTime()) {
        return false;
      }

      const reminderTime = new Date(eventDateTime.getTime() - event.reminder_minutes * 60000);

      if (now.getTime() < reminderTime.getTime()) {
        return false;
      }

      if (now.getTime() > eventDateTime.getTime()) {
        return false;
      }

      if (event.last_notified) {
        const lastNotifiedDate = new Date(event.last_notified);
        if (!Number.isNaN(lastNotifiedDate.getTime()) && lastNotifiedDate.getTime() >= reminderTime.getTime()) {
          return false;
        }
      }

      if (notifiedEventsRef.current.has(event.id)) {
        return false;
      }

      return true;
    });

    for (const event of eventsToNotify) {
      const timeString = event.time.length === 5 ? `${event.time}:00` : event.time;
      const eventDateTime = new Date(`${event.date}T${timeString}`);
      const localDate = eventDateTime.toLocaleDateString();
      const localTime = eventDateTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const reminderMinutes = event.reminder_minutes ?? 0;
      const timingDescription =
        reminderMinutes === 0
          ? "is starting now"
          : `starts in ${formatRelativeTime(reminderMinutes)}`;

      toast({
        title: `Reminder: ${event.title}`,
        description: `Your event ${timingDescription}. Scheduled for ${localDate} at ${localTime}.`,
      });

      const timestamp = new Date().toISOString();

      try {
        const { error: notificationError } = await supabase.from("notifications").insert({
          user_id: user.id,
          type: "system",
          message: `Event Reminder: ${event.title} ${timingDescription}. Scheduled for ${localDate} at ${localTime}.`,
        });

        if (notificationError) {
          throw notificationError;
        }
      } catch (notificationError) {
        console.error("Error creating schedule notification:", notificationError);
      }

      try {
        const { error: updateError } = await supabase
          .from("schedule_events")
          .update({ last_notified: timestamp })
          .eq("id", event.id)
          .eq("user_id", user.id);

        if (updateError) {
          throw updateError;
        }

        setEvents((prev) =>
          prev.map((item) => (item.id === event.id ? { ...item, last_notified: timestamp } : item))
        );
      } catch (updateError) {
        console.error("Error updating event reminder timestamp:", updateError);
      }

      notifiedEventsRef.current.add(event.id);
    }
  }, [events, loading, toast, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const interval = setInterval(() => {
      void checkReminders();
    }, REMINDER_CHECK_INTERVAL);

    void checkReminders();

    return () => clearInterval(interval);
  }, [checkReminders, user]);

  const processCompletionRewards = useCallback(
    async (event: ScheduleEvent) => {
      const reward = EVENT_REWARD_CONFIG[event.type];
      if (!reward) {
        return null;
      }

      if (!user) {
        throw new Error("You need to be signed in to claim event rewards.");
      }

      const activeProfile = profileRef.current;
      if (!activeProfile) {
        throw new Error("Profile data is still loading. Please try again.");
      }

      const profileUpdates: Partial<PlayerProfile> = {};
      const currentCash = Number(activeProfile.cash ?? 0);
      const currentExperience = Number(activeProfile.experience ?? 0);
      const currentFame = Number(activeProfile.fame ?? 0);

      const newCash = currentCash + reward.cash;
      const newExperience = currentExperience + reward.experience;
      const newFame = Math.max(0, currentFame + reward.fame);

      profileUpdates.cash = newCash;
      profileUpdates.experience = newExperience;
      profileUpdates.fame = newFame;

      const currentLevel =
        typeof activeProfile.level === "number"
          ? activeProfile.level
          : calculateLevel(currentExperience);
      const newLevel = calculateLevel(newExperience);
      if (newLevel !== currentLevel) {
        profileUpdates.level = newLevel;
      }

      const updatedProfile = await updateProfile(profileUpdates);
      if (!updatedProfile) {
        throw new Error("Unable to update profile with completion rewards.");
      }
      profileRef.current = updatedProfile;

      const activeSkills = skillsRef.current;
      const skillSummaries: string[] = [];
      if (reward.skillGains && activeSkills) {
        const skillUpdates: Partial<PlayerSkills> = {};

        for (const [key, delta] of Object.entries(reward.skillGains)) {
          const numericDelta = Number(delta ?? 0);
          if (numericDelta <= 0) {
            continue;
          }

          const skillKey = key as SkillGainKey;
          const currentValue = Number(
            activeSkills[skillKey as keyof PlayerSkills] ?? 0
          );
          const nextValue = Math.min(100, currentValue + numericDelta);
          const actualGain = nextValue - currentValue;

          if (actualGain > 0) {
            skillUpdates[skillKey as keyof PlayerSkills] = nextValue;
            skillSummaries.push(`+${actualGain} ${formatSkillLabel(skillKey)}`);
          }
        }

        if (Object.keys(skillUpdates).length > 0) {
          const updatedSkills = await updateSkills(skillUpdates);
          if (updatedSkills) {
            skillsRef.current = updatedSkills;
          }
        }
      }

      const summarySegments = [
        `+${reward.experience} XP`,
        `+${reward.fame} fame`,
        `+$${reward.cash.toLocaleString()} cash`,
      ];

      if (skillSummaries.length > 0) {
        summarySegments.push(`Skill gains: ${skillSummaries.join(", ")}`);
      }

      const activityMessage = `Completed ${event.title} (${reward.label}) — ${summarySegments.join(
        " • "
      )}`;

      await addActivity(`schedule_${event.type}`, activityMessage, reward.cash);
      await refetch();

      return {
        summary: summarySegments.join(" • "),
        rewardLabel: reward.label,
      };
    },
    [addActivity, refetch, updateProfile, updateSkills, user]
  );

  const handleFormChange = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateRecurrenceSettings = (updates: Partial<RecurrenceSettings>) => {
    setRecurrenceSettings((prev) => {
      let next: RecurrenceSettings;

      if (updates.frequency) {
        if (updates.frequency === "none") {
          next = { ...DEFAULT_RECURRENCE_SETTINGS };
        } else if (updates.frequency !== prev.frequency) {
          next = {
            frequency: updates.frequency,
            interval: 1,
            count: "",
            endDate: "",
          };
        } else {
          next = { ...prev, ...updates, frequency: updates.frequency } as RecurrenceSettings;
        }
      } else {
        next = { ...prev, ...updates } as RecurrenceSettings;
      }

      if (next.frequency !== "none" && (!Number.isFinite(next.interval) || next.interval < 1)) {
        next.interval = 1;
      }

      const rule = buildRecurrenceRule(next);
      handleFormChange("recurrence_rule", rule);

      return next;
    });
  };

  const handleExportCalendar = () => {
    if (events.length === 0) {
      toast({
        title: "No events to export",
        description: "Add an event to your schedule before exporting.",
      });
      return;
    }

    try {
      const icsContent = generateICS(events);
      const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "rockmundo-schedule.ics";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Calendar exported",
        description: "Import the downloaded .ics file into your favorite calendar app.",
      });
    } catch (error) {
      console.error("Error exporting calendar:", error);
      toast({
        title: "Export failed",
        description: "We couldn't generate the calendar file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleOpenCreateDialog = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "You need to be signed in to manage your schedule.",
        variant: "destructive",
      });
      return;
    }

    setFormData(createEmptyFormState());
    setRecurrenceSettings({ ...DEFAULT_RECURRENCE_SETTINGS });
    setIsCreateDialogOpen(true);
  };

  const openEditDialog = (event: ScheduleEvent) => {
    setCurrentEvent(event);
    setFormData({
      title: event.title,
      type: event.type,
      date: event.date,
      time: normalizeTime(event.time),
      location: event.location,
      status: event.status,
      description: event.description ?? "",
      reminder_minutes: event.reminder_minutes,
      recurrence_rule: event.recurrence_rule,
      duration_minutes: event.duration_minutes,
      energy_cost: event.energy_cost,
    });
    setRecurrenceSettings(parseRecurrenceRule(event.recurrence_rule));
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (event: ScheduleEvent) => {
    setDeleteTarget(event);
    setIsDeleteDialogOpen(true);
  };

  const handleCreateEvent = async () => {
    if (!user) return;
    if (!formData.title || !formData.date || !formData.time || !formData.location) {
      toast({
        title: "Missing information",
        description: "Title, date, time, and location are required.",
        variant: "destructive",
      });
      return;
    }

    if (formData.duration_minutes <= 0) {
      toast({
        title: "Invalid duration",
        description: "Event duration must be at least one minute.",
        variant: "destructive",
      });
      return;
    }

    if (formData.energy_cost !== null && formData.energy_cost < 0) {
      toast({
        title: "Invalid energy cost",
        description: "Energy cost cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("schedule_events")
        .insert([
          {
            user_id: user.id,
            title: formData.title,
            type: formData.type,
            date: formData.date,
            time: formData.time,
            location: formData.location,
            status: formData.status,
            description: formData.description ? formData.description : null,
            reminder_minutes: formData.reminder_minutes,
            last_notified: null,
            recurrence_rule: formData.recurrence_rule,
            duration_minutes: formData.duration_minutes,
            energy_cost: formData.energy_cost,
          },
        ])
        .select()
      .single();

      if (error) throw error;

      const newEvent: ScheduleEvent = {
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        type: data.type as EventType,
        date: data.date,
        time: normalizeTime(data.time),
        location: data.location,
        status: data.status as EventStatus,
        description: data.description,
        reminder_minutes:
          data.reminder_minutes !== null && data.reminder_minutes !== undefined
            ? Number(data.reminder_minutes)
            : null,
        last_notified: data.last_notified ?? null,
        recurrence_rule: data.recurrence_rule ?? null,
        duration_minutes:
          data.duration_minutes !== null && data.duration_minutes !== undefined
            ? Number(data.duration_minutes)
            : formData.duration_minutes,
        energy_cost:
          data.energy_cost !== null && data.energy_cost !== undefined
            ? Number(data.energy_cost)
            : null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      setEvents((prev) => sortEvents([...prev, newEvent]));
      setIsCreateDialogOpen(false);
      setFormData(createEmptyFormState());
      setRecurrenceSettings({ ...DEFAULT_RECURRENCE_SETTINGS });

      toast({
        title: "Event added",
        description: "Your schedule has been updated.",
      });
    } catch (error) {
      console.error("Error creating schedule event:", error);
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEvent = async () => {
    if (!user || !currentEvent) return;
    if (!formData.title || !formData.date || !formData.time || !formData.location) {
      toast({
        title: "Missing information",
        description: "Title, date, time, and location are required.",
        variant: "destructive",
      });
      return;
    }

    if (formData.duration_minutes <= 0) {
      toast({
        title: "Invalid duration",
        description: "Event duration must be at least one minute.",
        variant: "destructive",
      });
      return;
    }

    if (formData.energy_cost !== null && formData.energy_cost < 0) {
      toast({
        title: "Invalid energy cost",
        description: "Energy cost cannot be negative.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const previousStatus = currentEvent.status;
      const shouldResetNotification =
        currentEvent.date !== formData.date ||
        normalizeTime(currentEvent.time) !== formData.time ||
        currentEvent.reminder_minutes !== formData.reminder_minutes;

      const { data, error } = await supabase
        .from("schedule_events")
        .update({
          title: formData.title,
          type: formData.type,
          date: formData.date,
          time: formData.time,
          location: formData.location,
          status: formData.status,
          description: formData.description ? formData.description : null,
          reminder_minutes: formData.reminder_minutes,
          recurrence_rule: formData.recurrence_rule,
          duration_minutes: formData.duration_minutes,
          energy_cost: formData.energy_cost,
          ...(shouldResetNotification ? { last_notified: null } : {}),
        })
        .eq("id", currentEvent.id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      const updatedEvent: ScheduleEvent = {
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        type: data.type as EventType,
        date: data.date,
        time: normalizeTime(data.time),
        location: data.location,
        status: data.status as EventStatus,
        description: data.description,
        reminder_minutes:
          data.reminder_minutes !== null && data.reminder_minutes !== undefined
            ? Number(data.reminder_minutes)
            : null,
        last_notified: data.last_notified ?? null,
        recurrence_rule: data.recurrence_rule ?? null,
        duration_minutes:
          data.duration_minutes !== null && data.duration_minutes !== undefined
            ? Number(data.duration_minutes)
            : formData.duration_minutes,
        energy_cost:
          data.energy_cost !== null && data.energy_cost !== undefined
            ? Number(data.energy_cost)
            : null,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      setEvents((prev) => sortEvents(prev.map((event) => (event.id === updatedEvent.id ? updatedEvent : event))));

      let completionResult: { summary: string; rewardLabel: string } | null = null;
      const wasCompleted = previousStatus !== "completed" && updatedEvent.status === "completed";

      if (wasCompleted) {
        try {
          completionResult = await processCompletionRewards(updatedEvent);
        } catch (rewardError) {
          console.error("Error applying completion rewards:", rewardError);
          toast({
            title: "Rewards not applied",
            description: "The event was updated, but we couldn't apply completion rewards. Please try again.",
            variant: "destructive",
          });
        }
      }

      setIsEditDialogOpen(false);
      setCurrentEvent(null);
      setFormData(createEmptyFormState());
      setRecurrenceSettings({ ...DEFAULT_RECURRENCE_SETTINGS });

      const toastTitle = wasCompleted && completionResult
        ? `Completed ${completionResult.rewardLabel}`
        : wasCompleted
          ? "Event completed"
          : "Event updated";
      const toastDescription = wasCompleted && completionResult
        ? `${updatedEvent.title}: ${completionResult.summary}`
        : wasCompleted
          ? `${updatedEvent.title} marked as completed.`
          : "The schedule event has been updated.";

      toast({
        title: toastTitle,
        description: toastDescription,
      });
    } catch (error) {
      console.error("Error updating schedule event:", error);
      toast({
        title: "Error",
        description: "Failed to update event",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!user || !deleteTarget) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("schedule_events")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("user_id", user.id);

      if (error) throw error;

      setEvents((prev) => prev.filter((event) => event.id !== deleteTarget.id));
      toast({
        title: "Event removed",
        description: "The event has been deleted from your schedule.",
      });
    } catch (error) {
      console.error("Error deleting schedule event:", error);
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
      setDeleteTarget(null);
    }
  };

  const renderFormFields = () => {
    const recurrenceDescription = getRecurrenceDescription(
      formData.recurrence_rule,
      formData.date,
      formData.time
    );
    const intervalUnitLabel =
      recurrenceSettings.frequency === "none"
        ? ""
        : recurrenceUnitText[recurrenceSettings.frequency].plural;

    return (
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Event title"
            value={formData.title}
            onChange={(event) => handleFormChange("title", event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="type">Event type</Label>
          <Select value={formData.type} onValueChange={(value) => handleFormChange("type", value as EventType)}>
            <SelectTrigger id="type">
              <SelectValue placeholder="Select event type" />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map((eventType) => (
                <SelectItem key={eventType.value} value={eventType.value}>
                  {eventType.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(event) => handleFormChange("date", event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={formData.time}
              onChange={(event) => handleFormChange("time", event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="duration_minutes">Duration (minutes)</Label>
            <Input
              id="duration_minutes"
              type="number"
              min={1}
              step={15}
              value={formData.duration_minutes}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                handleFormChange(
                  "duration_minutes",
                  Number.isNaN(value) ? 0 : Math.max(0, Math.round(value))
                );
              }}
            />
            <p className="text-xs text-muted-foreground">
              Blocks out the length of this activity for daily planning and exports.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="energy_cost">Energy cost (optional)</Label>
            <Input
              id="energy_cost"
              type="number"
              min={0}
              step={5}
              value={formData.energy_cost ?? ""}
              onChange={(event) => {
                const value = event.target.valueAsNumber;
                handleFormChange(
                  "energy_cost",
                  Number.isNaN(value) ? null : Math.max(0, Math.round(value))
                );
              }}
              placeholder="e.g. 25"
            />
            <p className="text-xs text-muted-foreground">
              Track optional stamina or resource costs for this time block.
            </p>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="Where is this event taking place?"
            value={formData.location}
            onChange={(event) => handleFormChange("location", event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => handleFormChange("status", value as EventStatus)}>
            <SelectTrigger id="status">
              <SelectValue placeholder="Select event status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((statusOption) => (
                <SelectItem key={statusOption.value} value={statusOption.value}>
                  {statusOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="reminder">Reminder</Label>
          <Select
            value={reminderValueToString(formData.reminder_minutes)}
            onValueChange={(value) =>
              handleFormChange("reminder_minutes", value === "none" ? null : Number(value))
            }
          >
            <SelectTrigger id="reminder">
              <SelectValue placeholder="Select reminder timing" />
            </SelectTrigger>
            <SelectContent>
              {reminderOptions.map((option) => (
                <SelectItem key={reminderValueToString(option.value)} value={reminderValueToString(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="recurrence">Recurrence</Label>
          <Select
            value={recurrenceSettings.frequency}
            onValueChange={(value) => updateRecurrenceSettings({ frequency: value as RecurrenceFrequency })}
          >
            <SelectTrigger id="recurrence">
              <SelectValue placeholder="Choose recurrence" />
            </SelectTrigger>
            <SelectContent>
              {recurrenceFrequencyOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {recurrenceSettings.frequency !== "none" ? (
            <div className="space-y-3 rounded-md border border-border/40 p-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1">
                  <Label htmlFor="recurrence-interval">
                    Repeat every {intervalUnitLabel ? `(${intervalUnitLabel})` : ""}
                  </Label>
                  <Input
                    id="recurrence-interval"
                    type="number"
                    min={1}
                    value={recurrenceSettings.interval}
                    onChange={(event) => {
                      const value = Number.parseInt(event.target.value, 10);
                      updateRecurrenceSettings({ interval: Number.isNaN(value) ? 1 : value });
                    }}
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="recurrence-count">Number of occurrences (optional)</Label>
                  <Input
                    id="recurrence-count"
                    type="number"
                    min={1}
                    placeholder="Leave blank for none"
                    value={recurrenceSettings.count}
                    onChange={(event) => {
                      updateRecurrenceSettings({ count: event.target.value.replace(/[^0-9]/g, "") });
                    }}
                  />
                </div>
              </div>
              <div className="grid gap-1 md:max-w-xs">
                <Label htmlFor="recurrence-end-date">End date (optional)</Label>
                <Input
                  id="recurrence-end-date"
                  type="date"
                  min={formData.date}
                  value={recurrenceSettings.endDate}
                  onChange={(event) => updateRecurrenceSettings({ endDate: event.target.value })}
                />
              </div>
              {recurrenceDescription ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Repeat className="h-4 w-4" />
                  <span className="italic">Repeats {recurrenceDescription}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Define how often this event repeats.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">This event will not repeat.</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            placeholder="Add notes or preparation details"
            value={formData.description}
            rows={4}
            onChange={(event) => handleFormChange("description", event.target.value)}
          />
        </div>
      </div>
    );
  };

  const renderEventCard = (
    event: ScheduleEvent,
    options: { highlightToday?: boolean; extraBadge?: string } = {}
  ) => {
    const statusBadgeClass = getStatusBadgeClass(event.status);
    const baseEvent =
      event.isOccurrence && event.originalEventId
        ? events.find((item) => item.id === event.originalEventId) ?? event
        : event;
    const recurrenceDescription = getRecurrenceDescription(
      baseEvent.recurrence_rule,
      baseEvent.date,
      baseEvent.time
    );
    const endDate = getEventEndDate(event.date, event.time, event.duration_minutes);
    const timeRange = endDate ? `${event.time} – ${formatTimeLabel(endDate)}` : event.time;
    const durationLabel = formatDuration(event.duration_minutes);
    const cardClasses = `bg-card/80 backdrop-blur-sm border-primary/20 ${
      options.highlightToday ? "border-l-4 border-l-primary" : ""
    } ${event.status === "completed" ? "opacity-80" : ""}`;

    return (
      <Card key={event.id} className={cardClasses}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${getTypeColor(event.type)} text-white`}>
              {getEventIcon(event.type)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="text-xl font-semibold flex-1 min-w-0">{event.title}</h3>
                <Badge variant="outline" className="capitalize">
                  {event.type}
                </Badge>
                {options.extraBadge ? (
                  <Badge variant="default" className="bg-gradient-primary text-white">
                    {options.extraBadge}
                  </Badge>
                ) : null}
                {baseEvent.recurrence_rule ? (
                  <Badge variant="outline" className="flex items-center gap-1 border-dashed">
                    <Repeat className="h-3 w-3" />
                    {event.isOccurrence ? "Series occurrence" : "Repeats"}
                  </Badge>
                ) : null}
                <Badge variant="outline" className={`capitalize ${statusBadgeClass}`}>
                  {event.status.replace("_", " ")}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(event.date + "T00:00:00").toLocaleDateString()}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{timeRange}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span>{durationLabel}</span>
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{event.location}</span>
                </span>
                {event.reminder_minutes !== null ? (
                  <span className="flex items-center gap-1">
                    <Bell className="h-4 w-4 text-muted-foreground" />
                    <span>{formatReminderLabel(event.reminder_minutes)}</span>
                  </span>
                ) : null}
                {recurrenceDescription ? (
                  <span className="flex items-center gap-1">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <span>{recurrenceDescription}</span>
                  </span>
                ) : null}
                {event.energy_cost !== null ? (
                  <span className="flex items-center gap-1">
                    <Flame className="h-4 w-4 text-muted-foreground" />
                    <span>{event.energy_cost} energy</span>
                  </span>
                ) : null}
              </div>

              {event.description ? (
                <p className="text-muted-foreground mb-4 whitespace-pre-line">{event.description}</p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {getStatusIcon(event.status)}
                  <span className="capitalize">{event.status.replace("_", " ")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(baseEvent)}>
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDeleteDialog(baseEvent)}
                    disabled={isDeleting && deleteTarget?.id === baseEvent.id}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const expandedEvents = useMemo(() => expandRecurringEvents(events), [events]);

  const filteredEvents = selectedDate
    ? expandedEvents.filter((event) => isSameDay(event.date, selectedDate))
    : expandedEvents;

  const upcomingEvents = expandedEvents.filter(
    (event) => event.status === "upcoming" || event.status === "in_progress"
  );
  const todayEvents = expandedEvents.filter((event) => isSameDay(event.date, new Date()));
  const completedEvents = expandedEvents.filter((event) => event.status === "completed");
  const selectedDayTotals = useMemo(() => calculateDayTotals(filteredEvents), [filteredEvents]);
  const todayTotals = useMemo(() => calculateDayTotals(todayEvents), [todayEvents]);

  return (
    <div className="min-h-screen bg-gradient-stage p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              Schedule
            </h1>
            <p className="text-muted-foreground">
              {upcomingEvents.length} upcoming events • {todayEvents.length} today
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportCalendar} disabled={events.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export to Calendar
            </Button>
            <Button className="bg-gradient-primary text-white" onClick={handleOpenCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
              size="sm"
            >
              List View
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              onClick={() => setViewMode("calendar")}
              size="sm"
            >
              Calendar View
            </Button>
          </div>
        </div>

        {viewMode === "calendar" ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 bg-card/80 backdrop-blur-sm border-primary/20">
              <CardHeader>
                <CardTitle>Calendar</CardTitle>
                <CardDescription>Select a date to view events</CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                <CardHeader>
                  <CardTitle>
                    Events for {selectedDate ? selectedDate.toLocaleDateString() : "Selected Date"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-center text-muted-foreground py-8">Loading schedule...</p>
                  ) : filteredEvents.length > 0 ? (
                    <>
                      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Timer className="h-4 w-4" />
                          <span>{formatDuration(selectedDayTotals.totalDuration)} scheduled</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {filteredEvents.length} event
                            {filteredEvents.length === 1 ? "" : "s"}
                          </span>
                        </span>
                        {selectedDayTotals.hasEnergy ? (
                          <span className="flex items-center gap-1">
                            <Flame className="h-4 w-4" />
                            <span>{selectedDayTotals.totalEnergy} energy planned</span>
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-3">
                        {filteredEvents.map((event) => {
                          const statusBadgeClass = getStatusBadgeClass(event.status);
                          const baseEvent =
                            event.isOccurrence && event.originalEventId
                              ? events.find((item) => item.id === event.originalEventId) ?? event
                              : event;
                          const recurrenceDescription = getRecurrenceDescription(
                            baseEvent.recurrence_rule,
                            baseEvent.date,
                            baseEvent.time
                          );
                          const endDate = getEventEndDate(event.date, event.time, event.duration_minutes);
                          const timeRange = endDate
                            ? `${event.time} – ${formatTimeLabel(endDate)}`
                            : event.time;
                          const durationLabel = formatDuration(event.duration_minutes);
                          return (
                            <div
                              key={event.id}
                              className="space-y-3 p-4 rounded-lg bg-secondary/30"
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-lg ${getTypeColor(event.type)} text-white`}>
                                    {getEventIcon(event.type)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="font-semibold truncate">{event.title}</h3>
                                      <Badge variant="outline" className="capitalize">
                                        {event.type}
                                      </Badge>
                                      {baseEvent.recurrence_rule ? (
                                        <Badge variant="outline" className="flex items-center gap-1 border-dashed">
                                          <Repeat className="h-3 w-3" />
                                          {event.isOccurrence ? "Series occurrence" : "Repeats"}
                                        </Badge>
                                      ) : null}
                                      <Badge
                                        variant="outline"
                                        className={`capitalize ${statusBadgeClass}`}
                                      >
                                        {event.status.replace("_", " ")}
                                      </Badge>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {timeRange}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Timer className="h-3 w-3" />
                                        {durationLabel}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        {event.location}
                                      </span>
                                      {event.reminder_minutes !== null ? (
                                        <span className="flex items-center gap-1">
                                          <Bell className="h-3 w-3" />
                                          {formatReminderLabel(event.reminder_minutes)}
                                        </span>
                                      ) : null}
                                      {recurrenceDescription ? (
                                        <span className="flex items-center gap-1">
                                          <Repeat className="h-3 w-3" />
                                          {recurrenceDescription}
                                        </span>
                                      ) : null}
                                      {event.energy_cost !== null ? (
                                        <span className="flex items-center gap-1">
                                          <Flame className="h-3 w-3" />
                                          {event.energy_cost} energy
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="sm" onClick={() => openEditDialog(baseEvent)}>
                                    <Edit3 className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => openDeleteDialog(baseEvent)}
                                    disabled={isDeleting && deleteTarget?.id === baseEvent.id}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </div>
                              </div>
                              {event.description ? (
                                <p className="text-sm text-muted-foreground">{event.description}</p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No events scheduled for this date
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="upcoming" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="all">All Events</TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming">
              <div className="space-y-4">
                {!user ? (
                  <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardContent className="p-6 text-center">
                      <h3 className="text-lg font-semibold mb-2">Sign in to manage your schedule</h3>
                      <p className="text-muted-foreground">
                        Log in to create, update, and track your events.
                      </p>
                    </CardContent>
                  </Card>
                ) : loading ? (
                  <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardContent className="p-6 text-center text-muted-foreground">
                      Loading schedule...
                    </CardContent>
                  </Card>
                ) : upcomingEvents.length > 0 ? (
                  upcomingEvents.map((event) => renderEventCard(event))
                ) : (
                  <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardContent className="p-6 text-center">
                      <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No upcoming events</h3>
                      <p className="text-muted-foreground mb-4">
                        Keep your calendar full by adding your next performance or meeting.
                      </p>
                      <Button className="bg-gradient-primary" onClick={handleOpenCreateDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Event
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="today">
              <div className="space-y-4">
                {loading ? (
                  <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardContent className="p-6 text-center text-muted-foreground">
                      Loading schedule...
                    </CardContent>
                  </Card>
                ) : todayEvents.length > 0 ? (
                  <>
                    <Card className="bg-card/60 border-dashed border-primary/30">
                      <CardContent className="p-4 text-sm text-muted-foreground flex flex-wrap items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Timer className="h-4 w-4" />
                          <span>{formatDuration(todayTotals.totalDuration)} scheduled today</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {todayEvents.length} event{todayEvents.length === 1 ? "" : "s"}
                          </span>
                        </span>
                        {todayTotals.hasEnergy ? (
                          <span className="flex items-center gap-1">
                            <Flame className="h-4 w-4" />
                            <span>{todayTotals.totalEnergy} energy planned</span>
                          </span>
                        ) : null}
                      </CardContent>
                    </Card>
                    {todayEvents.map((event) =>
                      renderEventCard(event, { highlightToday: true, extraBadge: "Today" })
                    )}
                  </>
                ) : (
                  <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardContent className="p-12 text-center">
                      <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No events today</h3>
                      <p className="text-muted-foreground">
                        Enjoy your free day or schedule something new!
                      </p>
                      <Button className="mt-4 bg-gradient-primary" onClick={handleOpenCreateDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Event
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="completed">
              <div className="space-y-4">
                {loading ? (
                  <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardContent className="p-6 text-center text-muted-foreground">
                      Loading schedule...
                    </CardContent>
                  </Card>
                ) : completedEvents.length > 0 ? (
                  completedEvents.map((event) => renderEventCard(event))
                ) : (
                  <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardContent className="p-6 text-center">
                      <CheckCircle className="h-12 w-12 text-success mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No completed events yet</h3>
                      <p className="text-muted-foreground">
                        Finish events to build your performance history.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="all">
              <div className="space-y-4">
                {loading ? (
                  <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardContent className="p-6 text-center text-muted-foreground">
                      Loading schedule...
                    </CardContent>
                  </Card>
                ) : expandedEvents.length > 0 ? (
                  expandedEvents.map((event) => renderEventCard(event))
                ) : (
                  <Card className="bg-card/80 backdrop-blur-sm border-primary/20">
                    <CardContent className="p-6 text-center">
                      <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No events scheduled</h3>
                      <p className="text-muted-foreground mb-4">
                        Plan your next gig, rehearsal, or meeting to stay on track.
                      </p>
                      <Button className="bg-gradient-primary" onClick={handleOpenCreateDialog}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Event
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setFormData(createEmptyFormState());
            setRecurrenceSettings({ ...DEFAULT_RECURRENCE_SETTINGS });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create event</DialogTitle>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateEvent} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setCurrentEvent(null);
            setFormData(createEmptyFormState());
            setRecurrenceSettings({ ...DEFAULT_RECURRENCE_SETTINGS });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit event</DialogTitle>
          </DialogHeader>
          {renderFormFields()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEvent} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Update event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setDeleteTarget(null);
            setIsDeleting(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.title}"? This action cannot be undone.
              {deleteTarget?.recurrence_rule ? " This will remove all future occurrences." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Schedule;
