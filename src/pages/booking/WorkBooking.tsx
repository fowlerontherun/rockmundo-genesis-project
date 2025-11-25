import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, MapPin, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";

const ACTIVITY_TYPES = [
  { value: "work", label: "Work Shift", icon: Briefcase },
  { value: "travel", label: "Travel", icon: MapPin },
  { value: "health", label: "Health & Wellness", icon: Heart },
];

export default function WorkBooking() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [date, setDate] = useState<Date>();
  const [activityType, setActivityType] = useState<string>("");
  const [timeSlot, setTimeSlot] = useState<string>("");
  const [duration, setDuration] = useState<string>("8");

  const handleBookActivity = async () => {
    if (!date || !activityType || !timeSlot || !user) {
      toast({
        title: "Missing Information",
        description: "Please select a date, activity type, and time slot.",
        variant: "destructive",
      });
      return;
    }

    const [hours] = timeSlot.split(":").map(Number);
    const scheduledStart = new Date(date);
    scheduledStart.setHours(hours, 0, 0, 0);
    const durationHours = parseInt(duration);

    const { error } = await (supabase as any).from("scheduled_activities").insert({
      user_id: user.id,
      activity_type: activityType,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: new Date(scheduledStart.getTime() + durationHours * 60 * 60 * 1000).toISOString(),
      status: "scheduled",
      title: `${ACTIVITY_TYPES.find(t => t.value === activityType)?.label}`,
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
      description: "Your activity has been scheduled.",
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
        <h1 className="text-3xl font-bold">Book Life Activity</h1>
        <p className="text-muted-foreground">Schedule work, travel, and personal time</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Select Date & Time</CardTitle>
            <CardDescription>Choose when you need to block time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border"
            />
            
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

            <div className="space-y-2">
              <Label>Duration (hours)</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 4, 6, 8, 12].map(hrs => (
                    <SelectItem key={hrs} value={hrs.toString()}>
                      {hrs} hour{hrs > 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Type</CardTitle>
            <CardDescription>What would you like to schedule?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ACTIVITY_TYPES.map(type => {
              const Icon = type.icon;
              return (
                <Button
                  key={type.value}
                  variant={activityType === type.value ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setActivityType(type.value)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {type.label}
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>

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
