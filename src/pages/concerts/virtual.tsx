import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Headset, Loader2, Rocket, UserPlus, Users } from "lucide-react";
import { format, formatDistanceToNowStrict, isBefore } from "date-fns";

import VirtualConcertViewer from "@/components/concerts/VirtualConcertViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type VirtualConcertEventRow = {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  stage_theme: string | null;
  stream_url: string | null;
  attendance_cap: number | null;
  status: string | null;
  host_user_id: string | null;
};

type VirtualConcertAttendanceRow = {
  id: string;
  concert_id: string;
  attendee_id: string;
  joined_at: string;
};

type EventWithAttendance = VirtualConcertEventRow & {
  attendance: VirtualConcertAttendanceRow[];
  attendanceCount: number;
  userIsAttending: boolean;
};

const INITIAL_FORM_STATE = {
  title: "",
  scheduledAt: "",
  stageTheme: "",
  streamUrl: "",
  attendanceCap: "",
  description: "",
};

const VirtualConcertScheduling = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [formState, setFormState] = useState(INITIAL_FORM_STATE);
  const [events, setEvents] = useState<EventWithAttendance[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [savingEvent, setSavingEvent] = useState(false);
  const [updatingAttendance, setUpdatingAttendance] = useState(false);
  const [launchingEvent, setLaunchingEvent] = useState(false);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const loadAttendance = useCallback(
    async (concertIds: string[]): Promise<VirtualConcertAttendanceRow[]> => {
      if (concertIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from("virtual_concert_attendance")
        .select("id, concert_id, attendee_id, joined_at")
        .in("concert_id", concertIds);

      if (error) {
        console.error("Failed to load attendance records", error);
        toast({
          title: "Attendance unavailable",
          description: "We couldn't load virtual concert attendance details. Try again soon.",
          variant: "destructive",
        });
        return [];
      }

      return data ?? [];
    },
    [toast],
  );

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);

    try {
      const { data, error } = await supabase
        .from("virtual_concert_events")
        .select(
          "id, title, description, scheduled_at, stage_theme, stream_url, attendance_cap, status, host_user_id",
        )
        .order("scheduled_at", { ascending: true });

      if (error) {
        throw error;
      }

      const eventRows = (data ?? []) as VirtualConcertEventRow[];
      const attendanceRows = await loadAttendance(eventRows.map((event) => event.id));

      const enhancedEvents: EventWithAttendance[] = eventRows.map((event) => {
        const attendance = attendanceRows.filter((row) => row.concert_id === event.id);
        const attendanceCount = attendance.length;
        const userIsAttending = Boolean(user?.id && attendance.some((row) => row.attendee_id === user.id));

        return {
          ...event,
          attendance,
          attendanceCount,
          userIsAttending,
        };
      });

      setEvents(enhancedEvents);
      setSelectedEventId((current) => {
        if (current && enhancedEvents.some((event) => event.id === current)) {
          return current;
        }

        return enhancedEvents[0]?.id ?? null;
      });
    } catch (error) {
      console.error("Failed to load virtual concerts", error);
      toast({
        title: "Unable to load virtual concerts",
        description: "We couldn't load your scheduled VR concerts from Supabase.",
        variant: "destructive",
      });
    } finally {
      setLoadingEvents(false);
    }
  }, [loadAttendance, toast, user?.id]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const resetForm = useCallback(() => setFormState(INITIAL_FORM_STATE), []);

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;
      setFormState((prev) => ({ ...prev, [name]: value }));
    },
    [],
  );

  const handleScheduleEvent = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!user?.id) {
        toast({
          title: "Sign in required",
          description: "Sign in to schedule a virtual concert.",
          variant: "destructive",
        });
        return;
      }

      const { title, scheduledAt, stageTheme, streamUrl, attendanceCap, description } = formState;

      if (!title.trim() || !scheduledAt) {
        toast({
          title: "Missing event details",
          description: "Please provide a title and schedule for your VR concert.",
          variant: "destructive",
        });
        return;
      }

      setSavingEvent(true);

      try {
        const concertPayload = {
          title: title.trim(),
          scheduled_at: new Date(scheduledAt).toISOString(),
          stage_theme: stageTheme.trim() || null,
          stream_url: streamUrl.trim() || null,
          attendance_cap: attendanceCap ? Number(attendanceCap) : null,
          description: description.trim() || null,
          host_user_id: user.id,
          status: "scheduled" as const,
        };

        const { data, error } = await supabase
          .from("virtual_concert_events")
          .insert(concertPayload)
          .select("id")
          .single();

        if (error) {
          throw error;
        }

        toast({
          title: "Virtual concert scheduled",
          description: "Your VR performance is live on the calendar.",
        });

        resetForm();
        await loadEvents();
        const insertedId = (data as { id: string } | null)?.id ?? null;
        if (insertedId) {
          setSelectedEventId(insertedId);
        }
      } catch (error) {
        console.error("Failed to schedule virtual concert", error);
        toast({
          title: "Unable to schedule concert",
          description: "Supabase rejected the VR concert request. Please try again.",
          variant: "destructive",
        });
      } finally {
        setSavingEvent(false);
      }
    },
    [formState, loadEvents, resetForm, toast, user?.id],
  );

  const toggleAttendance = useCallback(
    async (concertId: string) => {
      if (!user?.id) {
        toast({
          title: "Sign in required",
          description: "Sign in to RSVP for a virtual concert.",
          variant: "destructive",
        });
        return;
      }

      const targetEvent = events.find((event) => event.id === concertId);
      if (!targetEvent) {
        return;
      }

      setUpdatingAttendance(true);

      try {
        if (targetEvent.userIsAttending) {
          const { error } = await supabase
            .from("virtual_concert_attendance")
            .delete()
            .eq("concert_id", concertId)
            .eq("attendee_id", user.id);

          if (error) {
            throw error;
          }

          toast({
            title: "RSVP removed",
            description: "You have left the virtual guest list.",
          });
        } else {
          const { error } = await supabase
            .from("virtual_concert_attendance")
            .upsert({
              concert_id: concertId,
              attendee_id: user.id,
              joined_at: new Date().toISOString(),
            });

          if (error) {
            throw error;
          }

          toast({
            title: "RSVP confirmed",
            description: "See you in the virtual crowd!",
          });
        }

        await loadEvents();
      } catch (error) {
        console.error("Failed to update attendance", error);
        toast({
          title: "Attendance update failed",
          description: "Supabase could not update the attendance record.",
          variant: "destructive",
        });
      } finally {
        setUpdatingAttendance(false);
      }
    },
    [events, loadEvents, toast, user?.id],
  );

  const launchEvent = useCallback(
    async (concertId: string) => {
      if (!concertId) {
        return;
      }

      setLaunchingEvent(true);

      try {
        const { error } = await supabase
          .from("virtual_concert_events")
          .update({ status: "live", launched_at: new Date().toISOString() })
          .eq("id", concertId);

        if (error) {
          throw error;
        }

        toast({
          title: "Virtual concert launched",
          description: "Participants can now join your immersive performance.",
        });

        await loadEvents();
      } catch (error) {
        console.error("Failed to launch virtual concert", error);
        toast({
          title: "Launch failed",
          description: "We couldn't update the concert status in Supabase.",
          variant: "destructive",
        });
      } finally {
        setLaunchingEvent(false);
      }
    },
    [loadEvents, toast],
  );

  const upcomingEvents = useMemo(
    () => {
      const now = new Date();
      return events.filter((event) => {
        const scheduled = new Date(event.scheduled_at);
        return !isBefore(scheduled, now) || event.status === "live";
      });
    },
    [events],
  );

  return (
    <div className="container mx-auto space-y-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Virtual Concert Control Room</h1>
        <p className="max-w-3xl text-muted-foreground">
          Coordinate your VR-ready performances, manage Supabase-backed attendance lists, and monitor the immersive stage before
          you go live.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px,1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Schedule a virtual concert</CardTitle>
            <CardDescription>Set the time, theme, and attendee limits for your next VR show.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleScheduleEvent}>
              <div className="space-y-2">
                <Label htmlFor="title">Concert title</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Neon Skyline Experience"
                  value={formState.title}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduledAt">Start time</Label>
                <Input
                  id="scheduledAt"
                  name="scheduledAt"
                  type="datetime-local"
                  value={formState.scheduledAt}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stageTheme">Stage theme</Label>
                  <Input
                    id="stageTheme"
                    name="stageTheme"
                    placeholder="Synthwave Arena"
                    value={formState.stageTheme}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="attendanceCap">Attendance cap</Label>
                  <Input
                    id="attendanceCap"
                    name="attendanceCap"
                    type="number"
                    min={0}
                    placeholder="500"
                    value={formState.attendanceCap}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="streamUrl">Streaming portal</Label>
                <Input
                  id="streamUrl"
                  name="streamUrl"
                  placeholder="https://rockmundo.live/your-stage"
                  value={formState.streamUrl}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Event notes</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Brief the crew on unique lighting cues or guest performers."
                  value={formState.description}
                  onChange={handleInputChange}
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={savingEvent} className="gap-2">
                  {savingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                  Schedule concert
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm} disabled={savingEvent}>
                  Reset form
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming VR concerts</CardTitle>
              <CardDescription>
                RSVP guests, adjust your launch plan, and monitor Supabase attendance counts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading virtual concerts...
                </div>
              ) : upcomingEvents.length === 0 ? (
                <p className="text-muted-foreground">No virtual concerts scheduled yet. Create one to get started.</p>
              ) : (
                <div className="space-y-4">
                  {upcomingEvents.map((event) => {
                    const scheduledAt = new Date(event.scheduled_at);
                    const relativeStart = formatDistanceToNowStrict(scheduledAt, { addSuffix: true });
                    const isLive = event.status === "live";

                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setSelectedEventId(event.id)}
                        className={cn(
                          "w-full rounded-lg border p-4 text-left transition",
                          selectedEventId === event.id
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/60 hover:bg-muted",
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold">{event.title}</h3>
                              {isLive && <Badge variant="default">Live</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {format(scheduledAt, "PPpp")} · {relativeStart}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              {event.attendanceCount}
                              {event.attendance_cap ? ` / ${event.attendance_cap}` : ""}
                            </span>
                            {event.stage_theme && (
                              <span className="hidden items-center gap-1 sm:flex">
                                <Headset className="h-4 w-4" /> {event.stage_theme}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Immersive stage preview</CardTitle>
                <CardDescription>
                  Explore the scene and ensure your lighting and crowd energy feel right before going live.
                </CardDescription>
              </div>
              {selectedEvent && (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {selectedEvent.attendanceCount.toLocaleString()} confirmed ·
                  {selectedEvent.attendance_cap ? ` cap ${selectedEvent.attendance_cap.toLocaleString()}` : " unlimited"}
                </div>
              )}
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,360px),1fr]">
              <div className="space-y-4">
                {selectedEvent ? (
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">{selectedEvent.title}</h3>
                      <Badge variant={selectedEvent.status === "live" ? "default" : "secondary"}>
                        {selectedEvent.status?.toUpperCase() ?? "SCHEDULED"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedEvent.description ?? "No additional notes provided."}
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        {format(new Date(selectedEvent.scheduled_at), "PPpp")}
                      </div>
                      {selectedEvent.stage_theme && (
                        <div className="flex items-center gap-2">
                          <Headset className="h-4 w-4 text-muted-foreground" /> {selectedEvent.stage_theme}
                        </div>
                      )}
                      {selectedEvent.stream_url && (
                        <div className="flex items-center gap-2">
                          <Rocket className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={selectedEvent.stream_url}
                            target="_blank"
                            rel="noreferrer"
                            className="truncate text-primary hover:underline"
                          >
                            {selectedEvent.stream_url}
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={selectedEvent.userIsAttending ? "secondary" : "default"}
                        disabled={updatingAttendance}
                        onClick={() => toggleAttendance(selectedEvent.id)}
                        className="gap-2"
                      >
                        {updatingAttendance ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : selectedEvent.userIsAttending ? (
                          <UserPlus className="h-4 w-4 rotate-45" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                        {selectedEvent.userIsAttending ? "Cancel RSVP" : "RSVP to attend"}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={launchingEvent}
                        onClick={() => launchEvent(selectedEvent.id)}
                        className="gap-2"
                      >
                        {launchingEvent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                        Launch VR performance
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                    Select a concert to preview its VR stage.
                  </div>
                )}

                <div className="rounded-lg border p-4 text-sm text-muted-foreground">
                  Supabase attendance data is refreshed automatically whenever you schedule, RSVP, or launch a concert.
                </div>
              </div>

              <div className="min-h-[320px] rounded-xl border">
                <VirtualConcertViewer
                  className="h-[320px] lg:h-full"
                  eventName={selectedEvent?.title}
                  audienceCount={selectedEvent?.attendanceCount}
                  onEnterVR={() =>
                    toast({
                      title: "Entering VR mode",
                      description: "Strap in—your immersive performance is ready.",
                    })
                  }
                  onExitVR={() =>
                    toast({
                      title: "VR session ended",
                      description: "You left the immersive stage preview.",
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default VirtualConcertScheduling;
