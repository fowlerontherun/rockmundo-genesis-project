import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Music, ArrowLeft, Clock } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SongwritingBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const scheduledDate = location.state?.scheduledDate;
  const scheduledHour = location.state?.scheduledHour;

  const [date, setDate] = useState<Date | undefined>(scheduledDate ? new Date(scheduledDate) : undefined);
  const [timeSlot, setTimeSlot] = useState<string>(
    scheduledHour !== undefined ? `${scheduledHour.toString().padStart(2, "0")}:00` : ""
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  // Fetch user's open songwriting projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["songwriting-projects", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("songwriting_projects")
        .select(`
          id,
          title,
          genres,
          music_progress,
          lyrics_progress,
          sessions_completed,
          estimated_sessions,
          created_at,
          updated_at
        `)
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleBookSession = async () => {
    if (!date || !timeSlot || !selectedProjectId || !user) {
      toast({
        title: "Missing Information",
        description: "Please select a date, time slot, and project to work on.",
        variant: "destructive",
      });
      return;
    }

    const [hours] = timeSlot.split(":").map(Number);
    const scheduledStart = new Date(date);
    scheduledStart.setHours(hours, 0, 0, 0);
    const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60 * 1000); // 1 hour

    // Get project details
    const project = projects.find(p => p.id === selectedProjectId);

    const { error } = await (supabase as any).from("player_scheduled_activities").insert({
      user_id: user.id,
      activity_type: "songwriting",
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: scheduledEnd.toISOString(),
      duration_minutes: 60,
      status: "scheduled",
      title: `Songwriting: ${project?.title || "Untitled"}`,
      description: `Continue working on ${project?.title || "untitled song"}`,
      metadata: {
        project_id: selectedProjectId,
        genres: project?.genres,
      },
    });

    if (error) {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Songwriting Session Booked",
      description: `Scheduled for ${date.toLocaleDateString()} at ${timeSlot}`,
    });

    navigate("/schedule");
  };

  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, "0");
    return `${hour}:00`;
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("/schedule")}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Schedule
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Music className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Book Songwriting Session</CardTitle>
              <CardDescription>
                Schedule a 1-hour session to continue working on your song
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label htmlFor="project">Select Project *</Label>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Music className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  No open songwriting projects found
                </p>
                <Button size="sm" onClick={() => navigate("/songwriting")}>
                  Start a New Song
                </Button>
              </div>
            ) : (
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger id="project">
                  <SelectValue placeholder="Choose a project to work on..." />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="max-h-[300px]">
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <div className="flex items-center gap-2">
                          <span>{project.title || "Untitled"}</span>
                          {project.genres && project.genres.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {project.genres[0]}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(((project.music_progress + project.lyrics_progress) / 2))}% complete
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Show project details if selected */}
          {selectedProject && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Progress:</span>
                    <span className="font-medium">
                      {Math.round(((selectedProject.music_progress + selectedProject.lyrics_progress) / 2))}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sessions:</span>
                    <span className="font-medium">
                      {selectedProject.sessions_completed || 0} / {selectedProject.estimated_sessions || 0}
                    </span>
                  </div>
                  {selectedProject.genres && selectedProject.genres.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Genres:</span>
                      <span className="font-medium">{selectedProject.genres.join(", ")}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Select Date *</Label>
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-md border"
              />
            </div>

            {/* Time Selection */}
            <div className="space-y-2">
              <Label htmlFor="time">Time Slot *</Label>
              <Select value={timeSlot} onValueChange={setTimeSlot}>
                <SelectTrigger id="time">
                  <SelectValue placeholder="Choose a time..." />
                </SelectTrigger>
                <SelectContent>
                  <ScrollArea className="h-[200px]">
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Duration: 1 hour
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate("/schedule")}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleBookSession}
              disabled={!date || !timeSlot || !selectedProjectId}
              className="flex-1"
            >
              Book Session
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
