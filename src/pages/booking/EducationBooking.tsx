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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useQuery } from "@tanstack/react-query";

export default function EducationBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const scheduledDate = location.state?.scheduledDate;
  const scheduledHour = location.state?.scheduledHour;

  const [date, setDate] = useState<Date | undefined>(scheduledDate ? new Date(scheduledDate) : undefined);
  const [activityType, setActivityType] = useState<string>("reading");
  const [timeSlot, setTimeSlot] = useState<string>(
    scheduledHour !== undefined ? `${scheduledHour.toString().padStart(2, "0")}:00` : ""
  );
  const [selectedMentor, setSelectedMentor] = useState<string>("");

  // Fetch available mentors
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

  const handleBookActivity = async () => {
    if (!date || !activityType || !timeSlot || !user) {
      toast({
        title: "Missing Information",
        description: "Please select a date, activity type, and time slot.",
        variant: "destructive",
      });
      return;
    }

    if (activityType === "mentorship" && !selectedMentor) {
      toast({
        title: "Select a Mentor",
        description: "Please choose a mentor for your session.",
        variant: "destructive",
      });
      return;
    }

    const [hours] = timeSlot.split(":").map(Number);
    const scheduledStart = new Date(date);
    scheduledStart.setHours(hours, 0, 0, 0);

    const metadata: any = {};
    if (activityType === "mentorship") metadata.mentor_id = selectedMentor;

    const { error } = await (supabase as any).from("scheduled_activities").insert({
      user_id: user.id,
      activity_type: activityType,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: new Date(scheduledStart.getTime() + 60 * 60 * 1000).toISOString(),
      status: "scheduled",
      title: `${activityType === "reading" ? "Reading" : activityType === "university" ? "University" : activityType === "mentorship" ? "Mentorship" : "PooTube Learning"}`,
      metadata,
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
      title: "Activity Booked!",
      description: "Your learning session has been scheduled.",
    });

    navigate("/schedule");
  };

  const timeSlots = Array.from({ length: 24 }, (_, i) => ({
    value: `${i.toString().padStart(2, "0")}:00`,
    label: `${i.toString().padStart(2, "0")}:00`,
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Book Education Activity</h1>
        <p className="text-muted-foreground">Schedule your learning sessions in advance</p>
      </div>

      <Tabs value={activityType} onValueChange={setActivityType}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="reading">
            <BookOpen className="h-4 w-4 mr-2" />
            Reading
          </TabsTrigger>
          <TabsTrigger value="university">
            <GraduationCap className="h-4 w-4 mr-2" />
            University
          </TabsTrigger>
          <TabsTrigger value="mentorship">
            <Users className="h-4 w-4 mr-2" />
            Mentorship
          </TabsTrigger>
          <TabsTrigger value="youtube_video">
            <Video className="h-4 w-4 mr-2" />
            PooTube
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reading" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Date & Time</CardTitle>
              <CardDescription>Schedule your reading session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map(slot => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="university" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Date & Time</CardTitle>
              <CardDescription>Schedule university class</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map(slot => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mentorship" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Date & Time</CardTitle>
                <CardDescription>Schedule mentorship session</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
                <div className="space-y-2">
                  <Label>Time Slot</Label>
                  <Select value={timeSlot} onValueChange={setTimeSlot}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map(slot => (
                        <SelectItem key={slot.value} value={slot.value}>
                          {slot.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Choose Mentor</CardTitle>
                <CardDescription>Select your mentor</CardDescription>
              </CardHeader>
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
            <CardHeader>
              <CardTitle>Select Date & Time</CardTitle>
              <CardDescription>Schedule YouTube learning session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
              <div className="space-y-2">
                <Label>Time Slot</Label>
                <Select value={timeSlot} onValueChange={setTimeSlot}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map(slot => (
                      <SelectItem key={slot.value} value={slot.value}>
                        {slot.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex gap-4">
        <Button onClick={handleBookActivity} size="lg" className="flex-1">
          Book Activity
        </Button>
        <Button onClick={() => navigate("/schedule")} variant="outline" size="lg">
          View Schedule
        </Button>
      </div>
    </div>
  );
}
