import { useState, useEffect, useCallback, useRef } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
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
} from "lucide-react";

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
  created_at?: string | null;
  updated_at?: string | null;
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

const reminderValueToString = (value: number | null) => (value === null ? "none" : value.toString());

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

const createEmptyFormState = (): EventFormState => ({
  title: "",
  type: "gig",
  date: new Date().toISOString().split("T")[0],
  time: "18:00",
  location: "",
  status: "upcoming",
  description: "",
  reminder_minutes: 30,
});

const normalizeTime = (value: string) => (value.length >= 5 ? value.slice(0, 5) : value);

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
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<EventFormState>(() => createEmptyFormState());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<ScheduleEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduleEvent | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const notifiedEventsRef = useRef<Set<string>>(new Set());
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

  const handleFormChange = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
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
    });
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
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      setEvents((prev) => sortEvents([...prev, newEvent]));
      setIsCreateDialogOpen(false);
      setFormData(createEmptyFormState());

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

    setIsSubmitting(true);
    try {
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
        created_at: data.created_at,
        updated_at: data.updated_at,
      };

      setEvents((prev) => sortEvents(prev.map((event) => (event.id === updatedEvent.id ? updatedEvent : event))));
      setIsEditDialogOpen(false);
      setCurrentEvent(null);
      setFormData(createEmptyFormState());

      toast({
        title: "Event updated",
        description: "The schedule event has been updated.",
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

  const renderFormFields = () => (
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

  const renderEventCard = (
    event: ScheduleEvent,
    options: { highlightToday?: boolean; extraBadge?: string } = {}
  ) => {
    const statusBadgeClass = getStatusBadgeClass(event.status);
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
                  <span>{event.time}</span>
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
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(event)}>
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => openDeleteDialog(event)}
                    disabled={isDeleting && deleteTarget?.id === event.id}
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

  const filteredEvents = selectedDate
    ? events.filter((event) => isSameDay(event.date, selectedDate))
    : events;

  const upcomingEvents = events.filter(
    (event) => event.status === "upcoming" || event.status === "in_progress"
  );
  const todayEvents = events.filter((event) => isSameDay(event.date, new Date()));
  const completedEvents = events.filter((event) => event.status === "completed");

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
                    <div className="space-y-3">
                      {filteredEvents.map((event) => {
                        const statusBadgeClass = getStatusBadgeClass(event.status);
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
                                      {event.time}
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
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditDialog(event)}>
                                  <Edit3 className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => openDeleteDialog(event)}
                                  disabled={isDeleting && deleteTarget?.id === event.id}
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
                  todayEvents.map((event) => renderEventCard(event, { highlightToday: true, extraBadge: "Today" }))
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
                ) : events.length > 0 ? (
                  events.map((event) => renderEventCard(event))
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
