import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, GraduationCap, Users, Video } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useActiveProfile } from "@/hooks/useActiveProfile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createScheduledActivity } from "@/hooks/useActivityBooking";
import { useScheduleConflictCheck } from "@/hooks/useScheduleConflictCheck";
import { ScheduleConflictAlert } from "@/components/ScheduleConflictAlert";

export default function EducationBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { profileId } = useActiveProfile();
  const { checkConflicts, isChecking, result: conflictResult, clearResult } = useScheduleConflictCheck();

  const scheduledDate = location.state?.scheduledDate;
  const scheduledHour = location.state?.scheduledHour;

  const [date, setDate] = useState<Date | undefined>(scheduledDate ? new Date(scheduledDate) : undefined);
  const [activityType, setActivityType] = useState<string>("reading");
  const [timeSlot, setTimeSlot] = useState<string>(
    scheduledHour !== undefined ? `${scheduledHour.toString().padStart(2, "0")}:00` : ""
  );
  const [selectedMentor, setSelectedMentor] = useState<string>("");
  const [isBooking, setIsBooking] = useState(false);

  const { data: mentors = [] } = useQuery({
    queryKey: ["mentors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("education_mentors")
        .select("id, name, specialty, cost")
        .eq("is_active", true)
        .order("cost", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const getTitle = () => {
    const titles: Record<string, string> = {
      reading: "Reading",
      university: "University",
      mentorship: "Mentorship",
      youtube_video: "PooTube Learning",
    };
    return titles[activityType] || activityType;
  };

  const handleBookActivity = async () => {
    if (!date || !activityType || !timeSlot || !profileId) {
      toast({ title: "Missing Information", description: "Please select a date, activity type, and time slot.", variant: "destructive" });
      return;
    }

    if (activityType === "mentorship" && !selectedMentor) {
      toast({ title: "Select a Mentor", description: "Please choose a mentor for your session.", variant: "destructive" });
      return;
    }

    const [hours] = timeSlot.split(":").map(Number);
    const scheduledStart = new Date(date);
    scheduledStart.setHours(hours, 0, 0, 0);
    const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60 * 1000);

    // Check for conflicts
    const conflict = await checkConflicts(scheduledStart, scheduledEnd);
    if (conflict.hasConflict) return;

    setIsBooking(true);
    try {
      const metadata: any = {};
      if (activityType === "mentorship") metadata.mentor_id = selectedMentor;

      await createScheduledActivity({
        activityType: activityType as any,
        scheduledStart,
        scheduledEnd,
        title: getTitle(),
        metadata,
      });
      navigate("/schedule");
    } catch (error: any) {
      toast({ title: "Booking Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsBooking(false);
    }
  };

  const handlePickSlot = (slot: { start: Date; end: Date }) => {
    setDate(slot.start);
    setTimeSlot(`${slot.start.getHours().toString().padStart(2, "0")}:00`);
    clearResult();
  };

  const timeSlots = Array.from({ length: 24 }, (_, i) => ({
    value: `${i.toString().padStart(2, "0")}:00`,
    label: `${i.toString().padStart(2, "0")}:00`,
  }));

  const TimeSlotSelect = () => (
    <div className="space-y-2">
      <Label>Time Slot</Label>
      <Select value={timeSlot} onValueChange={setTimeSlot}>
        <SelectTrigger><SelectValue placeholder="Select time" /></SelectTrigger>
        <SelectContent>
          {timeSlots.map(slot => (
            <SelectItem key={slot.value} value={slot.value}>{slot.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Book Education Activity</h1>
        <p className="text-muted-foreground">Schedule your learning sessions in advance</p>
      </div>

      {conflictResult?.hasConflict && (
        <ScheduleConflictAlert result={conflictResult} onPickSlot={handlePickSlot} onDismiss={clearResult} />
      )}

      <Tabs value={activityType} onValueChange={setActivityType}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="reading"><BookOpen className="h-4 w-4 mr-2" />Reading</TabsTrigger>
          <TabsTrigger value="university"><GraduationCap className="h-4 w-4 mr-2" />University</TabsTrigger>
          <TabsTrigger value="mentorship"><Users className="h-4 w-4 mr-2" />Mentorship</TabsTrigger>
          <TabsTrigger value="youtube_video"><Video className="h-4 w-4 mr-2" />PooTube</TabsTrigger>
        </TabsList>

        <TabsContent value="reading" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Select Date & Time</CardTitle><CardDescription>Schedule your reading session</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
              <TimeSlotSelect />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="university" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Select Date & Time</CardTitle><CardDescription>Schedule university class</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
              <TimeSlotSelect />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mentorship" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Select Date & Time</CardTitle><CardDescription>Schedule mentorship session</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
                <TimeSlotSelect />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Choose Mentor</CardTitle><CardDescription>Select your mentor</CardDescription></CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {mentors.map(mentor => (
                  <Button
                    key={mentor.id}
                    variant={selectedMentor === mentor.id ? "default" : "outline"}
                    className="w-full justify-between"
                    onClick={() => setSelectedMentor(mentor.id)}
                  >
                    <span className="flex flex-col items-start">
                      <span>{mentor.name}</span>
                      <span className="text-xs text-muted-foreground">{mentor.specialty}</span>
                    </span>
                    <span className="text-xs">${mentor.cost}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="youtube_video" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Select Date & Time</CardTitle><CardDescription>Schedule YouTube learning session</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
              <TimeSlotSelect />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex gap-4">
        <Button onClick={handleBookActivity} size="lg" className="flex-1" disabled={isBooking || isChecking}>
          {isChecking ? "Checking schedule..." : isBooking ? "Booking..." : "Book Activity"}
        </Button>
        <Button onClick={() => navigate("/schedule")} variant="outline" size="lg">
          View Schedule
        </Button>
      </div>
    </div>
  );
}
