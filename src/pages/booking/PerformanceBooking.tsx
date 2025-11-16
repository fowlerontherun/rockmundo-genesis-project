import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Guitar, Music, Users, Mic } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth-context";
import { useQuery } from "@tanstack/react-query";

export default function PerformanceBooking() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const scheduledDate = location.state?.scheduledDate;
  const scheduledHour = location.state?.scheduledHour;

  const [date, setDate] = useState<Date | undefined>(scheduledDate ? new Date(scheduledDate) : undefined);
  const [activityType, setActivityType] = useState<string>("rehearsal");
  const [timeSlot, setTimeSlot] = useState<string>(
    scheduledHour !== undefined ? `${scheduledHour.toString().padStart(2, "0")}:00` : ""
  );
  const [duration, setDuration] = useState<string>("2");
  const [selectedVenue, setSelectedVenue] = useState<string>("");
  const [selectedRoom, setSelectedRoom] = useState<string>("");

  // Fetch available venues for gigs
  const { data: venues = [] } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, capacity, reputation")
        .order("reputation", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch available rehearsal rooms
  const { data: rehearsalRooms = [] } = useQuery({
    queryKey: ["rehearsal-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rehearsal_rooms")
        .select("id, name, quality_rating, hourly_rate")
        .order("quality_rating", { ascending: false });
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

    if (activityType === "gig" && !selectedVenue) {
      toast({
        title: "Select a Venue",
        description: "Please choose a venue for your gig.",
        variant: "destructive",
      });
      return;
    }

    if (activityType === "rehearsal" && !selectedRoom) {
      toast({
        title: "Select a Rehearsal Room",
        description: "Please choose a rehearsal room.",
        variant: "destructive",
      });
      return;
    }

    const [hours] = timeSlot.split(":").map(Number);
    const scheduledStart = new Date(date);
    scheduledStart.setHours(hours, 0, 0, 0);
    const durationHours = parseInt(duration);

    const metadata: any = {};
    if (activityType === "gig") metadata.venue_id = selectedVenue;
    if (activityType === "rehearsal") metadata.rehearsal_room_id = selectedRoom;

    const { error } = await (supabase as any).from("scheduled_activities").insert({
      user_id: user.id,
      activity_type: activityType,
      scheduled_start: scheduledStart.toISOString(),
      scheduled_end: new Date(scheduledStart.getTime() + durationHours * 60 * 60 * 1000).toISOString(),
      status: "scheduled",
      title: `${activityType === "gig" ? "Gig" : activityType === "rehearsal" ? "Rehearsal" : activityType === "busking" ? "Busking" : "Songwriting"}`,
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
      description: "Your performance session has been scheduled.",
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
        <h1 className="text-3xl font-bold">Book Performance Activity</h1>
        <p className="text-muted-foreground">Schedule your music sessions in advance</p>
      </div>

      <Tabs value={activityType} onValueChange={setActivityType}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rehearsal">
            <Users className="h-4 w-4 mr-2" />
            Rehearsal
          </TabsTrigger>
          <TabsTrigger value="gig">
            <Guitar className="h-4 w-4 mr-2" />
            Gig
          </TabsTrigger>
          <TabsTrigger value="busking">
            <Mic className="h-4 w-4 mr-2" />
            Busking
          </TabsTrigger>
          <TabsTrigger value="songwriting">
            <Music className="h-4 w-4 mr-2" />
            Songwriting
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rehearsal" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Date & Time</CardTitle>
                <CardDescription>Choose when to rehearse</CardDescription>
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
                <div className="space-y-2">
                  <Label>Duration (hours)</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 6].map(hrs => (
                        <SelectItem key={hrs} value={hrs.toString()}>
                          {hrs} hour{hrs > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rehearsal Room</CardTitle>
                <CardDescription>Choose where to practice</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {rehearsalRooms.map(room => (
                  <Button
                    key={room.id}
                    variant={selectedRoom === room.id ? "default" : "outline"}
                    className="w-full justify-between"
                    onClick={() => setSelectedRoom(room.id)}
                  >
                    <span>{room.name}</span>
                    <span className="text-xs">${room.hourly_rate}/hr</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="gig" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Date & Time</CardTitle>
                <CardDescription>Choose when to perform</CardDescription>
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
                <div className="space-y-2">
                  <Label>Duration (hours)</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 6, 8].map(hrs => (
                        <SelectItem key={hrs} value={hrs.toString()}>
                          {hrs} hour{hrs > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Venue</CardTitle>
                <CardDescription>Select performance venue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {venues.map(venue => (
                  <Button
                    key={venue.id}
                    variant={selectedVenue === venue.id ? "default" : "outline"}
                    className="w-full justify-between"
                    onClick={() => setSelectedVenue(venue.id)}
                  >
                    <span>{venue.name}</span>
                    <span className="text-xs">Rep: {venue.reputation}</span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="busking" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Date & Time</CardTitle>
              <CardDescription>Schedule busking session</CardDescription>
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
              <div className="space-y-2">
                <Label>Duration (hours)</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(hrs => (
                      <SelectItem key={hrs} value={hrs.toString()}>
                        {hrs} hour{hrs > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="songwriting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Date & Time</CardTitle>
              <CardDescription>Schedule songwriting session</CardDescription>
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
              <div className="space-y-2">
                <Label>Duration (hours)</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 6].map(hrs => (
                      <SelectItem key={hrs} value={hrs.toString()}>
                        {hrs} hour{hrs > 1 ? "s" : ""}
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
